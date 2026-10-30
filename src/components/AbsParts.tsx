import type { ReactNode } from 'react'
import type { AbsAuthor, AbsCollection, AbsEpisode, AbsLibraryItem, AbsProgress, AbsSeries } from '../api/abs'
import {
  bookOf,
  episodeDuration,
  episodeNumber,
  episodeTime,
  formatDate,
  formatHours,
  heardShare,
  podcastOf,
  progressOf,
} from '../lib/absHelpers'
import { stripHtml } from '../lib/format'
import { useAccount } from '../state/AccountContext'
import { useNav } from '../state/NavContext'
import { CoverArt } from './CoverArt'
import { IconPlay, IconPodcast, IconRefresh } from './Icons'
import { MarqueeText } from './MarqueeText'

/* --------------------------------------------------------------- building blocks */

export function AbsCover({ src, alt = '', size = 400, className = '' }: { src?: string; alt?: string; size?: number; className?: string }) {
  return <CoverArt src={src} alt={alt} size={size} className={`abs-art ${className}`.trim()} />
}

export function ProgressBar({ value, className = '' }: { value: number; className?: string }) {
  if (!(value > 0)) return null
  return (
    <span className={`abs-bar ${className}`} aria-hidden>
      <span style={{ width: `${Math.round(Math.min(1, value) * 100)}%` }} />
    </span>
  )
}

export function Notice({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="abs-notice">
      <p className="abs-notice-title">{title}</p>
      {text ? <p className="muted">{text}</p> : null}
      {action}
    </div>
  )
}

export function Shelf({
  title,
  hint,
  action,
  children,
}: {
  title: string
  hint?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="abs-shelf">
      <header className="abs-shelf-head">
        <h3>{title}</h3>
        {hint ? <span className="muted abs-shelf-hint">{hint}</span> : null}
        {action}
      </header>
      <div className="abs-shelf-row">{children}</div>
    </section>
  )
}

/** A heading button that reshuffles a strip. */
export function ShuffleButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="icon-btn abs-shuffle"
      aria-label="Neu mischen"
      data-tip="Neu mischen"
      onClick={onClick}
    >
      <IconRefresh size={18} />
    </button>
  )
}

/* ---------------------------------------------------------------------- cards */

export function BookCard({
  item,
  onOpen,
  onPlay,
}: {
  item: AbsLibraryItem
  onOpen: () => void
  /** Shown as a floating button, e.g. on a "Weiterhören" strip. */
  onPlay?: () => void
}) {
  const { abs, progress } = useAccount()
  const book = bookOf(item)
  const share = heardShare(progressOf(progress, item.id))
  return (
    <article className="album-card abs-card">
      <button type="button" className="album-hit" onClick={onOpen}>
        <AbsCover src={abs?.client.coverUrl(item.id)} alt="" />
        <MarqueeText className="album-name">{book.metadata.title}</MarqueeText>
        <MarqueeText className="album-artist">{book.metadata.authorName || 'Unbekannte Autorin'}</MarqueeText>
        <ProgressBar value={share} />
      </button>
      {onPlay ? (
        <button
          type="button"
          className="play-fab"
          aria-label={`${book.metadata.title} abspielen`}
          data-tip="Abspielen"
          onClick={onPlay}
        >
          <IconPlay size={24} />
        </button>
      ) : null}
    </article>
  )
}

export function PodcastCard({ item, onOpen }: { item: AbsLibraryItem; onOpen: () => void }) {
  const { podcasts } = useAccount()
  const podcast = podcastOf(item)
  const count = podcast.numEpisodes ?? podcast.episodes?.length ?? 0
  return (
    <article className="album-card abs-card">
      <button type="button" className="album-hit" onClick={onOpen}>
        <AbsCover src={podcasts?.client.coverUrl(item.id)} alt="" />
        <MarqueeText className="album-name">{podcast.metadata.title}</MarqueeText>
        <MarqueeText className="album-artist">
          {count ? `${count} ${count === 1 ? 'Folge' : 'Folgen'}` : podcast.metadata.author || 'Podcast'}
        </MarqueeText>
      </button>
    </article>
  )
}

export function AuthorCard({ author, onOpen }: { author: AbsAuthor; onOpen: () => void }) {
  const { abs } = useAccount()
  return (
    <button type="button" className="artist-row abs-author" onClick={onOpen}>
      <AbsCover src={abs?.client.authorImageUrl(author.id)} alt="" size={200} className="avatar" />
      <span>
        <MarqueeText className="artist-name">{author.name}</MarqueeText>
        <MarqueeText className="artist-count">
          {author.numBooks ?? 0} {(author.numBooks ?? 0) === 1 ? 'Buch' : 'Bücher'}
        </MarqueeText>
      </span>
    </button>
  )
}

