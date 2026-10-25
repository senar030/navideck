import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { SubsonicClient } from '../api/client'
import type { MusicFolder } from '../api/types'
import { AuthContext } from './AuthContext'
import { useAccount } from './AccountContext'

const LIB_KEY = 'navideck.libraries'

/** Kept at module level so a missing client does not hand out a new array. */
const NO_FOLDERS: MusicFolder[] = []

function readLibraries(): string[] {
  try {
    const raw = localStorage.getItem(LIB_KEY)
    if (!raw) return []
    const data: unknown = JSON.parse(raw)
    return Array.isArray(data) ? (data as string[]) : []
  } catch {
    return []
  }
}

/**
 * Turns the account's music server into the client the music side uses.
 * Everything musical in the app still speaks Subsonic; this is the one place
 * that knows which server it speaks to. Nextcloud's Music app also has no
 * library filter, so it always works with the full library.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const { music } = useAccount()
  const [folders, setFolders] = useState<MusicFolder[]>([])
  const [selectedFolderIds, setSelected] = useState<string[]>(readLibraries)

  /*
   * The client is rebuilt when the chosen libraries change: a client carries
   * its folder filter, and every music view should fetch with the new one.
   */
  const client = useMemo(() => {
    if (!music) return null
    const next = new SubsonicClient(
      music.baseUrl,
      music.username,
      music.password,
      music.kind === 'subsonic' ? 'password' : 'token',
    )
    next.folderIds = music.kind === 'subsonic' ? [] : selectedFolderIds
    return next
  }, [music, selectedFolderIds])

  useEffect(() => {
    if (!client || music?.kind === 'subsonic') return
    let cancelled = false
    void client
      .getMusicFolders()
      .then((list) => {
        if (!cancelled) setFolders(list)
      })
      .catch(() => {
        if (!cancelled) setFolders([])
      })
    return () => {
      cancelled = true
    }
  }, [client, music?.kind])

  const setSelectedFolderIds = useCallback((ids: string[]) => {
    setSelected(ids)
    try {
      localStorage.setItem(LIB_KEY, JSON.stringify(ids))
    } catch {
      /* ignore */
    }
  }, [])

  const value = useMemo(
    () => ({
      client,
      folders: client && music?.kind !== 'subsonic' ? folders : NO_FOLDERS,
      selectedFolderIds,
      setSelectedFolderIds,
    }),
    [client, folders, music?.kind, selectedFolderIds, setSelectedFolderIds],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
