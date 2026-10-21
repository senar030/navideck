/*
 * "Now playing" for an internet radio stream.
 *
 * Icecast and Shoutcast carry the current track inside the audio stream as ICY
 * metadata, but nothing in the browser hands that to JavaScript: the <audio>
 * element has no API for it, and Navidrome does not parse it either
 * (navidrome#3168). What most stations do publish is the same line on a small
 * status page next to the stream, and that is what this reads.
 *
 * Best effort by design. A station without such a page, one that blocks
 * cross-origin reads, or a slow one all end in `null`, and the app simply keeps
 * showing the station name. Nothing here is allowed to throw, and nothing is
 * cached that could outlive the session.
 */

export type RadioNow = {
  artist?: string
  title?: string
}

/** "Artist – Titel", or whichever half the station gave us. */
export function radioNowLine(now: RadioNow | null | undefined): string | null {
  if (!now) return null
  const artist = now.artist?.trim()
  const title = now.title?.trim()
  if (artist && title) return `${artist} – ${title}`
  return title || artist || null
}

/** A status page answers in milliseconds; one that does not is not coming. */
const TIMEOUT_MS = 6000
/** A station that answers nothing is left alone for this long before trying again. */
const DEAD_MS = 10 * 60 * 1000

/*
 * Stations that publish nothing are asked again after a pause instead of on
 * every poll: three failed requests every 25 seconds forever is not polite.
 */
const dead = new Map<string, number>()

type Probe = { url: string; parse: (text: string) => RadioNow | null }

export async function readRadioNow(
  streamUrl: string,
  station?: string,
  signal?: AbortSignal,
): Promise<RadioNow | null> {
  const until = dead.get(streamUrl)
  if (until && Date.now() < until) return null

  for (const probe of probes(streamUrl, station)) {
    if (signal?.aborted) return null
    const text = await read(probe.url, signal)
    if (!text) continue
    const now = tidy(probe.parse(text), station)
    if (now) {
      dead.delete(streamUrl)
      return now
    }
  }

  dead.set(streamUrl, Date.now() + DEAD_MS)
  return null
}

/**
 * Some stations put their own name in front of the line, and a few send nothing
 * but their name — neither should end up as "Sender – Sender".
 */
function tidy(now: RadioNow | null, station?: string): RadioNow | null {
  if (!now) return null
  const name = station?.trim().toLowerCase()
  if (!name) return now
  if (now.artist && now.artist.toLowerCase() === name) {
    return splitLine(now.title) ?? (now.title && now.title.toLowerCase() !== name ? { title: now.title } : null)
  }
  if (!now.artist && now.title && now.title.toLowerCase() === name) return null
  return now
}

/* ==========================================================================
   Where to look
   ========================================================================== */

function probes(streamUrl: string, station?: string): Probe[] {
  let url: URL
  try {
    url = new URL(streamUrl)
  } catch {
    return []
  }

  const host = url.hostname.toLowerCase()
  const list: Probe[] = []

  // laut.fm keeps its stations on one host and answers with a clean JSON API.
  if (host === 'stream.laut.fm' || host.endsWith('.laut.fm')) {
    const name = url.pathname.split('/').filter(Boolean)[0]
    if (name) {
      list.push({
        url: `https://api.laut.fm/station/${encodeURIComponent(name)}/current_song`,
        parse: parseLautFm,
      })
    }
  }

  // AzuraCast puts the station's shortcode in the stream path.
  const listen = /^\/listen\/([^/]+)/.exec(url.pathname)
  if (listen) {
    list.push({
      url: `${url.origin}/api/nowplaying/${encodeURIComponent(listen[1])}`,
      parse: parseAzuraCast,
    })
  }

  // Anything else: the two servers Icecast and Shoutcast answer next to the
  // stream, then Shoutcast's JSON variant.
  list.push({
    url: `${url.origin}/status-json.xsl`,
    parse: (text) => parseIcecast(text, url.pathname, station),
  })
  list.push({ url: `${url.origin}/currentsong?sid=1`, parse: parseShoutcastLine })
  list.push({ url: `${url.origin}/stats?json=1`, parse: parseShoutcastStats })

  return list
}

async function read(url: string, signal?: AbortSignal): Promise<string | null> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS)
  const relay = () => controller.abort()
  signal?.addEventListener('abort', relay)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
      // A status page needs no login, and the app should not hand its cookies
      // to a third-party host.
      credentials: 'omit',
    })
    if (!res.ok) return null
    const text = await res.text()
    // Real answers are a few hundred bytes; anything huge is an error page.
    return text.length > 64 * 1024 ? text.slice(0, 64 * 1024) : text
  } catch {
    return null
  } finally {
    window.clearTimeout(timer)
    signal?.removeEventListener('abort', relay)
  }
}

