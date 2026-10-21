import { createContext, useContext } from 'react'

/*
 * Views are flat and named after what they show, not after which server they
 * read from: the hash stays readable (`#/abs-book/li_123`) and the navigation
 * stack does not have to carry a server reference around.
 */
export type View =
  /* The account's own start page, and "Konto & Server". */
  | { name: 'start' }
  | { name: 'account' }
  /* Music, from Navidrome. */
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
  /* Audiobooks, from Audiobookshelf. */
  | { name: 'ab-home' }
  | { name: 'abs-books' }
  | { name: 'abs-authors' }
  | { name: 'abs-collections' }
  | { name: 'abs-book'; id: string }
  | { name: 'abs-author'; id: string }
  | { name: 'abs-collection'; id: string }
  | { name: 'abs-series'; id: string }
  /* Podcasts, from the same server. */
  | { name: 'pod-home' }
  | { name: 'podcasts' }
  | { name: 'pod-episodes' }
  | { name: 'pod-add' }
  | { name: 'podcast'; id: string }

/** The four big areas the space switcher offers. */
export type Space = 'start' | 'music' | 'audiobooks' | 'podcasts' | 'account'

const AUDIOBOOK_VIEWS = new Set([
  'ab-home',
  'abs-books',
  'abs-authors',
  'abs-collections',
  'abs-book',
  'abs-author',
  'abs-collection',
  'abs-series',
])

const PODCAST_VIEWS = new Set(['pod-home', 'podcasts', 'pod-episodes', 'pod-add', 'podcast'])

export function spaceOf(view: View): Space {
  if (view.name === 'start') return 'start'
  if (view.name === 'account') return 'account'
  if (AUDIOBOOK_VIEWS.has(view.name)) return 'audiobooks'
  if (PODCAST_VIEWS.has(view.name)) return 'podcasts'
  return 'music'
}

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
