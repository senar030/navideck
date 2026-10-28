import { useMemo, useState } from 'react'
import type { AbsEpisode, AbsFeedPodcast } from '../api/abs'
import { podcastOf, sortEpisodes } from '../lib/absHelpers'
import { useAbsPlayer } from '../lib/useAbsPlayer'
import { useAsync } from '../lib/useAsync'
import { stripHtml } from '../lib/format'
import { episodeKey, sortFeed } from '../lib/podcastFeed'
import { useAccount } from '../state/AccountContext'
import { useNav } from '../state/NavContext'
import { AbsCover, EpisodeRow, MissingAbs } from './AbsParts'
import { IconPlay, IconPlus, IconSettings } from './Icons'
import { PodcastOptions } from './PodcastOptions'
import { PodcastSetup } from './PodcastSetup'

const PAGE = 80

type DownloadSetup = {
  feed: AbsFeedPodcast | null
  loading: boolean
  error: string
  existing: Set<string>
  selected: Set<number>
  autoDownload: boolean
}

/** A library episode's feed identity, so feed rows can be marked as present. */
function libraryEpisodeKey(episode: AbsEpisode): string {
  const guid = episode.guid?.trim()
  if (guid) return guid
  return `${episode.title.trim()}|${episode.publishedAt ?? episode.pubDate ?? ''}`
}

