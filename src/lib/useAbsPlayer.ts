import { useCallback } from 'react'
import type { AbsEpisode, AbsLibraryItem } from '../api/abs'
import { bookOf, progressOf } from './absHelpers'
import { bookQueue, episodeSong } from './absPlay'
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
    async (item: AbsLibraryItem, episode: AbsEpisode) => {
      const client = podcasts?.client
      if (!client) return
      const saved = progressOf(progress, item.id, episode.id)
      const at = saved && !saved.isFinished ? (saved.currentTime ?? 0) : 0
      const song = episodeSong(client, item, episode, at)
      if (song) playTracks([song], 0)
    },
    [podcasts, playTracks, progress],
  )

  return { playBook, playBookAt, playEpisode }
}
