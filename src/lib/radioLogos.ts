/*
 * Navidrome stores a radio station's name, stream and homepage, but no logo —
 * unless somebody uploaded one for it. The directory we search in knows a logo
 * for nearly every station, so the one we followed is remembered here, per
 * device, keyed by the stream URL Navidrome holds.
 */

const KEY = 'navideck.radio.logos'
/** Enough for a long list of favourites; keeps the entry from growing forever. */
const LIMIT = 200

export function readRadioLogos(): Record<string, string> {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    const data = JSON.parse(raw) as unknown
    if (!data || typeof data !== 'object' || Array.isArray(data)) return {}
    const out: Record<string, string> = {}
    for (const [streamUrl, logo] of Object.entries(data as Record<string, unknown>)) {
      if (typeof logo === 'string' && logo.startsWith('https://')) out[streamUrl] = logo
    }
    return out
  } catch {
    return {}
  }
}

export function rememberRadioLogo(streamUrl: string, logo: string | undefined): void {
  if (!streamUrl || !logo || !logo.startsWith('https://')) return
  try {
    const logos = readRadioLogos()
    delete logos[streamUrl]
    const entries = Object.entries(logos)
    const trimmed = entries.slice(Math.max(0, entries.length - LIMIT + 1))
    localStorage.setItem(KEY, JSON.stringify({ ...Object.fromEntries(trimmed), [streamUrl]: logo }))
  } catch {
    /* private mode or quota — the fallback artwork is fine */
  }
}
