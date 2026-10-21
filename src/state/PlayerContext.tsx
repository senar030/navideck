import { createContext, useContext } from 'react'
import type { Song } from '../api/types'
import type { RadioNow } from '../lib/radioNow'

export type RepeatMode = 'off' | 'all' | 'one'

type PlayerContextValue = {
  queue: Song[]
  index: number
  current: Song | undefined
  playing: boolean
  /**
   * The track a radio stream reports as on air. Only ever set for a live
   * stream, and only while it is playing: it is polled, not stored.
   */
  radioNow: RadioNow | null
  shuffle: boolean
  repeat: RepeatMode
  volume: number
  muted: boolean
  /** False on iOS, where the app cannot change the level at all. */
  volumeSupported: boolean
  currentTime: number
  duration: number
  queueOpen: boolean
  expanded: boolean
  playTracks: (tracks: Song[], startIndex?: number) => void
  addToQueue: (tracks: Song[]) => void
  playNext: (tracks: Song[]) => void
  togglePlay: () => void
  next: () => void
  prev: () => void
  seek: (time: number) => void
  setVolume: (v: number) => void
  toggleMute: () => void
  toggleShuffle: () => void
  cycleRepeat: () => void
  playIndex: (i: number) => void
  removeFromQueue: (i: number) => void
  reorderQueue: (songs: Song[]) => void
  setQueueOpen: (open: boolean) => void
  setExpanded: (open: boolean) => void
  toggleStar: () => void
}

/*
 * The context, its value type and the hook live apart from the provider that
 * fills them, so editing the provider does not invalidate every module that
 * only ever calls `usePlayer`.
 */
export const PlayerContext = createContext<PlayerContextValue | null>(null)

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext)
  if (!ctx) throw new Error('usePlayer must be used inside PlayerProvider')
  return ctx
}