/** Used when the account has no Audiobookshelf server, or no matching library. */
export function MissingAbs({ noun }: { noun: 'Hörbuch' | 'Podcast' }) {
  const { abs } = useAccount()
  const { go } = useNav()
  return (
    <div className="view">
      <Notice
        title={abs ? 'Nichts zu zeigen' : 'Noch kein Server'}
        text={
          abs
            ? `Der Server hat keine Bibliothek mit ${noun === 'Hörbuch' ? 'Hörbüchern' : 'Podcasts'}.`
            : 'Verbinde in den Einstellungen unter „Server & Konto“ einen Audiobookshelf-Server.'
        }
        action={
          <button type="button" className="primary-btn" onClick={() => go({ name: 'settings' })}>
            Einstellungen öffnen
          </button>
        }
      />
    </div>
  )
}

/* ------------------------------------------------------------------- lists */

export function EpisodeRow({
  episode,
  item,
  progress,
  onPlay,
  onOpen,
}: {
  episode: AbsEpisode
  /** The show the episode belongs to; it carries the name and the cover. */
  item: AbsLibraryItem
  progress: Record<string, AbsProgress>
  onPlay: () => void
  onOpen: () => void
}) {
  const { podcasts } = useAccount()
  const title = podcastOf(item).metadata.title
  const entry = progressOf(progress, item.id, episode.id)
  const share = heardShare(entry)
  const facts = [episodeNumber(episode), formatDate(episodeTime(episode)), formatHours(episodeDuration(episode))]
    .filter(Boolean)
    .join(' · ')
  return (
    <article className="episode-row">
      <AbsCover src={podcasts?.client.coverUrl(item.id)} alt="" size={120} className="episode-art" />
      <button type="button" className="episode-text" onClick={onPlay}>
        <MarqueeText className="episode-title">{episode.title}</MarqueeText>
        <MarqueeText className="episode-facts muted">{facts}</MarqueeText>
        <MarqueeText className="episode-pod">{title}</MarqueeText>
        {episode.description ? (
          <span className="episode-desc">{stripHtml(episode.description)}</span>
        ) : null}
        <ProgressBar value={share} />
      </button>
      <div className="episode-tools">
        <button type="button" className="icon-btn" aria-label={`${title} öffnen`} data-tip="Podcast" onClick={onOpen}>
          <IconPodcast size={18} />
        </button>
        <button type="button" className="icon-btn" aria-label={`${episode.title} abspielen`} data-tip="Abspielen" onClick={onPlay}>
          <IconPlay size={20} />
        </button>
      </div>
    </article>
  )
}

/* ------------------------------------------------------------- collections */

export function CollectionCard({
  collection,
  onOpen,
}: {
  collection: AbsCollection
  onOpen: () => void
}) {
  const { abs } = useAccount()
  const books = collection.books ?? []
  const first = books[0]
  return (
    <article className="album-card abs-card">
      <button type="button" className="album-hit" onClick={onOpen}>
        <AbsCover src={first ? abs?.client.coverUrl(first.id) : undefined} alt="" />
        <MarqueeText className="album-name">{collection.name}</MarqueeText>
        <MarqueeText className="album-artist">
          {books.length} {books.length === 1 ? 'Buch' : 'Bücher'}
        </MarqueeText>
      </button>
    </article>
  )
}

export function SeriesCard({ series, onOpen }: { series: AbsSeries; onOpen: () => void }) {
  const { abs } = useAccount()
  const books = series.books ?? []
  const first = books[0]
  return (
    <article className="album-card abs-card">
      <button type="button" className="album-hit" onClick={onOpen}>
        <AbsCover src={first ? abs?.client.coverUrl(first.id) : undefined} alt="" />
        <MarqueeText className="album-name">{series.name}</MarqueeText>
        <MarqueeText className="album-artist">
          {books.length} {books.length === 1 ? 'Band' : 'Bände'}
        </MarqueeText>
      </button>
    </article>
  )
}

/** A podcast episode as a card, for the horizontal strips on a start page. */
export function EpisodeCard({
  item,
  episode,
  onOpen,
  onPlay,
}: {
  item: AbsLibraryItem
  episode: AbsEpisode
  onOpen: () => void
  onPlay: () => void
}) {
  const { podcasts, progress } = useAccount()
  const show = podcastOf(item).metadata.title
  const share = heardShare(progressOf(progress, item.id, episode.id))
  return (
    <article className="album-card abs-card">
      <button type="button" className="album-hit" onClick={onOpen}>
        <AbsCover src={podcasts?.client.coverUrl(item.id)} alt="" />
        <MarqueeText className="album-name">{episode.title}</MarqueeText>
        <MarqueeText className="album-artist">
          {show}
          {episodeTime(episode) ? ` · ${formatDate(episodeTime(episode))}` : ''}
        </MarqueeText>
        {episode.description ? (
          <span className="album-desc">{stripHtml(episode.description)}</span>
        ) : null}
        <ProgressBar value={share} />
      </button>
      <button
        type="button"
        className="play-fab"
        aria-label={`${episode.title} abspielen`}
        data-tip="Abspielen"
        onClick={onPlay}
      >
        <IconPlay size={24} />
      </button>
    </article>
  )
}
