import type { RadioStation, Song } from '../api/types'

/** What both the directory hit and the stored station have in common. */
export type RadioSource = {
  key: string
  name: string
  url: string
  subtitle?: string
  logo?: string
  homepage?: string
}

/**
 * The queue entry for a live stream. It carries the stream URL instead of a
 * Navidrome id, which is what makes the player treat it as radio: no seek bar,
 * no preloading, no scrobbling.
 */
export function radioSong(source: RadioSource): Song {
  return {
    id: `radio:${source.key}`,
    title: source.name,
    artist: 'Internetradio',
    album: source.subtitle || undefined,
    duration: 0,
    radio: { url: source.url, logo: source.logo, homepage: source.homepage },
  }
}

/** "Deutschland · 128 kbps MP3", leaving out whatever the station does not say. */
export function radioSubtitle(parts: Array<string | undefined>): string {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(' · ')
}

export function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

/** Where a followed station should be played from, logo and all. */
export function followedSource(
  station: RadioStation,
  logos: Record<string, string>,
  coverUrl: (coverArt: string, size: number) => string | undefined,
): RadioSource {
  return {
    key: station.id,
    name: station.name,
    url: station.streamUrl,
    subtitle: hostOf(station.streamUrl),
    // A logo uploaded in Navidrome wins over the one the directory told us.
    logo: (station.coverArt && coverUrl(station.coverArt, 300)) || logos[station.streamUrl],
    homepage: station.homePageUrl,
  }
}
