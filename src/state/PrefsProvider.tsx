import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { MIX_SIZES, PrefsContext, type LayoutKey, type LayoutMode, type MixSize, type UiMode } from './PrefsContext'

const LAYOUT_DEFAULTS: Record<LayoutKey, LayoutMode> = {
  albums: 'grid',
  artists: 'list',
  genres: 'grid',
  genreDetail: 'grid',
  playlists: 'list',
  starred: 'grid',
  search: 'grid',
  books: 'grid',
  absAuthors: 'list',
  absCollections: 'grid',
  podcasts: 'grid',
  episodes: 'list',
}

const KEY = 'navideck.mixSize'
const LAYOUT_KEY = 'navideck.layout'
const UI_KEY = 'navideck.uiMode'

function readMixSize(): MixSize {
  const n = Number(localStorage.getItem(KEY))
  return MIX_SIZES.includes(n as MixSize) ? (n as MixSize) : 40
}

function detectHandheld(): boolean {
  if (typeof window === 'undefined') return false
  const ua = navigator.userAgent
  if (/SteamDeck|SteamOS|Steam Client|\bValve\b|ROG Ally|Legion Go/i.test(ua)) return true
  const w = window.innerWidth
  const h = window.innerHeight
  const shortSide = Math.min(w, h)
  const longSide = Math.max(w, h)
  const touch = navigator.maxTouchPoints > 0
  const coarse = window.matchMedia('(pointer: coarse)').matches
  if (touch && shortSide >= 700 && shortSide <= 900 && longSide >= 1100 && longSide <= 1400) return true
  if ((touch || coarse) && shortSide >= 900 && shortSide <= 1200 && longSide >= 1600 && longSide <= 2560) {
    return (window.devicePixelRatio || 1) >= 1.2 || coarse
  }
  return false
}

function readUiMode(): UiMode {
  const saved = localStorage.getItem(UI_KEY)
  if (saved === 'deck' || saved === 'desktop') return saved
  const next = detectHandheld() ? 'deck' : 'desktop'
  document.documentElement.dataset.ui = next
  return next
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
  const [uiMode, setUiModeState] = useState<UiMode>(() => {
    const next = readUiMode()
    document.documentElement.dataset.ui = next
    return next
  })

  useEffect(() => {
    localStorage.setItem(KEY, String(mixSize))
  }, [mixSize])

  useEffect(() => {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout))
  }, [layout])

  useEffect(() => {
    document.documentElement.dataset.ui = uiMode
    localStorage.setItem(UI_KEY, uiMode)
  }, [uiMode])

  const setMixSize = useCallback((n: MixSize) => {
    setMixSizeState(n)
  }, [])

  const setLayout = useCallback((key: LayoutKey, mode: LayoutMode) => {
    setLayoutState((prev) => ({ ...prev, [key]: mode }))
  }, [])

  const setUiMode = useCallback((mode: UiMode) => {
    setUiModeState(mode)
  }, [])

  const toggleUiMode = useCallback(() => {
    setUiModeState((mode) => (mode === 'deck' ? 'desktop' : 'deck'))
  }, [])

  const value = useMemo(
    () => ({ mixSize, setMixSize, layout, setLayout, uiMode, toggleUiMode, setUiMode }),
    [mixSize, setMixSize, layout, setLayout, uiMode, toggleUiMode, setUiMode],
  )
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>
}
