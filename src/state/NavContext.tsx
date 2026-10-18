import { createContext, useContext } from 'react'

export type View =
  | { name: 'home' }
  | { name: 'albums' }
  | { name: 'artists' }
  | { name: 'playlists' }
  | { name: 'starred' }
  | { name: 'search' }
  | { name: 'genres' }
  | { name: 'radio' }
  | { name: 'album'; id: string }
  | { name: 'artist'; id: string }
  | { name: 'playlist'; id: string }
  | { name: 'genre'; id: string }
  /** Everything behind a start-page "Weitere laden…" tile. */
  | { name: 'section'; id: string }

export type NavContextValue = {
  view: View
  go: (view: View) => void
  back: () => void
  canBack: boolean
}

/*
 * The context, its value type and the hook live apart from the provider that
 * fills them, so editing the provider does not invalidate every module that
 * only ever calls `useNav`.
 */
export const NavContext = createContext<NavContextValue | null>(null)

export function useNav(): NavContextValue {
  const ctx = useContext(NavContext)
  if (!ctx) throw new Error('useNav must be used inside NavProvider')
  return ctx
}
