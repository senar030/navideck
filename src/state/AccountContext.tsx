import { createContext, useContext } from 'react'
import type { AbsClient, AbsLibrary, AbsProgress, AbsUser } from '../api/abs'

/*
 * The account is the list of servers this app talks to. It lives on the device:
 * a static app has nowhere to keep a user record, and the servers already own
 * the media and the listening progress.
 */

export type SourceHealth = { status: 'checking' | 'ok' | 'error'; error?: string }

type SourceBase = {
  id: string
  /** What the account calls this server, e.g. "Musik" or "Hörbücher". */
  name: string
  baseUrl: string
  username: string
}

export type NavidromeSource = SourceBase & {
  kind: 'navidrome'
  password: string
}

/**
 * Any other Subsonic server — Nextcloud Music, Airsonic, Gonic, Supysonic.
 * Nextcloud hands out a separate "API password" in its Music settings; that is
 * what this stores, never the login password.
 */
export type SubsonicSource = SourceBase & {
  kind: 'subsonic'
  password: string
}

export type MusicSource = NavidromeSource | SubsonicSource

export type AbsSource = SourceBase & {
  kind: 'audiobookshelf'
  /** The server's own token; the password is never stored. */
  token: string
  userId: string
}

export type Source = MusicSource | AbsSource

export type NewSource =
  | { kind: 'navidrome'; server: string; username: string; password: string; name?: string }
  | { kind: 'subsonic'; server: string; username: string; password: string; name?: string }
  | { kind: 'audiobookshelf'; server: string; username: string; password: string; name?: string }

/** Both kinds speak Subsonic and fill the same music area. */
export function isMusicSource(source: Source): source is MusicSource {
  return source.kind === 'navidrome' || source.kind === 'subsonic'
}

/** An Audiobookshelf server that has answered, with the libraries it offers. */
export type AbsSession = {
  source: AbsSource
  client: AbsClient
  user: AbsUser | null
  libraries: AbsLibrary[]
  books: AbsLibrary | null
  podcasts: AbsLibrary | null
}

/** One progress entry, keyed by item and episode. */
export type ProgressInput = {
  itemId: string
  episodeId?: string
  currentTime: number
  duration: number
  isFinished?: boolean
}

export type AccountContextValue = {
  profile: string
  setProfile: (name: string) => void
  sources: Source[]
  health: Record<string, SourceHealth>
  /** The music server the music side uses, whichever kind it is. */
  music: MusicSource | null
  abs: AbsSession | null
  /** Listening progress on the Audiobookshelf server, by item and episode. */
  progress: Record<string, AbsProgress>
  /** Remembers progress the player just reported, without waiting for a reload. */
  noteProgress: (input: ProgressInput) => void
  /** True once every stored server has been tried at least once. */
  ready: boolean
  addSource: (input: NewSource) => Promise<void>
  removeSource: (id: string) => void
  checkSource: (id: string) => void
  renameSource: (id: string, name: string) => void
}

export const AccountContext = createContext<AccountContextValue | null>(null)

export function useAccount(): AccountContextValue {
  const ctx = useContext(AccountContext)
  if (!ctx) throw new Error('useAccount must be used inside AccountProvider')
  return ctx
}

/** Stable enough for a local list of servers, and works on plain http too. */
export function newId(): string {
  return `src_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`
}
