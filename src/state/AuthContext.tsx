import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { NavidromeClient } from '../api/client'
import type { MusicFolder } from '../api/types'
import { normalizeServerUrl } from '../lib/format'

const STORAGE_KEY = 'navideck.auth'
const LAST_KEY = 'navideck.last'
const LIB_KEY = 'navideck.libraries'

type StoredAuth = {
  baseUrl: string
  username: string
  password: string
}

type AuthContextValue = {
  client: NavidromeClient | null
  login: (server: string, username: string, password: string) => Promise<void>
  logout: () => void
  lastServer: string
  lastUser: string
  folders: MusicFolder[]
  selectedFolderIds: string[]
  setSelectedFolderIds: (ids: string[]) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const stored = readJson<StoredAuth>(STORAGE_KEY)
  const last = readJson<Pick<StoredAuth, 'baseUrl' | 'username'>>(LAST_KEY)
  const [client, setClient] = useState<NavidromeClient | null>(() => {
    if (!stored) return null
    const next = new NavidromeClient(stored.baseUrl, stored.username, stored.password)
    next.folderIds = readJson<string[]>(LIB_KEY) ?? []
    return next
  })
  const [folders, setFolders] = useState<MusicFolder[]>([])
  const [selectedFolderIds, setSelected] = useState<string[]>(() => readJson<string[]>(LIB_KEY) ?? [])

  useEffect(() => {
    if (!client) return
    let cancelled = false
    void client.ping().catch(() => {
      if (cancelled) return
      localStorage.removeItem(STORAGE_KEY)
      setClient(null)
    })
    void client.getMusicFolders().then((list) => {
      if (!cancelled) setFolders(list)
    }).catch(() => {
      if (!cancelled) setFolders([])
    })
    return () => {
      cancelled = true
    }
  }, [client])

  const setSelectedFolderIds = useCallback((ids: string[]) => {
    setSelected(ids)
    localStorage.setItem(LIB_KEY, JSON.stringify(ids))
    setClient((c) => {
      if (!c) return c
      c.folderIds = ids
      return c
    })
  }, [])

  const login = useCallback(async (server: string, username: string, password: string) => {
    const baseUrl = normalizeServerUrl(server)
    const next = new NavidromeClient(baseUrl, username.trim(), password)
    await next.ping()
    const payload = {
      baseUrl: next.baseUrl,
      username: next.username,
      password,
    } satisfies StoredAuth
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    localStorage.setItem(
      LAST_KEY,
      JSON.stringify({ baseUrl: next.baseUrl, username: next.username }),
    )
    setClient(next)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setClient(null)
  }, [])

  const value = useMemo(
    () => ({
      client,
      login,
      logout,
      lastServer: stored?.baseUrl ?? last?.baseUrl ?? '',
      lastUser: stored?.username ?? last?.username ?? '',
      folders,
      selectedFolderIds,
      setSelectedFolderIds,
    }),
    [
      client,
      login,
      logout,
      stored?.baseUrl,
      stored?.username,
      last?.baseUrl,
      last?.username,
      folders,
      selectedFolderIds,
      setSelectedFolderIds,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
