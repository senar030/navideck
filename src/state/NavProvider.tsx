import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { NavContext, type View } from './NavContext'

type HistState = { stack: View[] }

const ROOTS = new Set([
  'start',
  'account',
  'home',
  'albums',
  'artists',
  'playlists',
  'starred',
  'search',
  'genres',
  'radio',
  'ab-home',
  'abs-books',
  'abs-authors',
  'abs-collections',
  'pod-home',
  'podcasts',
  'pod-episodes',
  'pod-add',
])

/** Views whose address carries a single id segment. */
const DETAILS = new Set([
  'album',
  'artist',
  'playlist',
  'genre',
  'section',
  'abs-book',
  'abs-author',
  'abs-collection',
  'abs-series',
  'podcast',
])

/**
 * What the nav shows before anything has been pushed. One object rather than a
 * fresh literal per render, so `view` keeps its identity and the memo below can
 * hold on to it.
 */
const HOME: View = { name: 'start' }

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
  return HOME
}

export function NavProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<View[]>(() => {
    const fromHash = parseHash()
    return [fromHash]
  })
  const view = stack[stack.length - 1] ?? HOME

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
