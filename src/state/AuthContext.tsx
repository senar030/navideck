import { createContext, useContext } from 'react'
import type { NavidromeClient } from '../api/client'
import type { MusicFolder } from '../api/types'

type AuthContextValue = {
  /** Null while the account has no Navidrome server, or none that answers. */
  client: NavidromeClient | null
  folders: MusicFolder[]
  selectedFolderIds: string[]
  setSelectedFolderIds: (ids: string[]) => void
}

/*
 * The context, its value type and the hook live apart from the provider that
 * fills them, so editing the provider does not invalidate every module that
 * only ever calls `useAuth`.
 */
export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
