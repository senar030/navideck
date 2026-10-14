import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export const MIX_SIZES = [15, 25, 40, 50, 75, 100] as const
export type MixSize = (typeof MIX_SIZES)[number]
export type LayoutMode = 'grid' | 'list'
export type LayoutKey = 'albums' | 'artists' | 'genres' | 'playlists' | 'starred' | 'search'

const LAYOUT_DEFAULTS: Record<LayoutKey, LayoutMode> = {
  albums: 'grid',
  artists: 'list',
  genres: 'grid',
  playlists: 'list',
  starred: 'grid',
  search: 'grid',
}

type PrefsContextValue = {
  mixSize: MixSize
  setMixSize: (n: MixSize) => void
  layout: Record<LayoutKey, LayoutMode>
  setLayout: (key: LayoutKey, mode: LayoutMode) => void
}

const KEY = 'navideck.mixSize'
const LAYOUT_KEY = 'navideck.layout'
const PrefsContext = createContext<PrefsContextValue | null>(null)

function readMixSize(): MixSize {
  const n = Number(localStorage.getItem(KEY))
  return MIX_SIZES.includes(n as MixSize) ? (n as MixSize) : 40
}

function readLayout(): Record<LayoutKey, LayoutMode> {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY)
    if (!raw) return { ...LAYOUT_DEFAULTS }
    const parsed = JSON.parse(raw) as Partial<Record<LayoutKey, LayoutMode>>
    const next = { ...LAYOUT_DEFAULTS }
    for (const key of Object.keys(LAYOUT_DEFAULTS) as LayoutKey[]) {
      if (parsed[key] === 'grid' || parsed[key] === 'list') next[key] = parsed[key]
    }
    return next
  } catch {
    return { ...LAYOUT_DEFAULTS }
  }
}

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [mixSize, setMixSizeState] = useState<MixSize>(readMixSize)
  const [layout, setLayoutState] = useState<Record<LayoutKey, LayoutMode>>(readLayout)

  useEffect(() => {
    localStorage.setItem(KEY, String(mixSize))
  }, [mixSize])

  useEffect(() => {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout))
  }, [layout])

  const setMixSize = useCallback((n: MixSize) => {
    setMixSizeState(n)
  }, [])

  const setLayout = useCallback((key: LayoutKey, mode: LayoutMode) => {
    setLayoutState((prev) => ({ ...prev, [key]: mode }))
  }, [])

  const value = useMemo(
    () => ({ mixSize, setMixSize, layout, setLayout }),
    [mixSize, setMixSize, layout, setLayout],
  )
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>
}

export function usePrefs(): PrefsContextValue {
  const ctx = useContext(PrefsContext)
  if (!ctx) throw new Error('usePrefs must be used inside PrefsProvider')
  return ctx
}
