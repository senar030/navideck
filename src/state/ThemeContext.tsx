import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type Theme = 'dark' | 'light'

export const PALETTES = [
  { id: 'violet', label: 'Violett' },
  { id: 'ocean', label: 'Ozean' },
  { id: 'sunset', label: 'Abendrot' },
  { id: 'forest', label: 'Wald' },
  { id: 'indigo', label: 'Indigo' },
  { id: 'rose', label: 'Rose' },
  { id: 'gold', label: 'Gold' },
  { id: 'aurora', label: 'Polarlicht' },
] as const

export type PaletteId = (typeof PALETTES)[number]['id']

type ThemeContextValue = {
  theme: Theme
  palette: PaletteId
  toggleTheme: () => void
  setPalette: (id: PaletteId) => void
}

const THEME_KEY = 'navideck.theme'
const PALETTE_KEY = 'navideck.palette'
const ThemeContext = createContext<ThemeContextValue | null>(null)

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

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const next = readTheme()
    apply(next, readPalette())
    return next
  })
  const [palette, setPaletteState] = useState<PaletteId>(readPalette)

  useEffect(() => {
    apply(theme, palette)
    localStorage.setItem(THEME_KEY, theme)
    localStorage.setItem(PALETTE_KEY, palette)
  }, [theme, palette])

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  }, [])

  const setPalette = useCallback((id: PaletteId) => {
    setPaletteState(id)
  }, [])

  const value = useMemo(
    () => ({ theme, palette, toggleTheme, setPalette }),
    [theme, palette, toggleTheme, setPalette],
  )
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}
