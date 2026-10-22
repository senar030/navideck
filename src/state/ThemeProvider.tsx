import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { PALETTES, ThemeContext, type PaletteId, type Theme } from './ThemeContext'

const THEME_KEY = 'navideck.theme'
const PALETTE_KEY = 'navideck.palette'

function readTheme(): Theme {
  return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'
}

function readPalette(): PaletteId {
  const raw = localStorage.getItem(PALETTE_KEY)
  return PALETTES.some((p) => p.id === raw) ? (raw as PaletteId) : 'violet'
}

function apply(theme: Theme, palette: PaletteId) {
  document.documentElement.dataset.theme = theme
  document.documentElement.dataset.palette = palette
}

/**
 * The status bar of an installed app is drawn by the OS, so it has to be told
 * about colour changes — the manifest value is only the initial one.
 */
function applyStatusBarColour() {
  const colour = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
  if (!colour) return
  let meta = document.querySelector('meta[name="theme-color"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.setAttribute('name', 'theme-color')
    document.head.appendChild(meta)
  }
  meta.setAttribute('content', colour)
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const next = readTheme()
    apply(next, readPalette())
    return next
  })
  const [palette, setPaletteState] = useState<PaletteId>(readPalette)

  useEffect(() => {
    apply(theme, palette)
    applyStatusBarColour()
    localStorage.setItem(THEME_KEY, theme)
    localStorage.setItem(PALETTE_KEY, palette)
  }, [theme, palette])

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  }, [])

  const pickTheme = useCallback((next: Theme) => {
    setTheme(next)
  }, [])

  const setPalette = useCallback((id: PaletteId) => {
    setPaletteState(id)
  }, [])

  const value = useMemo(
    () => ({ theme, palette, setTheme: pickTheme, toggleTheme, setPalette }),
    [theme, palette, pickTheme, toggleTheme, setPalette],
  )
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
