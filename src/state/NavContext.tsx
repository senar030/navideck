import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

export type View =
  | { name: 'home' }
  | { name: 'albums' }
  | { name: 'artists' }
  | { name: 'playlists' }
  | { name: 'starred' }
  | { name: 'search' }
  | { name: 'genres' }
  | { name: 'album'; id: string }
  | { name: 'artist'; id: string }
  | { name: 'playlist'; id: string }
  | { name: 'genre'; id: string }

type NavContextValue = {
  view: View
  go: (view: View) => void
  back: () => void
  canBack: boolean
}

const NavContext = createContext<NavContextValue | null>(null)

export function NavProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<View[]>([{ name: 'home' }])
  const view = stack[stack.length - 1] ?? { name: 'home' as const }

  const go = useCallback((next: View) => {
    const isRoot =
      next.name === 'home' ||
      next.name === 'albums' ||
      next.name === 'artists' ||
      next.name === 'playlists' ||
      next.name === 'starred' ||
      next.name === 'search' ||
      next.name === 'genres'
    setStack((s) => {
      if (isRoot) return [next]
      const cur = s[s.length - 1]
      if (cur && JSON.stringify(cur) === JSON.stringify(next)) return s
      return [...s, next]
    })
  }, [])

  const back = useCallback(() => {
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s))
  }, [])

  const value = useMemo(
    () => ({ view, go, back, canBack: stack.length > 1 }),
    [view, go, back, stack.length],
  )

  return <NavContext.Provider value={value}>{children}</NavContext.Provider>
}

export function useNav(): NavContextValue {
  const ctx = useContext(NavContext)
  if (!ctx) throw new Error('useNav must be used inside NavProvider')
  return ctx
}
