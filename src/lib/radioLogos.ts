/*
 * Navidrome stores a radio station's name, stream and homepage, but no logo —
 * unless somebody uploaded one for it. The directory knows a logo for nearly
 * every station, so the one belonging to a station is kept here, keyed by the
 * stream URL Navidrome holds.
 *
 * This is a cache, not the source of truth: the device that followed a station
 * wrote the logo down from the hit it followed, and any other device fills in the
 * same entry by looking the station up again (see `lookupRadioLogo`).
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
