import { useMemo, useState, type FormEvent } from 'react'
import type { AbsFeedPodcast, AbsPodcastSearchResult } from '../api/abs'
import { forget } from '../lib/absCache'
import {
  sortEpisodeRefs,
  sortPodcasts,
  type EpisodeSort,
  type PodcastSort,
} from '../lib/absHelpers'
import { useAbsPlayer } from '../lib/useAbsPlayer'
import { useAllEpisodes, usePodcastItems } from '../lib/useAbsLibrary'
import { useAccount } from '../state/AccountContext'
import { useNav } from '../state/NavContext'
import { usePrefs } from '../state/PrefsContext'
import { EpisodeCard, EpisodeRow, MissingAbs, PodcastCard, SortChips } from './AbsParts'
import { CoverArt } from './CoverArt'
import { IconCheck, IconPlus, IconSearch } from './Icons'
import { LayoutToggle } from './LayoutToggle'
import { sortFeed } from '../lib/podcastFeed'
import { splitLabels } from '../lib/format'
import { DashboardBoard } from './DashboardBoard'
import { PodcastSetup } from './PodcastSetup'

const PODCAST_SORTS: { id: PodcastSort; label: string }[] = [
  { id: 'title', label: 'Titel' },
  { id: 'added', label: 'Hinzugefügt' },
  { id: 'episodes', label: 'Folgen' },
]

const EPISODE_SORTS: { id: EpisodeSort; label: string }[] = [
  { id: 'newest', label: 'Neueste' },
  { id: 'oldest', label: 'Älteste' },
  { id: 'duration', label: 'Länge' },
  { id: 'title', label: 'Titel' },
]

export function PodcastHome() {
  const { podcasts } = useAccount()

  if (!podcasts) return <MissingAbs noun="Podcast" />

  return (
    <div className="view abs-view">
      <DashboardBoard
        storageKey="navideck.dashboard.podcasts.v1"
        scope="podcasts"
        renderHead={({ edit, toggle }) => (
          <header className="view-head">
            <h2>Podcasts</h2>
            <button type="button" className={`chip ${edit ? 'is-on' : ''}`} onClick={toggle}>
              {edit ? 'Fertig' : 'Anpassen'}
            </button>
          </header>
        )}
      />
    </div>
  )
}

export function PodcastsView() {
  const { podcasts: podcastSource } = useAccount()
  const { go } = useNav()
  const { layout } = usePrefs()
  const podcasts = usePodcastItems()
  const [sort, setSort] = useState<PodcastSort>('title')
  const [desc, setDesc] = useState(false)

  const list = useMemo(() => sortPodcasts(podcasts.data ?? [], sort, desc), [podcasts.data, sort, desc])

  if (!podcastSource) return <MissingAbs noun="Podcast" />

  return (
    <div className="view abs-view">
      <header className="view-head">
        <div>
          <h2>Sendungen</h2>
          <p className="muted">{list.length ? `${list.length} Podcasts` : podcastSource.name}</p>
        </div>
        <SortChips
          options={PODCAST_SORTS}
          value={sort}
          desc={desc}
          onChange={setSort}
          onDesc={() => setDesc((d) => !d)}
          ascLabel="↑ Aufsteigend"
          descLabel="↓ Absteigend"
        >
          <LayoutToggle section="podcasts" />
        </SortChips>
      </header>

      {podcasts.error ? <p className="error">{podcasts.error}</p> : null}
      {podcasts.loading && !podcasts.data ? <p className="muted">Wird geladen …</p> : null}
      {!podcasts.loading && !podcasts.error && !list.length ? (
        <p className="muted">Noch keine Podcasts. Unter „Hinzufügen“ findest du welche.</p>
      ) : null}

      <div className={`album-grid ${layout.podcasts === 'list' ? 'is-list' : ''}`}>
        {list.map((item) => (
          <PodcastCard key={item.id} item={item} onOpen={() => go({ name: 'podcast', id: item.id })} />
        ))}
      </div>
    </div>
  )
}

const PAGE = 120

