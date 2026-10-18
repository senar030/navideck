import { createContext, useContext } from 'react'

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

export type ThemeContextValue = {
  theme: Theme
  palette: PaletteId
  toggleTheme: () => void
  setPalette: (id: PaletteId) => void
}

/*
 * The context, its value type and the hook live apart from the provider that
 * fills them, so editing the provider does not invalidate every module that
 * only ever calls `useTheme`.
 */
export const ThemeContext = createContext<ThemeContextValue | null>(null)

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}
