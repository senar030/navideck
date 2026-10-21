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
import { useAccount } from '../state/AccountContext'
import { useNav } from '../state/NavContext'
import { CoverArt } from './CoverArt'
import { IconPlay, IconPodcast, IconRefresh } from './Icons'

/* --------------------------------------------------------------- building blocks */

export function AbsCover({ src, alt = '', size = 400, className = '' }: { src?: string; alt?: string; size?: number; className?: string }) {
  return <CoverArt src={src} alt={alt} size={size} className={className} />
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

type SortOption<T extends string> = { id: T; label: string }

export function SortChips<T extends string>({
  options,
  value,
  desc,
  onChange,
  onDesc,
  ascLabel,
  descLabel,
  children,
}: {
  options: SortOption<T>[]
  value: T
  desc: boolean
  onChange: (value: T) => void
  /** Omit to hide the direction chip, e.g. when every option has its own order. */
  onDesc?: () => void
  ascLabel: string
  descLabel: string
  /** Controls that belong beside the sort chips, e.g. the layout toggle. */
  children?: ReactNode
}) {
  return (
    <div className="view-head-tools">
      <div className="chip-row">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`chip ${value === option.id ? 'is-on' : ''}`}
            onClick={() => onChange(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
      {onDesc ? (
        <button
          type="button"
          className={`chip ${desc ? 'is-on' : ''}`}
          aria-label="Sortierrichtung umdrehen"
          onClick={onDesc}
        >
          {desc ? descLabel : ascLabel}
        </button>
      ) : null}
      {children}
    </div>
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
        <span className="album-name">{book.metadata.title}</span>
        <span className="album-artist">{book.metadata.authorName || 'Unbekannte Autorin'}</span>
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
  const { abs } = useAccount()
  const podcast = podcastOf(item)
  const count = podcast.numEpisodes ?? podcast.episodes?.length ?? 0
  return (
    <article className="album-card abs-card">
      <button type="button" className="album-hit" onClick={onOpen}>
        <AbsCover src={abs?.client.coverUrl(item.id)} alt="" />
        <span className="album-name">{podcast.metadata.title}</span>
        <span className="album-artist">
          {count ? `${count} ${count === 1 ? 'Folge' : 'Folgen'}` : podcast.metadata.author || 'Podcast'}
        </span>
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
        <strong>{author.name}</strong>
        <em>
          {author.numBooks ?? 0} {(author.numBooks ?? 0) === 1 ? 'Buch' : 'Bücher'}
        </em>
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
            : 'Verbinde unter „Konto & Server“ einen Audiobookshelf-Server.'
        }
        action={
          <button type="button" className="primary-btn" onClick={() => go({ name: 'account' })}>
            Konto &amp; Server
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
  const { abs } = useAccount()
  const title = podcastOf(item).metadata.title
  const entry = progressOf(progress, item.id, episode.id)
  const share = heardShare(entry)
  const facts = [episodeNumber(episode), formatDate(episodeTime(episode)), formatHours(episodeDuration(episode))]
    .filter(Boolean)
    .join(' · ')
  return (
    <article className="episode-row">
      <AbsCover src={abs?.client.coverUrl(item.id)} alt="" size={120} className="episode-art" />
      <button type="button" className="episode-text" onClick={onPlay}>
        <strong>{episode.title}</strong>
        <span className="muted">{facts}</span>
        <span className="episode-pod">{title}</span>
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
        <span className="album-name">{collection.name}</span>
        <span className="album-artist">
          {books.length} {books.length === 1 ? 'Buch' : 'Bücher'}
        </span>
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
        <span className="album-name">{series.name}</span>
        <span className="album-artist">
          {books.length} {books.length === 1 ? 'Band' : 'Bände'}
        </span>
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
  const { abs, progress } = useAccount()
  const show = podcastOf(item).metadata.title
  const share = heardShare(progressOf(progress, item.id, episode.id))
  return (
    <article className="album-card abs-card">
      <button type="button" className="album-hit" onClick={onOpen}>
        <AbsCover src={abs?.client.coverUrl(item.id)} alt="" />
        <span className="album-name">{episode.title}</span>
        <span className="album-artist">
          {show}
          {episodeTime(episode) ? ` · ${formatDate(episodeTime(episode))}` : ''}
        </span>
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
