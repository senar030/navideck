import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export const MIX_SIZES = [15, 25, 40, 50, 75, 100] as const
export type MixSize = (typeof MIX_SIZES)[number]

type PrefsContextValue = {
  mixSize: MixSize
  setMixSize: (n: MixSize) => void
}

const KEY = 'navideck.mixSize'
const PrefsContext = createContext<PrefsContextValue | null>(null)

function readMixSize(): MixSize {
  const n = Number(localStorage.getItem(KEY))
  return MIX_SIZES.includes(n as MixSize) ? (n as MixSize) : 40
}

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [mixSize, setMixSizeState] = useState<MixSize>(readMixSize)

  useEffect(() => {
    localStorage.setItem(KEY, String(mixSize))
  }, [mixSize])

  const setMixSize = useCallback((n: MixSize) => {
    setMixSizeState(n)
  }, [])

  const value = useMemo(() => ({ mixSize, setMixSize }), [mixSize, setMixSize])
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>
}

export function usePrefs(): PrefsContextValue {
  const ctx = useContext(PrefsContext)
  if (!ctx) throw new Error('usePrefs must be used inside PrefsProvider')
  return ctx
}