/* ==========================================================================
   Reading the answers
   ========================================================================== */

function json(text: string): Record<string, unknown> | null {
  try {
    const data: unknown = JSON.parse(text)
    return data && typeof data === 'object' ? (data as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function text(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const clean = value.replace(/\s+/g, ' ').trim()
  if (!clean) return undefined
  if (/^(-+|unknown|unbekannt|n\/a|none|null)$/i.test(clean)) return undefined
  return clean
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

/**
 * Icecast and Shoutcast put the whole line into one field: "Artist - Titel".
 * Some stations only send a show name, which is still better than nothing.
 */
function splitLine(line: string | undefined): RadioNow | null {
  if (!line) return null
  const parts = line.split(/\s+[-–—]\s+/)
  if (parts.length >= 2) {
    const artist = text(parts[0])
    const title = text(parts.slice(1).join(' - '))
    if (title) return { artist, title }
  }
  const title = text(line)
  return title ? { title } : null
}

function parseIcecast(body: string, mount: string, station?: string): RadioNow | null {
  const source = record(json(body)?.icestats)?.source
  const entries = (Array.isArray(source) ? source : [source])
    .map(record)
    .filter((entry): entry is Record<string, unknown> => Boolean(entry))
  const entry = pickSource(entries, mount, station)
  if (!entry) return null

  const artist = text(entry.artist)
  const title = text(entry.title) ?? text(entry.song)
  if (!title) return artist ? { artist } : null
  if (artist) return { artist, title }
  return splitLine(title)
}

/**
 * One Icecast server can carry fifty streams, and picking the wrong one shows
 * the wrong song. So: the exact mount first, then a name that contains the
 * stream's own name — but only when that is unambiguous — then the station name,
 * and only then the single stream of a single-stream server.
 */
function pickSource(
  entries: Array<Record<string, unknown>>,
  mount: string,
  station?: string,
): Record<string, unknown> | null {
  if (!entries.length) return null

  const path = stripSlash(mount)
  const exact = entries.find((entry) => {
    const listenUrl = text(entry.listenurl)
    if (!listenUrl) return false
    try {
      return stripSlash(new URL(listenUrl, 'http://localhost').pathname) === path
    } catch {
      return false
    }
  })
  if (exact) return exact

  const key = mountKey(mount)
  if (key.length >= 3) {
    const hits = entries.filter((entry) =>
      `${text(entry.listenurl) ?? ''} ${text(entry.server_name) ?? ''}`.toLowerCase().includes(key),
    )
    if (hits.length === 1) return hits[0]
  }

  const name = station?.trim().toLowerCase()
  if (name) {
    const hits = entries.filter((entry) => (text(entry.server_name) ?? '').toLowerCase() === name)
    if (hits.length === 1) return hits[0]
  }

  return entries.length === 1 ? entries[0] : null
}

function stripSlash(path: string): string {
  return path.replace(/\/+$/, '')
}

/** "/iloveradio1.mp3" -> "iloveradio1": the part a server name tends to repeat. */
function mountKey(mount: string): string {
  const last = stripSlash(mount).split('/').filter(Boolean).pop() ?? ''
  return last.replace(/\.(mp3|aac|ogg|opus|m3u8|pls)$/i, '').replace(/[;?].*$/, '').toLowerCase()
}

function parseShoutcastLine(body: string): RadioNow | null {
  const plain = body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  // A server that does not speak Shoutcast answers with its error page.
  if (!plain || plain.length > 250) return null
  if (/doctype|<html|not an icecast|not a shoutcast/i.test(plain)) return null
  return splitLine(plain)
}

function parseShoutcastStats(body: string): RadioNow | null {
  const data = json(body)
  if (!data) return null
  return splitLine(text(data.currentsong) ?? text(data.streamtitle) ?? text(data.songtitle))
}

function parseLautFm(body: string): RadioNow | null {
  const data = json(body)
  if (!data) return null
  return pick(text(record(data.artist)?.name), text(data.title))
}

function parseAzuraCast(body: string): RadioNow | null {
  const song = record(record(json(body)?.now_playing)?.song)
  if (!song) return null
  return pick(text(song.artist), text(song.title))
}

/** A station that names nothing at all is not an answer. */
function pick(artist: string | undefined, title: string | undefined): RadioNow | null {
  return artist || title ? { artist, title } : null
}
