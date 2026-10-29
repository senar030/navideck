import { useCallback, useState } from 'react'

/*
 * A random strip should keep its draw while the app is open: opening a book and
 * coming back must not show a different row. The seed lives at module level, so
 * a remounted widget picks up the same draw; the reshuffle button advances it.
 */
const seeds = new Map<string, number>()

function seedFor(key: string): number {
  let seed = seeds.get(key)
  if (seed === undefined) {
    seed = Math.floor(Math.random() * 2 ** 31)
    seeds.set(key, seed)
  }
  return seed
}

export function useSessionSeed(key: string): [number, () => void] {
  const [seed, setSeed] = useState(() => seedFor(key))

  const reshuffle = useCallback(() => {
    const next = seedFor(key) + 1
    seeds.set(key, next)
    setSeed(next)
  }, [key])

  return [seed, reshuffle]
}
