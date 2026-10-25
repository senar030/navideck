export function formatTime(seconds: number | undefined): string {
  if (seconds == null || Number.isNaN(seconds) || seconds < 0) return '0:00'
  const s = Math.floor(seconds % 60)
  const m = Math.floor(seconds / 60) % 60
  const h = Math.floor(seconds / 3600)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export type SongSort = 'original' | 'title' | 'artist' | 'album' | 'duration'

export function sortSongs<T extends { title: string; artist?: string; album?: string; duration?: number; discNumber?: number; track?: number }>(
  songs: T[],
  sort: SongSort,
  descending = false,
): T[] {
  if (sort === 'original') return descending ? [...songs].reverse() : songs
  const copy = [...songs]
  copy.sort((a, b) => {
    let cmp = 0
    if (sort === 'title') cmp = a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
    else if (sort === 'artist') cmp = (a.artist ?? '').localeCompare(b.artist ?? '', undefined, { sensitivity: 'base' })
    else if (sort === 'album') cmp = (a.album ?? '').localeCompare(b.album ?? '', undefined, { sensitivity: 'base' })
    else cmp = (a.duration ?? 0) - (b.duration ?? 0)
    return descending ? -cmp : cmp
  })
  return copy
}

export function stripHtml(input: string | undefined): string {
  if (!input) return ''
  return input
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()
}

export function normalizeServerUrl(input: string): string {
  let url = input.trim()
  if (!url) return url
  if (!/^https?:\/\//i.test(url)) url = `http://${url}`
  return url.replace(/\/+$/, '')
}

/**
 * Nextcloud's Music app serves the Subsonic API below /apps/music/subsonic.
 * People paste the Music page instead of the API URL, so that link gets
 * completed here.
 */
export function normalizeSubsonicUrl(input: string): string {
  const url = normalizeServerUrl(input)
  if (!url) return url
  return /\/apps\/music$/i.test(url) ? `${url}/subsonic` : url
}