export function EpisodesView() {
  const { podcasts: podcastSource, progress } = useAccount()
  const { go } = useNav()
  const { layout } = usePrefs()
  const { playEpisode } = useAbsPlayer()
  const episodes = useAllEpisodes()
  const [sort, setSort] = useState<EpisodeSort>('newest')
  const [limit, setLimit] = useState(PAGE)

  /* Each option already says which way it points. */
  const list = useMemo(() => {
    if (sort === 'duration') return sortEpisodeRefs(episodes.data ?? [], 'duration', true)
    if (sort === 'oldest') return sortEpisodeRefs(episodes.data ?? [], 'oldest', false)
    if (sort === 'title') return sortEpisodeRefs(episodes.data ?? [], 'title', false)
    return sortEpisodeRefs(episodes.data ?? [], 'newest', false)
  }, [episodes.data, sort])

  if (!podcastSource) return <MissingAbs noun="Podcast" />

  const shown = list.slice(0, limit)

  return (
    <div className="view abs-view">
      <header className="view-head">
        <div>
          <h2>Episoden</h2>
          <p className="muted">{list.length ? `${list.length} Folgen` : podcastSource.name}</p>
        </div>
        <SortChips
          options={EPISODE_SORTS}
          value={sort}
          desc={false}
          onChange={setSort}
          ascLabel="Aufsteigend"
          descLabel="Absteigend"
        >
          <LayoutToggle section="episodes" />
        </SortChips>
      </header>

      {episodes.error ? <p className="error">{episodes.error}</p> : null}
      {episodes.loading && !episodes.data ? <p className="muted">Wird geladen …</p> : null}
      {!episodes.loading && !episodes.error && !list.length ? (
        <p className="muted">Noch keine Episoden auf dem Server.</p>
      ) : null}

      {layout.episodes === 'grid' ? (
        <div className="album-grid">
          {shown.map((ref) => (
            <EpisodeCard
              key={`${ref.item.id}:${ref.episode.id}`}
              item={ref.item}
              episode={ref.episode}
              onOpen={() => go({ name: 'podcast', id: ref.item.id })}
              onPlay={() => void playEpisode(ref.item, ref.episode)}
            />
          ))}
        </div>
      ) : (
        <div className="abs-episodes">
          {shown.map((ref) => (
            <EpisodeRow
              key={`${ref.item.id}:${ref.episode.id}`}
              item={ref.item}
              episode={ref.episode}
              progress={progress}
              onOpen={() => go({ name: 'podcast', id: ref.item.id })}
              onPlay={() => void playEpisode(ref.item, ref.episode)}
            />
          ))}
        </div>
      )}

      {list.length > shown.length ? (
        <div className="load-more">
          <button type="button" className="chip" onClick={() => setLimit((n) => n + PAGE)}>
            Weitere Episoden laden
          </button>
        </div>
      ) : null}
    </div>
  )
}

const COUNTRIES = [
  { code: 'de', label: 'Deutsch' },
  { code: 'us', label: 'Englisch (US)' },
  { code: 'gb', label: 'Englisch (UK)' },
  { code: 'fr', label: 'Französisch' },
  { code: 'es', label: 'Spanisch' },
  { code: 'it', label: 'Italienisch' },
  { code: 'nl', label: 'Niederländisch' },
  { code: 'pl', label: 'Polnisch' },
  { code: 'se', label: 'Schwedisch' },
  { code: 'dk', label: 'Dänisch' },
  { code: 'no', label: 'Norwegisch' },
  { code: 'fi', label: 'Finnisch' },
  { code: 'pt', label: 'Portugiesisch' },
  { code: 'tr', label: 'Türkisch' },
  { code: 'jp', label: 'Japanisch' },
  { code: 'au', label: 'Englisch (AU)' },
] as const

const COUNTRY_KEY = 'navideck.podcastCountry'
const EMPTY_KEYS = new Set<string>()

function readCountry(): string {
  try {
    const saved = localStorage.getItem(COUNTRY_KEY)
    if (saved && COUNTRIES.some((country) => country.code === saved)) return saved
  } catch {
    /* ignore */
  }
  return 'de'
}

type PodcastSetupState = {
  result: AbsPodcastSearchResult
  feed: AbsFeedPodcast | null
  loading: boolean
  error: string
  selected: Set<number>
  autoDownload: boolean
  tags: string
  genres: string
}

