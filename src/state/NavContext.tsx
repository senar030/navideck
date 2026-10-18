import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

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

type HistState = { stack: View[] }

type NavContextValue = {
  view: View
  go: (view: View) => void
  back: () => void
  canBack: boolean
}

const NavContext = createContext<NavContextValue | null>(null)

const ROOTS = new Set(['home', 'albums', 'artists', 'playlists', 'starred', 'search', 'genres', 'radio'])

/** Views whose address carries a single id segment. */
const DETAILS = new Set(['album', 'artist', 'playlist', 'genre', 'section'])

function isRoot(view: View): boolean {
  return ROOTS.has(view.name)
}

function toHash(view: View): string {
  if ('id' in view) return `#/${view.name}/${encodeURIComponent(view.id)}`
  return `#/${view.name}`
}

function parseHash(): View {
  const raw = window.location.hash.replace(/^#\/?/, '')
  const [name, ...rest] = raw.split('/')
  const id = rest.length ? decodeURIComponent(rest.join('/')) : ''
  if (DETAILS.has(name) && id) {
    return { name, id } as View
  }
  if (name && ROOTS.has(name)) return { name } as View
  return { name: 'home' }
}

export function NavProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<View[]>(() => {
    const fromHash = parseHash()
    return [fromHash]
  })
  const view = stack[stack.length - 1] ?? { name: 'home' as const }

  useEffect(() => {
    history.replaceState({ stack } satisfies HistState, '', toHash(view))
    const onPop = (event: PopStateEvent) => {
      const hist = event.state as HistState | null
      if (hist?.stack?.length) {
        setStack(hist.stack)
        return
      }
      const fallback: View[] = [parseHash()]
      history.pushState({ stack: fallback } satisfies HistState, '', toHash(fallback[0]))
      setStack(fallback)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
    // only bind once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const go = useCallback((next: View) => {
    setStack((s) => {
      const nextStack = isRoot(next)
        ? [next]
        : JSON.stringify(s[s.length - 1]) === JSON.stringify(next)
          ? s
          : [...s, next]
      if (JSON.stringify(s) === JSON.stringify(nextStack)) return s
      history.pushState({ stack: nextStack } satisfies HistState, '', toHash(next))
      return nextStack
    })
  }, [])

  const back = useCallback(() => {
    if (window.history.length > 1) history.back()
    else setStack((s) => (s.length > 1 ? s.slice(0, -1) : s))
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
