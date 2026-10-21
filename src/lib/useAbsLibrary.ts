import { useMemo } from 'react'
import type {
  AbsAuthor,
  AbsClient,
  AbsCollection,
  AbsEpisode,
  AbsLibraryItem,
  AbsSeries,
} from '../api/abs'
import { cached } from './absCache'
import { podcastOf } from './absHelpers'
import { useAsync, type AsyncState } from './useAsync'
import { useAccount } from '../state/AccountContext'

/*
 * The reads every Audiobookshelf view shares. They all answer the same way:
 * nothing (no server, no library), something cached, or an error worth showing.
 */

const MINUTE = 60_000

export type EpisodeRef = { item: AbsLibraryItem; episode: AbsEpisode }

function cacheKey(baseUrl: string, kind: string, libraryId: string): string {
  return `${baseUrl}|${kind}|${libraryId}`
}

export function useBookItems(): AsyncState<AbsLibraryItem[]> {
  const { abs } = useAccount()
  const library = abs?.books ?? null
  const client = abs?.client ?? null
  return useAsync(
    library && client
      ? () =>
          cached(cacheKey(client.baseUrl, 'books', library.id), MINUTE, () =>
            client.getItems(library.id, { minified: true }),
          )
      : null,
    [client, library?.id],
  )
}

export function useAuthorList(): AsyncState<AbsAuthor[]> {
  const { abs } = useAccount()
  const library = abs?.books ?? null
  const client = abs?.client ?? null
  return useAsync(
    library && client
      ? () =>
          cached(cacheKey(client.baseUrl, 'authors', library.id), 10 * MINUTE, () =>
            client.getAuthors(library.id),
          )
      : null,
    [client, library?.id],
  )
}

export function useCollectionList(): AsyncState<AbsCollection[]> {
  const { abs } = useAccount()
  const library = abs?.books ?? null
  const client = abs?.client ?? null
  return useAsync(
    library && client
      ? () =>
          cached(cacheKey(client.baseUrl, 'collections', library.id), 5 * MINUTE, () =>
            client.getCollections(library.id),
          )
      : null,
    [client, library?.id],
  )
}

export function useSeriesList(): AsyncState<AbsSeries[]> {
  const { abs } = useAccount()
  const library = abs?.books ?? null
  const client = abs?.client ?? null
  return useAsync(
    library && client
      ? () =>
          cached(cacheKey(client.baseUrl, 'series', library.id), 5 * MINUTE, () =>
            client.getSeries(library.id),
          )
      : null,
    [client, library?.id],
  )
}

/** Podcast shows without their episodes — enough for a list of cards. */
export function usePodcastItems(): AsyncState<AbsLibraryItem[]> {
  const { abs } = useAccount()
  const library = abs?.podcasts ?? null
  const client = abs?.client ?? null
  return useAsync(
    library && client
      ? () =>
          cached(cacheKey(client.baseUrl, 'podcasts', library.id), MINUTE, () =>
            client.getItems(library.id, { minified: true }),
          )
      : null,
    [client, library?.id],
  )
}

/** A show rebuilt from the copy the recent-episodes endpoint attaches. */
function showOf(episode: AbsEpisode): AbsLibraryItem | null {
  const podcast = episode.podcast
  if (!podcast?.metadata) return null
  return {
    id: episode.libraryItemId,
    libraryId: episode.libraryId ?? '',
    mediaType: 'podcast',
    addedAt: episode.addedAt ?? 0,
    updatedAt: episode.addedAt ?? 0,
    media: podcast,
  }
}

/**
 * The newest unfinished episodes across all shows — one request, already in
 * order. The item list is no way to get them: every library listing comes back
 * minified, and a minified podcast carries the number of episodes but not the
 * episodes themselves.
 */
export function useRecentEpisodes(limit = 24): AsyncState<EpisodeRef[]> {
  const { abs } = useAccount()
  const library = abs?.podcasts ?? null
  const client = abs?.client ?? null
  const shows = usePodcastItems()
  const recent = useAsync(
    library && client
      ? () =>
          cached(
            `${cacheKey(client.baseUrl, 'recent-episodes', library.id)}|${limit}`,
            MINUTE,
            () => client.getRecentEpisodes(library.id, { limit }),
          )
      : null,
    [client, library?.id, limit],
  )

  const data = useMemo<EpisodeRef[] | null>(() => {
    if (!recent.data) return null
    const byId = new Map((shows.data ?? []).map((item) => [item.id, item]))
    const list: EpisodeRef[] = []
    for (const episode of recent.data) {
      const item = byId.get(episode.libraryItemId) ?? showOf(episode)
      if (item) list.push({ item, episode })
    }
    return list
  }, [recent.data, shows.data])

  return { ...recent, data }
}

/**
 * Every episode of every show. There is no endpoint for that, so the shows are
 * asked one after another — four at a time, because each answer carries all of
 * its episodes. Answers are cached, so opening a show afterwards costs nothing.
 */
export function useAllEpisodes(): AsyncState<EpisodeRef[]> {
  const { abs } = useAccount()
  const client = abs?.client ?? null
  const shows = usePodcastItems()

  const ids = useMemo(() => (shows.data ?? []).map((item) => item.id), [shows.data])
  const details = useAsync(client && ids.length ? () => loadShows(client, ids) : null, [
    client,
    ids.join('|'),
  ])

  const data = useMemo<EpisodeRef[] | null>(() => {
    if (!details.data) return null
    const list: EpisodeRef[] = []
    for (const item of details.data) {
      for (const episode of podcastOf(item).episodes ?? []) {
        list.push({ item, episode: { ...episode, libraryItemId: episode.libraryItemId || item.id } })
      }
    }
    return list
  }, [details.data])

  return { ...details, data }
}

/** The shows the user is in the middle of an episode of, with that episode. */
export function useProgressEpisodes(): AsyncState<EpisodeRef[]> {
  const { abs, progress } = useAccount()
  const library = abs?.podcasts ?? null
  const client = abs?.client ?? null

  const entries = useMemo(
    () =>
      Object.values(progress)
        .filter((entry) => entry.episodeId && !entry.isFinished && (entry.currentTime ?? 0) > 5)
        .sort((a, b) => (b.lastUpdate ?? 0) - (a.lastUpdate ?? 0))
        .slice(0, 12),
    [progress],
  )
  const ids = useMemo(
    () => [...new Set(entries.map((entry) => entry.libraryItemId))],
    [entries],
  )
  const shows = useAsync(
    client && library && ids.length ? () => loadShows(client, ids) : null,
    [client, library?.id, ids.join('|')],
  )

  const data = useMemo<EpisodeRef[] | null>(() => {
    if (!shows.data) return null
    const byId = new Map(shows.data.map((item) => [item.id, item]))
    const list: EpisodeRef[] = []
    for (const entry of entries) {
      const item = byId.get(entry.libraryItemId)
      if (!item) continue
      const episode = podcastOf(item).episodes?.find((candidate) => candidate.id === entry.episodeId)
      if (episode) list.push({ item, episode })
    }
    return list
  }, [shows.data, entries])

  return { ...shows, data }
}

async function loadShows(client: AbsClient, ids: string[]): Promise<AbsLibraryItem[]> {
  const queue = [...ids]
  const items: AbsLibraryItem[] = []
  const worker = async () => {
    for (;;) {
      const id = queue.shift()
      if (!id) return
      try {
        items.push(await cached(`${client.baseUrl}|item|${id}`, 5 * MINUTE, () => client.getItem(id)))
      } catch {
        // One broken show must not hide all the others.
      }
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker))
  return items
}
