/*
 * Station search through radio-browser.info, a free community directory with no
 * API key of its own. It is a different service from Navidrome: Navidrome only
 * stores the stations we hand to it, it cannot look any up.
 *
 * The directory runs several mirrors behind subdomains that resolve to
 * round-robin addresses, so a failing one is simply skipped. Whichever mirror
 * answered last is tried first the next time.
 */

export type RadioHit = {
  uuid: string
  name: string
  /** The stream to play, already resolved past any playlist wrapper. */
  url: string
  homepage?: string
  logo?: string
  country?: string
  tags: string[]
  codec?: string
  bitrate?: number
  votes: number
}

export type RadioSearchQuery = {
  /** Free text: station name, country, genre — the directory matches all three. */
  term?: string
  offset?: number
}

/** Stations per page. The directory caps a single answer, so we page instead. */
export const RADIO_PAGE = 30

const MIRRORS = [
  'https://de1.api.radio-browser.info',
  'https://de2.api.radio-browser.info',
  'https://fi1.api.radio-browser.info',
  'https://de.fm.api.radio-browser.info',
]
const TIMEOUT_MS = 8000

/** Index of the mirror that answered last, so dead ones are not retried first. */
let preferred = 0

type RawStation = {
  stationuuid?: string
  name?: string
  url?: string
  url_resolved?: string
  homepage?: string
  favicon?: string
  country?: string
  tags?: string
  codec?: string
  bitrate?: number
  votes?: number
}

export async function searchRadioStations({ term = '', offset = 0 }: RadioSearchQuery): Promise<RadioHit[]> {
  const params = new URLSearchParams({
    limit: String(RADIO_PAGE),
    offset: String(offset),
    // Half of the directory is broken or has moved, and a browser refuses to
    // load a plain-http stream from an https page — ask for neither.
    hidebroken: 'true',
    is_https: 'true',
    order: 'votes',
    reverse: 'true',
  })
  const name = term.trim()
  if (name) params.set('name', name)

  const raw = await getJson<RawStation[]>(`/json/stations/search?${params.toString()}`)
  return raw
    .map(toHit)
    .filter((hit) => hit.name && hit.url.startsWith('https://'))
}

/**
 * The logo the directory knows for a stream, looked up on demand.
 *
 * A station's logo never reaches Navidrome — its radio API takes a name, a
 * stream and a homepage and nothing else — so the only device that ever saw the
 * logo is the one the station was followed on. Every other device knows just the
 * stream URL, and asks the directory again with it.
 *
 * The exact lookup misses half the point: the directory files a station under
 * the URL of the entry it was found through, which for a playlist wrapper is not
 * the resolved stream Navidrome stores and plays. Those entries are only
 * reachable by name, and only the resolved stream tells the right one from the
 * many stations that share a name.
 */
export async function lookupRadioLogo(name: string, streamUrl: string): Promise<string | undefined> {
  const stream = streamUrl.trim()
  if (!stream) return undefined

  const byUrl = await fetchStations(`/json/stations/byurl?${new URLSearchParams({ url: stream })}`)
  const direct = pickLogo(byUrl, name)
  if (direct) return direct

  const term = name.trim()
  if (!term) return undefined
  const params = new URLSearchParams({
    name: term,
    limit: '30',
    hidebroken: 'true',
    order: 'votes',
    reverse: 'true',
  })
  const byName = await fetchStations(`/json/stations/search?${params}`)
  const sameStream = byName.filter((raw) => (raw.url_resolved || raw.url || '').trim() === stream)
  return pickLogo(sameStream, name)
}

/** An answer we could not get counts as "the directory knows no logo". */
async function fetchStations(path: string): Promise<RawStation[]> {
  try {
    return await getJson<RawStation[]>(path)
  } catch {
    return []
  }
}

/**
 * The first https logo in the answer. An entry carrying the station's name wins
 * over one that merely shares its stream: a single URL can be filed under
 * several entries, and only the one we followed is the station being drawn.
 */
function pickLogo(entries: RawStation[], name: string): string | undefined {
  const term = name.trim().toLowerCase()
  const named = term ? entries.filter((raw) => (raw.name ?? '').trim().toLowerCase() === term) : []
  for (const raw of [...named, ...entries]) {
    const logo = httpsOrNothing(raw.favicon)
    if (logo) return logo
  }
  return undefined
}

/**
 * The directory asks every client to report which station it played: it is what
 * the vote count is built from, and it costs one fire-and-forget request.
 */
export function reportRadioClick(uuid: string): void {
  void fetch(`${MIRRORS[preferred]}/json/url/${encodeURIComponent(uuid)}`).catch(() => {
    /* the directory is not essential to the app */
  })
}

function toHit(raw: RawStation): RadioHit {
  return {
    uuid: raw.stationuuid ?? '',
    name: (raw.name ?? '').trim(),
    url: (raw.url_resolved || raw.url || '').trim(),
    homepage: raw.homepage?.trim() || undefined,
    logo: httpsOrNothing(raw.favicon),
    country: raw.country?.trim() || undefined,
    tags: (raw.tags ?? '')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 4),
    codec: raw.codec?.trim() || undefined,
    bitrate: raw.bitrate || undefined,
    votes: raw.votes ?? 0,
  }
}

function httpsOrNothing(url: string | undefined): string | undefined {
  const trimmed = url?.trim()
  return trimmed && /^https:\/\//i.test(trimmed) ? trimmed : undefined
}

async function getJson<T>(path: string): Promise<T> {
  let lastError: unknown
  for (let step = 0; step < MIRRORS.length; step++) {
    const index = (preferred + step) % MIRRORS.length
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const res = await fetch(`${MIRRORS[index]}${path}`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as T
      preferred = index
      return data
    } catch (err) {
      lastError = err
    } finally {
      window.clearTimeout(timer)
    }
  }
  throw new Error(
    lastError instanceof DOMException && lastError.name === 'AbortError'
      ? 'Die Sendersuche antwortet nicht.'
      : 'Die Sendersuche (radio-browser.info) ist gerade nicht erreichbar.',
  )
}
