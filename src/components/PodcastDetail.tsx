import { useMemo, useState } from 'react'
import type { AbsEpisode, AbsFeedPodcast } from '../api/abs'
import { episodeSong } from '../lib/absPlay'
import {
  episodeDuration,
  episodeNumber,
  episodeTime,
  formatDate,
  formatHours,
  heardShare,
  podcastOf,
  progressOf,
  sortEpisodes,
} from '../lib/absHelpers'
import { useAbsPlayer } from '../lib/useAbsPlayer'
import { useAsync } from '../lib/useAsync'
import { stripHtml } from '../lib/format'
import { episodeKey, sortFeed } from '../lib/podcastFeed'
import { useAccount } from '../state/AccountContext'
import { episodeView, useNav } from '../state/NavContext'
import { usePlayer } from '../state/PlayerContext'
import { AbsCover, EpisodeRow, MissingAbs, Notice } from './AbsParts'
import { IconPlus, IconQueue, IconRefresh, IconSettings } from './Icons'
import { PlayGlyph } from './PlayGlyph'
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

  /* The hero continues the episode this listener left unfinished. */
  let resumeEpisode: AbsEpisode | null = null
  let latestProgress = 0
  for (const episode of episodes) {
    const entry = progressOf(progress, id, episode.id)
    if (!entry || entry.isFinished) continue
    const at = entry.currentTime ?? 0
    if (at <= 0) continue
    if ((entry.lastUpdate ?? 0) >= latestProgress) {
      latestProgress = entry.lastUpdate ?? 0
      resumeEpisode = episode
    }
  }
  const listenEpisode = resumeEpisode ?? latest
  const listenEntry = listenEpisode ? progressOf(progress, id, listenEpisode.id) : undefined
  const canResume = Boolean(
    resumeEpisode && listenEntry && !listenEntry.isFinished && (listenEntry.currentTime ?? 0) > 0,
  )
  const listenShare = heardShare(listenEntry)
  const percent = Math.min(100, Math.max(0, Math.round(listenShare * 100)))
  const listenLeft =
    listenEpisode && listenEntry
      ? Math.max(0, (listenEntry.duration ?? episodeDuration(listenEpisode)) - (listenEntry.currentTime ?? 0))
      : 0

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
              {listenEpisode ? (
                <button
                  type="button"
                  className={`primary-btn abs-listen ${canResume ? 'has-progress' : ''}`}
                  onClick={() => void playEpisode(item, listenEpisode)}
                >
                  <PlayGlyph size={22} />
                  <span className="abs-listen-copy">
                    <span className="abs-listen-title">{canResume ? 'Weiterhören' : 'Neueste Folge'}</span>
                    {canResume ? (
                      <span className="abs-listen-meta">
                        {percent} % · noch {formatHours(listenLeft)}
                      </span>
                    ) : null}
                  </span>
                  {canResume ? (
                    <span className="abs-listen-bar" aria-hidden>
                      <span style={{ width: `${percent}%` }} />
                    </span>
                  ) : null}
                </button>
              ) : null}
              {canResume && listenEpisode ? (
                <button
                  type="button"
                  className="icon-btn abs-restart"
                  aria-label="Von vorn abspielen"
                  data-tip="Von vorn"
                  onClick={() => void playEpisode(item, listenEpisode, 0)}
                >
                  <IconRefresh size={20} />
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
              onOpen={() => go(episodeView(item.id, episode.id))}
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

/* --------------------------------------------------------------- one episode */

export function PodcastEpisodeDetail({ id }: { id: string }) {
  const [itemId, episodeId] = id.split(':', 2)
  const { podcasts, progress } = useAccount()
  const { playEpisode } = useAbsPlayer()
  const { addToQueue } = usePlayer()
  const { go } = useNav()
  const [queued, setQueued] = useState(false)
  const client = podcasts?.client ?? null
  const result = useAsync(client && itemId ? () => client.getItem(itemId) : null, [client, itemId])

  const item = result.data
  const podcast = item ? podcastOf(item) : null

  if (!podcasts || !client) return <MissingAbs noun="Podcast" />
  if (result.error) return <p className="error">{result.error}</p>
  if (!item || !podcast) return <p className="muted">Folge wird geladen …</p>

  const episode = podcast.episodes?.find((candidate) => candidate.id === episodeId) ?? null
  if (!episode) {
    return (
      <Notice
        title="Folge nicht gefunden"
        action={
          <button type="button" className="primary-btn ghost" onClick={() => go({ name: 'podcast', id: itemId })}>
            Zur Sendung
          </button>
        }
      />
    )
  }

  const cover = client.coverUrl(item.id)
  const title = podcast.metadata.title
  const entry = progressOf(progress, item.id, episode.id)
  const share = heardShare(entry)
  const canResume = Boolean(entry && !entry.isFinished && (entry.currentTime ?? 0) > 0)
  const percent = Math.min(100, Math.max(0, Math.round(share * 100)))
  const total = episodeDuration(episode) || entry?.duration || 0
  const left = Math.max(0, (entry?.duration ?? total) - (entry?.currentTime ?? 0))
  const facts = [episodeNumber(episode), formatDate(episodeTime(episode)), formatHours(total)]
    .filter(Boolean)
    .join(' · ')
  const description = episode.description ? stripHtml(episode.description) : ''
  const song = episodeSong(client, item, episode, 0)

  function queueEpisode() {
    if (!song) return
    addToQueue([song])
    setQueued(true)
  }

  return (
    <div className="view detail abs-detail">
      <div className="hero-banner">
        <img className="hero-bg" src={cover} alt="" />
        <div className="hero-veil" />
        <div className="hero">
          <AbsCover src={cover} className="hero-cover" />
          <div className="hero-copy">
            <p className="eyebrow">{title}</p>
            <h2>{episode.title}</h2>
            {episode.subtitle ? <p className="hero-sub">{episode.subtitle}</p> : null}
            {facts ? <p className="hero-facts muted">{facts}</p> : null}
            {podcast.metadata.author ? <p className="hero-meta muted">{podcast.metadata.author}</p> : null}
            <div className="hero-actions">
              <button
                type="button"
                className={`primary-btn abs-listen ${canResume ? 'has-progress' : ''}`}
                onClick={() => void playEpisode(item, episode)}
              >
                <PlayGlyph size={22} match={(current) => current.abs?.episodeId === episode.id} />
                <span className="abs-listen-copy">
                  <span className="abs-listen-title">{canResume ? 'Weiterhören' : 'Abspielen'}</span>
                  {canResume ? (
                    <span className="abs-listen-meta">
                      {percent} % · noch {formatHours(left)}
                    </span>
                  ) : null}
                </span>
                {canResume ? (
                  <span className="abs-listen-bar" aria-hidden>
                    <span style={{ width: `${percent}%` }} />
                  </span>
                ) : null}
              </button>
              {canResume ? (
                <button
                  type="button"
                  className="icon-btn abs-restart"
                  aria-label="Von vorn abspielen"
                  data-tip="Von vorn"
                  onClick={() => void playEpisode(item, episode, 0)}
                >
                  <IconRefresh size={20} />
                </button>
              ) : null}
              <button type="button" className="chip" onClick={queueEpisode} disabled={!song}>
                <IconQueue size={16} /> In Warteschlange
              </button>
            </div>
            {queued ? <p className="muted abs-queued">Zur Warteschlange hinzugefügt.</p> : null}
          </div>
        </div>
      </div>

      <section className="abs-section">
        <h3>Show notes</h3>
        {description ? (
          <p className="abs-description">{description}</p>
        ) : (
          <p className="muted">Diese Folge hat keine Show notes.</p>
        )}
      </section>

      <section className="abs-section">
        <button type="button" className="text-btn" onClick={() => go({ name: 'podcast', id: item.id })}>
          Alle Folgen von „{title}“
        </button>
      </section>
    </div>
  )
}
