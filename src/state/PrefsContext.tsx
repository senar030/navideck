import { createContext, useContext } from 'react'

export const MIX_SIZES = [15, 25, 40, 50, 75, 100] as const
export type MixSize = (typeof MIX_SIZES)[number]
export type LayoutMode = 'grid' | 'list'
export type LayoutKey =
  | 'albums'
  | 'artists'
  | 'genres'
  | 'genreDetail'
  | 'playlists'
  | 'starred'
  | 'search'
  | 'books'
  | 'absAuthors'
  | 'absCollections'
  | 'podcasts'
  | 'episodes'
export type UiMode = 'deck' | 'desktop'
export type CornerMode = 'round' | 'sharp'

type PrefsContextValue = {
  mixSize: MixSize
  setMixSize: (n: MixSize) => void
  layout: Record<LayoutKey, LayoutMode>
  setLayout: (key: LayoutKey, mode: LayoutMode) => void
  uiMode: UiMode
  toggleUiMode: () => void
  setUiMode: (mode: UiMode) => void
  corners: CornerMode
  setCorners: (mode: CornerMode) => void
}

/*
 * The context, its value type and the hook live apart from the provider that
 * fills them, so editing the provider does not invalidate every module that
 * only ever calls `usePrefs`.
 */
export const PrefsContext = createContext<PrefsContextValue | null>(null)

export function usePrefs(): PrefsContextValue {
  const ctx = useContext(PrefsContext)
  if (!ctx) throw new Error('usePrefs must be used inside PrefsProvider')
  return ctx
}