export function PodcastAdd() {
  const { abs, podcasts } = useAccount()
  const [term, setTerm] = useState('')
  const [country, setCountry] = useState(readCountry)
  const [results, setResults] = useState<AbsPodcastSearchResult[] | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [added, setAdded] = useState<Record<number, boolean>>({})
  const [setup, setSetup] = useState<PodcastSetupState | null>(null)
  const [saving, setSaving] = useState(false)

  async function search(e: FormEvent) {
    e.preventDefault()
    if (!abs || !term.trim()) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const list = await abs.client.searchPodcasts(term.trim(), country)
      setResults(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Suche fehlgeschlagen')
      setResults(null)
    } finally {
      setBusy(false)
    }
  }

  function chooseCountry(code: string) {
    setCountry(code)
    try {
      localStorage.setItem(COUNTRY_KEY, code)
    } catch {
      /* ignore */
    }
  }

  /*
   * Choosing a show opens the setup window first: the feed decides how many
   * episodes exist, and the reader decides how many to bring over right away.
   */
  async function openSetup(result: AbsPodcastSearchResult) {
    if (!abs) return
    if (!result.feedUrl) {
      setError('Zu dieser Sendung hat der Server keine Feed-Adresse.')
      return
    }
    setError('')
    setNotice('')
    setSetup({
      result,
      feed: null,
      loading: true,
      error: '',
      selected: new Set(),
      autoDownload: true,
      tags: '',
      genres: (result.genres ?? []).join(', '),
    })
    try {
      const feed = sortFeed(await abs.client.getPodcastFeed(result.feedUrl))
      const selected = new Set<number>(feed.episodes.slice(0, 3).map((_, index) => index))
      setSetup((current) =>
        current && current.result.id === result.id
          ? {
              ...current,
              feed,
              loading: false,
              selected,
              genres: feed.metadata.genres?.length
                ? feed.metadata.genres.join(', ')
                : current.genres,
            }
          : current,
      )
    } catch (err) {
      setSetup((current) =>
        current && current.result.id === result.id
          ? {
              ...current,
              loading: false,
              error: err instanceof Error ? err.message : 'Der Feed konnte nicht geladen werden.',
            }
          : current,
      )
    }
  }

  function toggleEpisode(index: number) {
    setSetup((current) => {
      if (!current) return current
      const selected = new Set(current.selected)
      if (selected.has(index)) selected.delete(index)
      else selected.add(index)
      return { ...current, selected }
    })
  }

  function selectAll(value: boolean) {
    setSetup((current) => {
      if (!current?.feed) return current
      return {
        ...current,
        selected: value
          ? new Set(current.feed.episodes.map((_, index) => index))
          : new Set<number>(),
      }
    })
  }

  async function confirmSetup() {
    if (!abs || !setup) return
    const library = abs.podcasts
    const folder = library?.folders?.[0]
    if (!library || !folder) {
      setError('Dem Server fehlt eine Podcast-Bibliothek mit Ordner.')
      return
    }
    if (!folder.fullPath) {
      setError('Dem Podcast-Ordner fehlt der Pfad. Bitte in Audiobookshelf prüfen.')
      return
    }
    const chosen = setup.feed
      ? setup.feed.episodes.filter((_, index) => setup.selected.has(index))
      : []
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const item = await abs.client.addPodcast({
        libraryId: library.id,
        folderId: folder.id,
        folderPath: folder.fullPath,
        result: setup.result,
        autoDownloadEpisodes: setup.autoDownload,
        tags: splitLabels(setup.tags),
        genres: splitLabels(setup.genres),
      })
      setAdded((a) => ({ ...a, [setup.result.id]: true }))
      // The show will appear in the lists once they reload.
      forget(abs.client.baseUrl)
      if (chosen.length) {
        try {
          await abs.client.downloadEpisodes(item.id, chosen)
          setNotice(
            `„${setup.result.title}“ hinzugefügt; ${chosen.length} ${
              chosen.length === 1 ? 'Folge wird' : 'Folgen werden'
            } heruntergeladen.`,
          )
        } catch (err) {
          setError(
            `Der Podcast wurde angelegt, aber die Folgen konnten nicht gestartet werden: ${
              err instanceof Error ? err.message : 'Unbekannter Fehler'
            }`,
          )
        }
      } else {
        setNotice(`„${setup.result.title}“ hinzugefügt.`)
      }
      setSetup(null)
    } catch (err) {
      setSetup((current) =>
        current
          ? {
              ...current,
              error:
                err instanceof Error ? err.message : 'Podcast konnte nicht hinzugefügt werden',
            }
          : current,
      )
    } finally {
      setSaving(false)
    }
  }

  if (!abs?.podcasts) return <MissingAbs noun="Podcast" />
  if (podcasts?.kind !== 'audiobookshelf') {
    return (
      <div className="view abs-view">
        <header className="view-head">
          <h2>Podcast hinzufügen</h2>
        </header>
        <p className="muted">
          Abonnierte Podcasts verwaltest du auf dem Subsonic-Server (in Nextcloud Music unter „Podcasts“).
          Hier lassen sich nur Audiobookshelf-Sendungen suchen.
        </p>
      </div>
    )
  }

  const chosenCount = setup?.selected.size ?? 0

  return (
    <div className="view abs-view">
      <header className="view-head">
        <div>
          <h2>Podcast hinzufügen</h2>
          <p className="muted">Suche bei Apple Podcasts und übernimm die Sendung auf deinen Server.</p>
        </div>
      </header>

      <form className="abs-search" onSubmit={(e) => void search(e)}>
        <span className="abs-search-field">
          <IconSearch size={20} />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Podcast suchen, z. B. „Raumzeit“"
            aria-label="Podcast suchen"
          />
        </span>
        <select
          className="abs-country"
          aria-label="Sprache der Suche"
          title="Sprache der Suche"
          value={country}
          onChange={(e) => chooseCountry(e.target.value)}
        >
          {COUNTRIES.map((entry) => (
            <option key={entry.code} value={entry.code}>
              {entry.label}
            </option>
          ))}
        </select>
        <button type="submit" className="primary-btn" disabled={busy || !term.trim()}>
          {busy ? 'Suche …' : 'Suchen'}
        </button>
      </form>

      {error ? <p className="error">{error}</p> : null}
      {notice ? <p className="podcast-notice">{notice}</p> : null}

      {results && !results.length ? <p className="muted">Nichts gefunden.</p> : null}

      <div className="abs-search-results">
        {(results ?? []).map((result) => (
          <article key={result.id} className="abs-search-row">
            <CoverArt src={result.cover} alt="" size={200} className="abs-search-art" />
            <div className="abs-search-text">
              <strong>{result.title}</strong>
              <span className="muted">
                {[result.artistName, result.trackCount ? `${result.trackCount} Folgen` : null]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
              {result.descriptionPlain || result.description ? (
                <p className="abs-search-desc">{result.descriptionPlain || result.description}</p>
              ) : null}
            </div>
            <button
              type="button"
              className={`chip ${added[result.id] ? 'is-on' : ''}`}
              disabled={added[result.id]}
              onClick={() => void openSetup(result)}
            >
              {added[result.id] ? (
                <>
                  <IconCheck size={16} /> Hinzugefügt
                </>
              ) : (
                <>
                  <IconPlus size={16} /> Hinzufügen
                </>
              )}
            </button>
          </article>
        ))}
      </div>

      {setup ? (
        <PodcastSetup
          heading="Podcast hinzufügen"
          cover={setup.result.cover}
          title={setup.result.title}
          author={setup.result.artistName}
          feed={setup.feed}
          loading={setup.loading}
          error={setup.error}
          existing={EMPTY_KEYS}
          selected={setup.selected}
          onToggle={toggleEpisode}
          onSelectAll={() => selectAll(true)}
          onSelectNone={() => selectAll(false)}
          autoDownload={setup.autoDownload}
          onAutoDownload={(value) =>
            setSetup((current) => (current ? { ...current, autoDownload: value } : current))
          }
          editingMeta
          tags={setup.tags}
          onTags={(value) =>
            setSetup((current) => (current ? { ...current, tags: value } : current))
          }
          genres={setup.genres}
          onGenres={(value) =>
            setSetup((current) => (current ? { ...current, genres: value } : current))
          }
          busy={saving}
          confirmLabel={
            setup.feed && chosenCount
              ? `Hinzufügen · ${chosenCount} ${chosenCount === 1 ? 'Folge' : 'Folgen'}`
              : 'Ohne Folgen hinzufügen'
          }
          onConfirm={() => void confirmSetup()}
          onClose={() => setSetup(null)}
        />
      ) : null}
    </div>
  )
}
