/*
 * A tiny promise cache for the Audiobookshelf reads that several views share.
 * A library listing can be a megabyte; walking start -> books -> back must not
 * download it three times.
 */

type Entry = { at: number; data: Promise<unknown> }

const cache = new Map<string, Entry>()

export function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < ttlMs) return hit.data as Promise<T>
  const data = load()
  cache.set(key, { at: Date.now(), data })
  // A failed request is not an answer; the next view may try again.
  void data.catch(() => {
    if (cache.get(key)?.data === data) cache.delete(key)
  })
  return data
}

export function forget(prefix: string): void {
  for (const key of [...cache.keys()]) {
    if (key.startsWith(prefix)) cache.delete(key)
  }
}