export function PodcastDetail({ id }: { id: string }) {
  const { podcasts, progress, abs } = useAccount()
  const { playEpisode } = useAbsPlayer()
  const { go } = useNav()
  const [limit, setLimit] = useState(PAGE)
  const [refresh, setRefresh] = useState(0)
  const [setup, setSetup] = useState<DownloadSetup | null>(null)
  const [options, setOptions] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const client = podcasts?.client ?? null
  /* Only Audiobookshelf asks the server to fetch feed episodes for a show. */
  const admin = podcasts?.kind === 'audiobookshelf' ? (abs?.client ?? null) : null
  const result = useAsync(client ? () => client.getItem(id) : null, [client, id, refresh])

  const item = result.data
  const podcast = item ? podcastOf(item) : null
  const episodes = useMemo(
    () => sortEpisodes(podcast?.episodes ?? [], 'newest', false),
    [podcast],
  )

  if (!podcasts || !client) return <MissingAbs noun="Podcast" />
  if (result.error) return <p className="error">{result.error}</p>
  if (!item || !podcast) return <p className="muted">Podcast wird geladen …</p>

  const cover = client.coverUrl(id)
  const shown = episodes.slice(0, limit)
  const latest = episodes[0]

  async function openDownloads() {
    if (!admin || !podcast) return
    const feedUrl = podcast.metadata.feedUrl
    if (!feedUrl) {
      setNotice('Dieser Podcast hat keine Feed-Adresse, aus der Folgen geladen werden könnten.')
      return
    }
    setNotice('')
    setSetup({
      feed: null,
      loading: true,
      error: '',
      existing: new Set(),
      selected: new Set(),
      autoDownload: Boolean(podcast.autoDownloadEpisodes),
    })
    try {
      const feed = sortFeed(await admin.getPodcastFeed(feedUrl))
      const libraryKeys = new Set((podcast.episodes ?? []).map(libraryEpisodeKey))
      const libraryTitles = new Set(
        (podcast.episodes ?? []).map((episode) => episode.title.trim().toLowerCase()),
      )
      const existing = new Set<string>()
      const selected = new Set<number>()
      feed.episodes.forEach((episode, index) => {
        const key = episodeKey(episode)
        const present =
          libraryKeys.has(key) || libraryTitles.has(episode.title.trim().toLowerCase())
        if (present) {
          existing.add(key)
          return
        }
        if (selected.size < 5) selected.add(index)
      })
      setSetup((current) =>
        current
          ? { ...current, feed, loading: false, existing, selected }
          : current,
      )
    } catch (err) {
      setSetup((current) =>
        current
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
      const feed = current?.feed
      if (!current || !feed) return current
      return {
        ...current,
        selected: value
          ? new Set(
              feed.episodes
                .map((_, index) => index)
                .filter((index) => !current.existing.has(episodeKey(feed.episodes[index]))),
            )
          : new Set<number>(),
      }
    })
  }

  async function confirmDownloads() {
    if (!admin || !setup || !item || !podcast) return
    const chosen = setup.feed
      ? setup.feed.episodes.filter((_, index) => setup.selected.has(index))
      : []
    const autoChanged = setup.autoDownload !== Boolean(podcast.autoDownloadEpisodes)
    if (!chosen.length && !autoChanged) {
      setSetup(null)
      return
    }
    setSaving(true)
    setSetup((current) => (current ? { ...current, error: '' } : current))
    try {
      if (autoChanged) {
        await admin.updatePodcast(item.id, { autoDownloadEpisodes: setup.autoDownload })
      }
      if (chosen.length) {
        await admin.downloadEpisodes(item.id, chosen)
        setNotice(
          `${chosen.length} ${chosen.length === 1 ? 'Folge wird' : 'Folgen werden'} heruntergeladen. Sie erscheinen, sobald der Server sie geholt hat.`,
        )
      } else {
        setNotice('Einstellungen gespeichert.')
      }
      setSetup(null)
      setRefresh((n) => n + 1)
    } catch (err) {
      setSetup((current) =>
        current
          ? {
              ...current,
              error: err instanceof Error ? err.message : 'Die Folgen konnten nicht geladen werden.',
            }
          : current,
      )
    } finally {
      setSaving(false)
    }
  }

  const chosenCount = setup?.selected.size ?? 0
  const autoChanged = setup ? setup.autoDownload !== Boolean(podcast.autoDownloadEpisodes) : false

  return (
    <div className="view detail abs-detail">
      <div className="hero-banner">
        <img className="hero-bg" src={cover} alt="" />
        <div className="hero-veil" />
        <div className="hero">
          <AbsCover src={cover} className="hero-cover" />
          <div className="hero-copy">
            <p className="eyebrow">Podcast</p>
            <h2>{podcast.metadata.title}</h2>
            <p className="hero-artist">{podcast.metadata.author || 'Unbekannt'}</p>
            <p className="hero-meta muted">
              {[
                episodes.length ? `${episodes.length} ${episodes.length === 1 ? 'Folge' : 'Folgen'}` : null,
                podcast.metadata.genres?.slice(0, 2).join(', '),
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            {podcast.tags?.length ? (
              <div className="podcast-tags">
                {podcast.tags.map((tag) => (
                  <span key={tag} className="podcast-tag">
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="hero-actions">
              {latest ? (
                <button
                  type="button"
                  className="primary-btn"
                  onClick={() => void playEpisode(item, latest)}
                >
                  <IconPlay size={22} /> Neueste Folge
                </button>
              ) : null}
              {admin ? (
                <button type="button" className="chip" onClick={() => void openDownloads()}>
                  <IconPlus size={16} /> Folgen laden
                </button>
              ) : null}
              {admin ? (
                <button type="button" className="chip" onClick={() => setOptions(true)}>
                  <IconSettings size={16} /> Optionen
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {notice ? (
        <p className="podcast-notice">
          {notice}{' '}
          <button type="button" className="text-btn" onClick={() => setRefresh((n) => n + 1)}>
            Liste aktualisieren
          </button>
        </p>
      ) : null}

      {podcast.metadata.description ? (
        <section className="abs-section">
          <h3>Über den Podcast</h3>
          <p className="abs-description">{stripHtml(podcast.metadata.description)}</p>
        </section>
      ) : null}

      <section className="abs-section">
        <h3>Folgen</h3>
        {!episodes.length ? <p className="muted">Noch keine Folgen geladen.</p> : null}
        <div className="abs-episodes">
          {shown.map((episode) => (
            <EpisodeRow
              key={episode.id}
              item={item}
              episode={episode}
              progress={progress}
              onOpen={() => undefined}
              onPlay={() => void playEpisode(item, episode)}
            />
          ))}
        </div>
        {episodes.length > shown.length ? (
          <div className="load-more">
            <button type="button" className="chip" onClick={() => setLimit((n) => n + PAGE)}>
              Weitere Folgen laden
            </button>
          </div>
        ) : null}
      </section>

      {setup ? (
        <PodcastSetup
          heading="Folgen herunterladen"
          cover={cover}
          title={podcast.metadata.title}
          author={podcast.metadata.author ?? undefined}
          feed={setup.feed}
          loading={setup.loading}
          error={setup.error}
          existing={setup.existing}
          selected={setup.selected}
          onToggle={toggleEpisode}
          onSelectAll={() => selectAll(true)}
          onSelectNone={() => selectAll(false)}
          autoDownload={setup.autoDownload}
          onAutoDownload={(value) =>
            setSetup((current) => (current ? { ...current, autoDownload: value } : current))
          }
          busy={saving}
          confirmLabel={
            chosenCount
              ? `${chosenCount} ${chosenCount === 1 ? 'Folge' : 'Folgen'} herunterladen`
              : autoChanged
                ? 'Einstellungen speichern'
                : 'Schließen'
          }
          onConfirm={() => void confirmDownloads()}
          onClose={() => setSetup(null)}
        />
      ) : null}

      {options ? (
        <PodcastOptions
          item={item}
          podcast={podcast}
          onClose={() => setOptions(false)}
          onDownload={() => {
            setOptions(false)
            void openDownloads()
          }}
          onSaved={() => setRefresh((n) => n + 1)}
          onDeleted={() => go({ name: 'podcasts' })}
        />
      ) : null}
    </div>
  )
}
