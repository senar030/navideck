import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AbsClient, absLogin, type AbsLibrary, type AbsProgress, type AbsUser } from '../api/abs'
import { NavidromeClient } from '../api/client'
import { normalizeServerUrl } from '../lib/format'
import {
  AccountContext,
  newId,
  type AbsSession,
  type AbsSource,
  type NavidromeSource,
  type NewSource,
  type ProgressInput,
  type Source,
  type SourceHealth,
} from './AccountContext'

const ACCOUNT_KEY = 'navideck.account.v1'
const LEGACY_KEY = 'navideck.auth'

type Account = { profile: string; sources: Source[] }

/** Progress arrives as a list; the app wants it by item and episode. */
function mergeProgress(
  current: Record<string, AbsProgress>,
  list: AbsProgress[] | undefined,
): Record<string, AbsProgress> {
  if (!list?.length) return current
  const next = { ...current }
  for (const entry of list) next[`${entry.libraryItemId}:${entry.episodeId ?? ''}`] = entry
  return next
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function save(account: Account) {
  try {
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account))
  } catch {
    /* a full quota must not break the app */
  }
}

/** Reads the account, taking over the single server older builds stored. */
function load(): Account {
  const stored = readJson<Account>(ACCOUNT_KEY)
  if (stored && Array.isArray(stored.sources)) {
    return { profile: stored.profile ?? '', sources: stored.sources.filter(Boolean) }
  }
  const legacy = readJson<{ baseUrl: string; username: string; password: string }>(LEGACY_KEY)
  if (legacy?.baseUrl) {
    const migrated: Account = {
      profile: legacy.username,
      sources: [
        {
          id: newId(),
          kind: 'navidrome',
          name: 'Navidrome',
          baseUrl: legacy.baseUrl,
          username: legacy.username,
          password: legacy.password,
        },
      ],
    }
    save(migrated)
    return migrated
  }
  return { profile: '', sources: [] }
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account>(load)
  const [health, setHealth] = useState<Record<string, SourceHealth>>({})
  const [libraries, setLibraries] = useState<Record<string, AbsLibrary[]>>({})
  const [users, setUsers] = useState<Record<string, AbsUser>>({})
  const [progress, setProgress] = useState<Record<string, AbsProgress>>({})
  /** Servers already asked this session; StrictMode runs effects twice. */
  const asked = useRef<Set<string>>(new Set())

  const commit = useCallback((next: Account) => {
    setAccount(next)
    save(next)
  }, [])

  const check = useCallback(
    async (source: Source) => {
      setHealth((h) => ({ ...h, [source.id]: { status: 'checking' } }))
      try {
        if (source.kind === 'navidrome') {
          await new NavidromeClient(source.baseUrl, source.username, source.password).ping()
        } else {
          const client = new AbsClient(source.baseUrl, source.token)
          const user = await client.getMe()
          const list = await client.getLibraries()
          setUsers((u) => ({ ...u, [source.id]: user }))
          setLibraries((l) => ({ ...l, [source.id]: list }))
          setProgress((p) => mergeProgress(p, user?.mediaProgress))
        }
        setHealth((h) => ({ ...h, [source.id]: { status: 'ok' } }))
      } catch (err) {
        setHealth((h) => ({
          ...h,
          [source.id]: { status: 'error', error: err instanceof Error ? err.message : 'Nicht erreichbar' },
        }))
      }
    },
    [],
  )

  useEffect(() => {
    for (const source of account.sources) {
      if (asked.current.has(source.id)) continue
      asked.current.add(source.id)
      void check(source)
    }
  }, [account.sources, check])

  const addSource = useCallback(
    async (input: NewSource) => {
      const server = normalizeServerUrl(input.server)
      if (!server) throw new Error('Bitte eine Server-Adresse angeben.')
      if (!input.username.trim()) throw new Error('Bitte einen Benutzernamen angeben.')

      let source: Source
      if (input.kind === 'navidrome') {
        const client = new NavidromeClient(server, input.username.trim(), input.password)
        await client.ping()
        source = {
          id: account.sources.find((s) => s.kind === 'navidrome')?.id ?? newId(),
          kind: 'navidrome',
          name: input.name?.trim() || 'Navidrome',
          baseUrl: server,
          username: input.username.trim(),
          password: input.password,
        } satisfies NavidromeSource
      } else {
        const login = await absLogin(server, input.username, input.password)
        const client = new AbsClient(login.baseUrl, login.token)
        const list = await client.getLibraries()
        const user = await client.getMe().catch(() => login.user)
        source = {
          id: account.sources.find((s) => s.kind === 'audiobookshelf')?.id ?? newId(),
          kind: 'audiobookshelf',
          name: input.name?.trim() || 'Audiobookshelf',
          baseUrl: login.baseUrl,
          username: login.user.username || input.username.trim(),
          token: login.token,
          userId: login.user.id,
        } satisfies AbsSource
        setLibraries((l) => ({ ...l, [source.id]: list }))
        setUsers((u) => ({ ...u, [source.id]: user }))
        setProgress((p) => mergeProgress(p, user?.mediaProgress))
      }

      asked.current.add(source.id)
      setHealth((h) => ({ ...h, [source.id]: { status: 'ok' } }))
      commit({
        ...account,
        profile: account.profile || input.username.trim(),
        sources: [...account.sources.filter((s) => s.kind !== source.kind), source],
      })
    },
    [account, commit],
  )

  const removeSource = useCallback(
    (id: string) => {
      asked.current.delete(id)
      setHealth((h) => {
        const next = { ...h }
        delete next[id]
        return next
      })
      setLibraries((l) => {
        const next = { ...l }
        delete next[id]
        return next
      })
      commit({ ...account, sources: account.sources.filter((s) => s.id !== id) })
    },
    [account, commit],
  )

  const renameSource = useCallback(
    (id: string, name: string) => {
      commit({
        ...account,
        sources: account.sources.map((s) => (s.id === id ? { ...s, name: name.trim() || s.name } : s)),
      })
    },
    [account, commit],
  )

  const setProfile = useCallback(
    (name: string) => {
      commit({ ...account, profile: name })
    },
    [account, commit],
  )

  const checkSource = useCallback(
    (id: string) => {
      const source = account.sources.find((s) => s.id === id)
      if (source) void check(source)
    },
    [account.sources, check],
  )

  /* Progress the player just reported: counted at once, sent in the background. */
  const noteProgress = useCallback((input: ProgressInput) => {
    const key = `${input.itemId}:${input.episodeId ?? ''}`
    setProgress((p) => ({
      ...p,
      [key]: {
        id: key,
        libraryItemId: input.itemId,
        episodeId: input.episodeId ?? null,
        currentTime: input.currentTime,
        duration: input.duration,
        progress: input.duration > 0 ? Math.min(1, input.currentTime / input.duration) : 0,
        isFinished: Boolean(input.isFinished),
        lastUpdate: Date.now(),
      },
    }))
  }, [])

  const music = useMemo(
    () => (account.sources.find((s): s is NavidromeSource => s.kind === 'navidrome') ?? null),
    [account.sources],
  )

  const absSource = useMemo(
    () => (account.sources.find((s): s is AbsSource => s.kind === 'audiobookshelf') ?? null),
    [account.sources],
  )

  const abs = useMemo<AbsSession | null>(() => {
    if (!absSource) return null
    const list = libraries[absSource.id] ?? []
    return {
      source: absSource,
      client: new AbsClient(absSource.baseUrl, absSource.token),
      user: users[absSource.id] ?? null,
      libraries: list,
      books: list.find((l) => l.mediaType === 'book') ?? null,
      podcasts: list.find((l) => l.mediaType === 'podcast') ?? null,
    }
  }, [absSource, libraries, users])

  const ready =
    account.sources.length === 0 ||
    account.sources.every((source) => {
      const state = health[source.id]
      return state != null && state.status !== 'checking'
    })

  const value = useMemo(
    () => ({
      profile: account.profile,
      setProfile,
      sources: account.sources,
      health,
      music,
      abs,
      progress,
      noteProgress,
      ready,
      addSource,
      removeSource,
      checkSource,
      renameSource,
    }),
    [
      account.profile,
      account.sources,
      setProfile,
      health,
      music,
      abs,
      progress,
      noteProgress,
      ready,
      addSource,
      removeSource,
      checkSource,
      renameSource,
    ],
  )

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
}
