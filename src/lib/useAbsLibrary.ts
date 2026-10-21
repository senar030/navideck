import { useMemo } from 'react'
import type { AbsAuthor, AbsCollection, AbsEpisode, AbsLibraryItem, AbsSeries } from '../api/abs'
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

/** Every episode of every show, each still pointing at the show it belongs to. */
export function useAllEpisodes(): AsyncState<EpisodeRef[]> {
  const { abs } = useAccount()
  const library = abs?.podcasts ?? null
  const client = abs?.client ?? null
  const shows = useAsync(
    library && client
      ? () =>
          cached(cacheKey(client.baseUrl, 'podcast-shows', library.id), MINUTE, () =>
            client.getItems(library.id, {}),
          )
      : null,
    [client, library?.id],
  )

  const data = useMemo<EpisodeRef[] | null>(() => {
    if (!shows.data) return null
    const list: EpisodeRef[] = []
    for (const item of shows.data) {
      for (const episode of podcastOf(item).episodes ?? []) {
        list.push({ item, episode: { ...episode, libraryItemId: episode.libraryItemId || item.id } })
      }
    }
    return list
  }, [shows.data])

  return { ...shows, data }
}
