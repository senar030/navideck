import type { AbsBook, AbsClient, AbsEpisode, AbsLibraryItem } from '../api/abs'
import type { Song } from '../api/types'
import { trackAt } from './absHelpers'

/*
 * Turning Audiobookshelf media into queue entries. A book is one entry per
 * audio file: the player then advances through the book the same way it
 * advances through an album, and the position inside the book is the file's
 * start offset plus the time played.
 */

export type BookQueue = { songs: Song[]; startIndex: number }

export function bookQueue(client: AbsClient, item: AbsLibraryItem, resumeAt: number): BookQueue | null {
  const book = item.media as AbsBook
  const tracks = book.tracks ?? []
  if (!tracks.length) return null

  const offsets = tracks.map((track) => track.startOffset ?? 0)
  const cover = client.coverUrl(item.id)
  const startIndex = trackAt(offsets, resumeAt)
  const startAt = Math.max(0, resumeAt - offsets[startIndex])
  const songs: Song[] = tracks.map((track, i) => ({
    id: `${item.id}#${track.index ?? i}`,
    title: book.metadata.title,
    artist: book.metadata.authorName ?? 'Hörbuch',
    album: book.metadata.seriesName || undefined,
    duration: track.duration,
    startAt: i === startIndex && startAt > 0 ? startAt : undefined,
    abs: {
      itemId: item.id,
      url: client.streamUrl(track.contentUrl),
      startOffset: track.startOffset ?? 0,
      total: book.duration,
      track: i + 1,
      tracks: tracks.length,
      cover,
    },
  }))

  return { songs, startIndex }
}

export function episodeSong(
  client: AbsClient,
  item: AbsLibraryItem,
  episode: AbsEpisode,
  resumeAt = 0,
): Song | null {
  const track = episode.audioTrack
  if (!track?.contentUrl) return null
  const total = track.duration ?? episode.audioFile?.duration ?? 0
  return {
    id: `${item.id}#${episode.id}`,
    title: episode.title,
    artist: item.media.metadata.title,
    duration: total,
    abs: {
      itemId: item.id,
      episodeId: episode.id,
      url: client.streamUrl(track.contentUrl),
      startOffset: 0,
      total,
      cover: client.coverUrl(item.id),
    },
    startAt: Math.max(0, resumeAt),
  }
}
