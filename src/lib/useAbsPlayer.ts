import { useCallback } from 'react'
import type { AbsEpisode, AbsLibraryItem } from '../api/abs'
import type { Song } from '../api/types'
import { bookOf, progressOf } from './absHelpers'
import { bookQueue, episodeSong } from './absPlay'
import type { EpisodeRef } from './useAbsLibrary'
import { useAccount } from '../state/AccountContext'
import { usePlayer } from '../state/PlayerContext'

/**
 * Playing something from Audiobookshelf: the queue is built from the item, the
 * position comes from the progress the server already knows. Everything else
 * (the bar, the deck, the media session) is the player the app always had.
 */
export function useAbsPlayer() {
  const { abs, podcasts, progress } = useAccount()
  const { playTracks } = usePlayer()

  const playBookAt = useCallback(
    async (item: AbsLibraryItem, seconds: number) => {
      if (!abs) return
      /*
       * A detail page already holds the expanded item, tracks included; only a
       * minified card needs the extra request. Refetching a large book for the
       * play button was the slow part of starting a book.
       */
      const full = bookOf(item).tracks?.length ? item : await abs.client.getItem(item.id)
      const queue = bookQueue(abs.client, full, seconds)
      if (queue) playTracks(queue.songs, queue.startIndex)
    },
    [abs, playTracks],
  )

  const playBook = useCallback(
    async (item: AbsLibraryItem) => {
      const saved = progressOf(progress, item.id)
      await playBookAt(item, saved && !saved.isFinished ? (saved.currentTime ?? 0) : 0)
    },
    [playBookAt, progress],
  )

  const playEpisode = useCallback(
    async (
      item: AbsLibraryItem,
      episode: AbsEpisode,
      at?: number,
      list?: EpisodeRef[],
    ) => {
      const client = podcasts?.client
      if (!client) return
      /*
       * An episode is always the start of a list, not a queue of its own: the
       * place it was picked from decides what plays afterwards. Every entry
       * resumes where the listener left it; only the chosen one may be
       * overridden (the "from the beginning" button).
       */
      const refs = list?.length ? list : [{ item, episode }]
      const songs: Song[] = []
      let startIndex = 0
      for (const ref of refs) {
        const chosen = ref.item.id === item.id && ref.episode.id === episode.id
        const saved = progressOf(progress, ref.item.id, ref.episode.id)
        const resume = saved && !saved.isFinished ? (saved.currentTime ?? 0) : 0
        const song = episodeSong(client, ref.item, ref.episode, chosen ? (at ?? resume) : resume)
        if (!song) continue
        if (chosen) startIndex = songs.length
        songs.push(song)
      }
      if (songs.length) playTracks(songs, startIndex)
    },
    [podcasts, playTracks, progress],
  )

  return { playBook, playBookAt, playEpisode }
}
