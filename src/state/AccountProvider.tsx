import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AbsClient, absLogin, type AbsLibrary, type AbsProgress, type AbsUser } from '../api/abs'
import { SubsonicClient } from '../api/client'
import { SubsonicPodcastClient } from '../api/subsonicPodcasts'
import { normalizeServerUrl, normalizeSubsonicUrl } from '../lib/format'
import {
  AccountContext,
  isMusicSource,
  newId,
  type AbsSession,
  type AbsSource,
  type MusicSource,
  type NewSource,
  type PodcastOption,
  type PodcastSession,
  type ProgressInput,
  type Source,
  type SourceHealth,
  type SubsonicSource,
} from './AccountContext'

const ACCOUNT_KEY = 'navideck.account.v1'
const LEGACY_KEY = 'navideck.auth'

type Account = {
  profile: string
  sources: Source[]
  /** Which music server the music area uses; falls back to the first one. */
  activeMusic?: string
  /** Which source the podcast area uses; falls back to the first one. */
  activePodcast?: string
}

/** Nextcloud Music refuses Subsonic token auth and takes the password instead. */
function authFor(source: MusicSource) {
  return source.kind === 'subsonic' ? 'password' : 'token'
}

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
    return {
      profile: stored.profile ?? '',
      sources: stored.sources.filter(Boolean),
      activeMusic: typeof stored.activeMusic === 'string' ? stored.activeMusic : undefined,
      activePodcast: typeof stored.activePodcast === 'string' ? stored.activePodcast : undefined,
    }
  }
  const legacy = readJson<{ baseUrl: string; username: string; password: string }>(LEGACY_KEY)
  if (legacy?.baseUrl) {
    const id = newId()
    const migrated: Account = {
      profile: legacy.username,
      sources: [
        {
          id,
          kind: 'navidrome',
          name: 'Navidrome',
          baseUrl: legacy.baseUrl,
          username: legacy.username,
          password: legacy.password,
        },
      ],
      activeMusic: id,
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
        if (isMusicSource(source)) {
          await new SubsonicClient(source.baseUrl, source.username, source.password, authFor(source)).ping()
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
      const server =
        input.kind === 'subsonic' ? normalizeSubsonicUrl(input.server) : normalizeServerUrl(input.server)
      if (!server) throw new Error('Bitte eine Server-Adresse angeben.')
      if (!input.username.trim()) throw new Error('Bitte einen Benutzernamen angeben.')

      let source: Source
      if (input.kind === 'navidrome' || input.kind === 'subsonic') {
        const username = input.username.trim()
        await new SubsonicClient(
          server,
          username,
          input.password,
          input.kind === 'subsonic' ? 'password' : 'token',
        ).ping()
        const base = {
          /* Replacing the same kind keeps its id; the other kind keeps its own. */
          id: account.sources.find((s) => s.kind === input.kind)?.id ?? newId(),
          name: input.name?.trim() || (input.kind === 'subsonic' ? 'Subsonic' : 'Navidrome'),
          baseUrl: server,
          username,
          password: input.password,
        }
        source =
          input.kind === 'subsonic'
            ? { ...base, kind: 'subsonic' }
            : { ...base, kind: 'navidrome' }
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
        sources: [
          ...account.sources.filter((s) => s.id !== source.id && s.kind !== source.kind),
          source,
        ],
        activeMusic: isMusicSource(source) ? source.id : account.activeMusic,
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
      commit({
        ...account,
        sources: account.sources.filter((s) => s.id !== id),
        activeMusic: account.activeMusic === id ? undefined : account.activeMusic,
        activePodcast: account.activePodcast === id ? undefined : account.activePodcast,
      })
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

  const musicSources = useMemo(
    () => account.sources.filter(isMusicSource),
    [account.sources],
  )

  const music = useMemo(
    () =>
      musicSources.find((source) => source.id === account.activeMusic) ??
      musicSources[0] ??
      null,
    [musicSources, account.activeMusic],
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

  /*
   * Podcast sources are Audiobookshelf (when its server has a podcast library)
   * and every Subsonic server; Navidrome has no podcasts. The chosen one is
   * remembered, and the first option is the fallback when it disappears.
   */
  const podcastOptions = useMemo<PodcastOption[]>(() => {
    const options: PodcastOption[] = []
    if (abs?.podcasts && absSource) {
      options.push({ id: absSource.id, name: absSource.name, kind: 'audiobookshelf' })
    }
    for (const source of account.sources) {
      if (source.kind === 'subsonic') {
        options.push({ id: source.id, name: source.name, kind: 'subsonic' })
      }
    }
    return options
  }, [abs, absSource, account.sources])

  const activePodcastId = useMemo(() => {
    if (account.activePodcast && podcastOptions.some((option) => option.id === account.activePodcast)) {
      return account.activePodcast
    }
    return podcastOptions[0]?.id ?? null
  }, [account.activePodcast, podcastOptions])

  const podcastSource = useMemo(
    () =>
      account.sources.find(
        (source): source is SubsonicSource =>
          source.kind === 'subsonic' && source.id === activePodcastId,
      ) ?? null,
    [account.sources, activePodcastId],
  )

  const subsonicPodcasts = useMemo(
    () => (podcastSource ? new SubsonicPodcastClient(podcastSource) : null),
    [podcastSource],
  )

  const podcasts = useMemo<PodcastSession | null>(() => {
    if (abs?.podcasts && absSource && activePodcastId === absSource.id) {
      return {
        kind: 'audiobookshelf',
        sourceId: absSource.id,
        name: abs.podcasts.name,
        libraryId: abs.podcasts.id,
        client: abs.client,
      }
    }
    if (subsonicPodcasts) {
      return {
        kind: 'subsonic',
        sourceId: subsonicPodcasts.sourceId,
        name: subsonicPodcasts.name,
        libraryId: 'subsonic-podcasts',
        client: subsonicPodcasts,
      }
    }
    return null
  }, [abs, absSource, activePodcastId, subsonicPodcasts])

  /*
   * Subsonic has no per-episode progress endpoint, so the podcast client keeps
   * it on this device. It is read during render and merged under the live map;
   * the live entry wins when both know about an episode.
   */
  const storedPodcastProgress = useMemo(
    () =>
      podcasts?.kind === 'subsonic'
        ? (podcasts.client as SubsonicPodcastClient).getStoredProgress()
        : {},
    [podcasts],
  )

  const visibleProgress = useMemo(
    () =>
      Object.keys(storedPodcastProgress).length
        ? { ...storedPodcastProgress, ...progress }
        : progress,
    [progress, storedPodcastProgress],
  )

  const setActiveMusic = useCallback(
    (id: string) => {
      if (!account.sources.some((source) => source.id === id && isMusicSource(source))) return
      commit({ ...account, activeMusic: id })
    },
    [account, commit],
  )

  const setActivePodcast = useCallback(
    (id: string) => {
      if (!podcastOptions.some((option) => option.id === id)) return
      commit({ ...account, activePodcast: id })
    },
    [account, commit, podcastOptions],
  )

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
      musicSources,
      music,
      activeMusicId: music?.id ?? null,
      setActiveMusic,
      abs,
      podcasts,
      podcastOptions,
      activePodcastId,
      setActivePodcast,
      progress: visibleProgress,
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
      musicSources,
      music,
      setActiveMusic,
      abs,
      podcasts,
      podcastOptions,
      activePodcastId,
      setActivePodcast,
      visibleProgress,
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
