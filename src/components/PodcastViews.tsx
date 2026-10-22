import { useMemo, useState, type FormEvent } from 'react'
import type { AbsPodcastSearchResult } from '../api/abs'
import { forget } from '../lib/absCache'
import {
  sortEpisodeRefs,
  sortPodcasts,
  type EpisodeSort,
  type PodcastSort,
} from '../lib/absHelpers'
import { useAbsPlayer } from '../lib/useAbsPlayer'
import {
  useAllEpisodes,
  usePodcastItems,
  useProgressEpisodes,
  useRecentEpisodes,
} from '../lib/useAbsLibrary'
import { useAccount } from '../state/AccountContext'
import { useNav } from '../state/NavContext'
import { usePrefs } from '../state/PrefsContext'
import {
  EpisodeCard,
  EpisodeRow,
  MissingAbs,
  PodcastCard,
  Shelf,
  SortChips,
} from './AbsParts'
import { CoverArt } from './CoverArt'
import { IconCheck, IconPlus, IconSearch } from './Icons'
import { LayoutToggle } from './LayoutToggle'
import { ResumePlaying } from './ResumePlaying'

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
  const { abs } = useAccount()
  const { go } = useNav()
  const { playEpisode } = useAbsPlayer()
  const latestFeed = useRecentEpisodes(32)
  const continuingFeed = useProgressEpisodes()

  const refs = useMemo(() => latestFeed.data ?? [], [latestFeed.data])

  /* The server already sends them newest first; the shelf still sorts, so a
     mixed list from a proxy or a cache cannot look out of order. */
  const latest = useMemo(() => sortEpisodeRefs(refs, 'newest', false).slice(0, 12), [refs])
  const continuing = useMemo(() => continuingFeed.data ?? [], [continuingFeed.data])

  if (!abs?.podcasts) return <MissingAbs noun="Podcast" />

  return (
    <div className="view abs-view">
      <ResumePlaying />

      <header className="view-head">
        <h2>Podcasts</h2>
      </header>

      {latestFeed.error ? <p className="error">{latestFeed.error}</p> : null}
      {latestFeed.loading && !latestFeed.data ? <p className="muted">Wird geladen …</p> : null}

      {continuing.length ? (
        <Shelf title="Weiterhören" hint="Angefangene Folgen">
          {continuing.map((ref) => (
            <EpisodeCard
              key={`${ref.item.id}:${ref.episode.id}`}
              item={ref.item}
              episode={ref.episode}
              onOpen={() => go({ name: 'podcast', id: ref.item.id })}
              onPlay={() => void playEpisode(ref.item, ref.episode)}
            />
          ))}
        </Shelf>
      ) : null}

      {latest.length ? (
        <Shelf title="Neueste Episoden">
          {latest.map((ref) => (
            <EpisodeCard
              key={`${ref.item.id}:${ref.episode.id}`}
              item={ref.item}
              episode={ref.episode}
              onOpen={() => go({ name: 'podcast', id: ref.item.id })}
              onPlay={() => void playEpisode(ref.item, ref.episode)}
            />
          ))}
        </Shelf>
      ) : null}

      {!latestFeed.loading && !latestFeed.error && !refs.length && !continuing.length ? (
        <p className="muted">Noch keine Episoden auf dem Server.</p>
      ) : null}
    </div>
  )
}

export function PodcastsView() {
  const { abs } = useAccount()
  const { go } = useNav()
  const { layout } = usePrefs()
  const podcasts = usePodcastItems()
  const [sort, setSort] = useState<PodcastSort>('title')
  const [desc, setDesc] = useState(false)

  const list = useMemo(() => sortPodcasts(podcasts.data ?? [], sort, desc), [podcasts.data, sort, desc])

  if (!abs?.podcasts) return <MissingAbs noun="Podcast" />

  return (
    <div className="view abs-view">
      <header className="view-head">
        <div>
          <h2>Podcasts</h2>
          <p className="muted">{list.length ? `${list.length} Podcasts` : abs.podcasts.name}</p>
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
  const { abs, progress } = useAccount()
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

  if (!abs?.podcasts) return <MissingAbs noun="Podcast" />

  const shown = list.slice(0, limit)

  return (
    <div className="view abs-view">
      <header className="view-head">
        <div>
          <h2>Episoden</h2>
          <p className="muted">{list.length ? `${list.length} Folgen` : abs.podcasts.name}</p>
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

export function PodcastAdd() {
  const { abs } = useAccount()
  const [term, setTerm] = useState('')
  const [results, setResults] = useState<AbsPodcastSearchResult[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [adding, setAdding] = useState<number | null>(null)
  const [added, setAdded] = useState<Record<number, boolean>>({})

  async function search(e: FormEvent) {
    e.preventDefault()
    if (!abs || !term.trim()) return
    setBusy(true)
    setError('')
    try {
      const list = await abs.client.searchPodcasts(term.trim())
      setResults(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Suche fehlgeschlagen')
      setResults(null)
    } finally {
      setBusy(false)
    }
  }

  async function add(result: AbsPodcastSearchResult) {
    if (!abs) return
    const library = abs.podcasts
    const folder = library?.folders?.[0]
    if (!library || !folder) {
      setError('Dem Server fehlt eine Podcast-Bibliothek mit Ordner.')
      return
    }
    setAdding(result.id)
    setError('')
    try {
      await abs.client.addPodcast({ libraryId: library.id, folderId: folder.id, result })
      setAdded((a) => ({ ...a, [result.id]: true }))
      // The show will appear in the lists once they reload.
      forget(abs.client.baseUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Podcast konnte nicht hinzugefügt werden')
    } finally {
      setAdding(null)
    }
  }

  if (!abs?.podcasts) return <MissingAbs noun="Podcast" />

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
        <button type="submit" className="primary-btn" disabled={busy || !term.trim()}>
          {busy ? 'Suche …' : 'Suchen'}
        </button>
      </form>

      {error ? <p className="error">{error}</p> : null}

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
              disabled={adding === result.id || added[result.id]}
              onClick={() => void add(result)}
            >
              {added[result.id] ? (
                <>
                  <IconCheck size={16} /> Hinzugefügt
                </>
              ) : adding === result.id ? (
                'Wird hinzugefügt …'
              ) : (
                <>
                  <IconPlus size={16} /> Hinzufügen
                </>
              )}
            </button>
          </article>
        ))}
      </div>
    </div>
  )
}
