import { formatTime } from './format'
import type { AbsBook, AbsEpisode, AbsLibraryItem, AbsPodcast, AbsProgress, AbsSeriesRef } from '../api/abs'

/*
 * Small, pure helpers for the Audiobookshelf side. They live apart from the
 * components so that a file full of components exports only components.
 */

export function bookOf(item: AbsLibraryItem): AbsBook {
  return item.media as AbsBook
}

export function podcastOf(item: AbsLibraryItem): AbsPodcast {
  return item.media as AbsPodcast
}

/** The series a book belongs to, whether the server sends one or a list. */
export function seriesOf(book: AbsBook): AbsSeriesRef | null {
  const value = book.metadata.series
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

/** The first author with an id, when the server sends author records. */
export function authorRefOf(book: AbsBook): { id: string; name: string } | null {
  return book.metadata.authors?.find((entry) => entry.id) ?? null
}

export function progressKey(itemId: string, episodeId?: string | null): string {
  return `${itemId}:${episodeId ?? ''}`
}

export function progressOf(
  progress: Record<string, AbsProgress>,
  itemId: string,
  episodeId?: string | null,
): AbsProgress | undefined {
  return progress[progressKey(itemId, episodeId)]
}

/** How much of a book or episode has been heard, 0…1, finished counts as full. */
export function heardShare(entry: AbsProgress | undefined): number {
  if (!entry) return 0
  if (entry.isFinished) return 1
  const total = entry.duration ?? 0
  if (!(total > 0)) return 0
  return Math.min(1, Math.max(0, (entry.currentTime ?? 0) / total))
}

export function formatHours(seconds: number | undefined): string {
  if (!seconds || !Number.isFinite(seconds) || seconds < 60) return formatTime(seconds)
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.round((seconds % 3600) / 60)
  if (!hours) return `${minutes} Min.`
  return minutes ? `${hours} Std. ${minutes} Min.` : `${hours} Std.`
}

export function formatDate(value: string | number | null | undefined): string {
  if (value == null) return ''
  const time = typeof value === 'number' ? value : Date.parse(value)
  if (!Number.isFinite(time)) return ''
  return new Date(time).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function episodeTime(episode: AbsEpisode): number {
  if (typeof episode.publishedAt === 'number') return episode.publishedAt
  if (episode.pubDate) {
    const parsed = Date.parse(episode.pubDate)
    if (Number.isFinite(parsed)) return parsed
  }
  return episode.addedAt ?? 0
}

export function episodeDuration(episode: AbsEpisode): number {
  return episode.audioTrack?.duration ?? episode.audioFile?.duration ?? 0
}

export function episodeNumber(episode: AbsEpisode): string {
  const season = episode.season?.trim()
  const number = episode.episode?.trim()
  if (season && number) return `S${season} F${number}`
  if (number) return `Folge ${number}`
  return ''
}

/* ------------------------------------------------------------------ sorting */

export type BookSort = 'title' | 'author' | 'added' | 'duration' | 'year'
export type PodcastSort = 'title' | 'added' | 'episodes'
export type EpisodeSort = 'newest' | 'oldest' | 'duration' | 'title'

function text(value: string | null | undefined): string {
  return value ?? ''
}

function byText(a: string, b: string): number {
  return a.localeCompare(b, 'de', { sensitivity: 'base', numeric: true })
}

function order(value: number, desc: boolean): number {
  return desc ? -value : value
}

export function sortBooks(list: AbsLibraryItem[], sort: BookSort, desc: boolean): AbsLibraryItem[] {
  const copy = [...list]
  copy.sort((a, b) => {
    const left = bookOf(a).metadata
    const right = bookOf(b).metadata
    if (sort === 'author') {
      return order(byText(text(left.authorName), text(right.authorName)), desc) || byText(left.title, right.title)
    }
    if (sort === 'added') return order(a.addedAt - b.addedAt, desc)
    if (sort === 'duration') return order((bookOf(a).duration ?? 0) - (bookOf(b).duration ?? 0), desc)
    if (sort === 'year') {
      return order(Number(left.publishedYear ?? 0) - Number(right.publishedYear ?? 0), desc)
    }
    return order(byText(left.title, right.title), desc)
  })
  return copy
}

export function sortPodcasts(list: AbsLibraryItem[], sort: PodcastSort, desc: boolean): AbsLibraryItem[] {
  const copy = [...list]
  copy.sort((a, b) => {
    const left = podcastOf(a).metadata
    const right = podcastOf(b).metadata
    if (sort === 'added') return order(a.addedAt - b.addedAt, desc)
    if (sort === 'episodes') {
      return order((podcastOf(a).numEpisodes ?? 0) - (podcastOf(b).numEpisodes ?? 0), desc)
    }
    return order(byText(left.title, right.title), desc)
  })
  return copy
}

function compareEpisodes(a: AbsEpisode, b: AbsEpisode, sort: EpisodeSort, desc: boolean): number {
  if (sort === 'duration') return order(episodeDuration(a) - episodeDuration(b), desc)
  if (sort === 'title') return order(byText(a.title, b.title), desc)
  if (sort === 'oldest') return order(episodeTime(a) - episodeTime(b), desc)
  // "newest" starts descending on its own, so the direction flips it.
  return order(episodeTime(a) - episodeTime(b), !desc)
}

export function sortEpisodes(list: AbsEpisode[], sort: EpisodeSort, desc: boolean): AbsEpisode[] {
  const copy = [...list]
  copy.sort((a, b) => compareEpisodes(a, b, sort, desc))
  return copy
}

/** The same order, for episodes that still know which show they belong to. */
export function sortEpisodeRefs<T extends { episode: AbsEpisode }>(
  list: T[],
  sort: EpisodeSort,
  desc: boolean,
): T[] {
  const copy = [...list]
  copy.sort((a, b) => compareEpisodes(a.episode, b.episode, sort, desc))
  return copy
}

/**
 * A shuffled selection. `salt` lets a caller ask for a different draw from the
 * same list — the strip rotates once each time the number changes. The draw is
 * deterministic for a given salt, so a remounted strip keeps the same items.
 */
export function pickRandom<T>(list: T[], count: number, salt = 0): T[] {
  if (list.length <= count) return [...list]
  const copy = [...list]
  const random = seededRandom(salt)
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    const tmp = copy[i]
    copy[i] = copy[j]
    copy[j] = tmp
  }
  const offset = salt % copy.length
  const rotated = offset ? [...copy.slice(offset), ...copy.slice(0, offset)] : copy
  return rotated.slice(0, count)
}

/** Small deterministic PRNG (mulberry32); the same salt always draws the same. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Where a book's stored position falls inside its list of tracks. */
export function trackAt(offsets: number[], seconds: number): number {
  let found = 0
  for (let i = 0; i < offsets.length; i++) {
    if (offsets[i] <= seconds) found = i
    else break
  }
  return found
}
