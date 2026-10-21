import { normalizeServerUrl } from '../lib/format'

/*
 * Audiobookshelf, the second kind of server the app talks to.
 *
 * Everything here is a thin, typed wrapper around the documented HTTP API:
 * no caching, no state, no React. The account provider decides which server
 * and which library a view reads from.
 */

export type AbsLibrary = {
  id: string
  name: string
  mediaType: 'book' | 'podcast'
  icon?: string
  folders: { id: string; fullPath: string }[]
}

export type AbsProgress = {
  id: string
  libraryItemId: string
  episodeId?: string | null
  duration?: number
  progress?: number
  currentTime?: number
  isFinished?: boolean
  lastUpdate?: number
}

export type AbsUser = {
  id: string
  username: string
  token: string
  type?: string
  mediaProgress?: AbsProgress[]
}

export type AbsSeriesRef = { id: string; name: string; sequence?: string | null }

export type AbsBookMeta = {
  title: string
  subtitle?: string | null
  authorName?: string | null
  authorNameLF?: string | null
  /** Author records with ids, when the server sends them. */
  authors?: { id: string; name: string }[] | null
  narratorName?: string | null
  seriesName?: string | null
  /** Current servers send one object, older ones sent a list. */
  series?: AbsSeriesRef | AbsSeriesRef[] | null
  genres?: string[]
  publishedYear?: string | null
  publishedDate?: string | null
  publisher?: string | null
  description?: string | null
  isbn?: string | null
  asin?: string | null
  language?: string | null
  explicit?: boolean
}

export type AbsTrack = {
  index: number
  startOffset: number
  duration: number
  title: string
  contentUrl: string
  mimeType?: string
}

export type AbsChapter = { start: number; end: number; title: string }

export type AbsBook = {
  metadata: AbsBookMeta
  coverPath?: string | null
  duration: number
  numTracks?: number
  numAudioFiles?: number
  numChapters?: number
  tracks?: AbsTrack[]
  chapters?: AbsChapter[]
}

export type AbsEpisode = {
  id: string
  libraryItemId: string
  index?: number
  season?: string
  episode?: string
  episodeType?: string
  title: string
  subtitle?: string | null
  description?: string | null
  pubDate?: string | null
  publishedAt?: number | null
  addedAt?: number
  audioFile?: { duration?: number; mimeType?: string } | null
  audioTrack?: AbsTrack | null
}

export type AbsPodcastMeta = {
  title: string
  author?: string | null
  description?: string | null
  imageUrl?: string | null
  feedUrl?: string | null
  genres?: string[]
  itunesId?: number | null
  explicit?: boolean
  language?: string | null
  type?: string
}

export type AbsPodcast = {
  metadata: AbsPodcastMeta
  coverPath?: string | null
  numEpisodes?: number
  episodes?: AbsEpisode[]
}

export type AbsLibraryItem = {
  id: string
  libraryId: string
  folderId?: string
  mediaType: 'book' | 'podcast'
  addedAt: number
  updatedAt: number
  media: AbsBook | AbsPodcast
  userMediaProgress?: AbsProgress | null
  collapsedSeries?: { id: string; name: string; numBooks?: number } | null
}

export type AbsAuthor = {
  id: string
  name: string
  description?: string | null
  imagePath?: string | null
  numBooks?: number
  addedAt?: number
  updatedAt?: number
}

export type AbsSeries = {
  id: string
  name: string
  nameIgnorePrefix?: string
  books?: AbsLibraryItem[]
  addedAt?: number
  totalDuration?: number
}

export type AbsCollection = {
  id: string
  libraryId: string
  name: string
  description?: string | null
  books?: AbsLibraryItem[]
  lastUpdate?: number
}

export type AbsPodcastSearchResult = {
  id: number
  artistId?: number
  title: string
  artistName?: string
  description?: string
  descriptionPlain?: string
  releaseDate?: string
  genres?: string[]
  cover?: string
  trackCount?: number
  feedUrl?: string
  pageUrl?: string
  explicit?: boolean
}

export type AbsShelf = {
  id: string
  label: string
  type: string
  entities: AbsLibraryItem[]
}

/** An answer from the server that was not what the app asked for. */
export class AbsError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'AbsError'
    this.status = status
  }
}

const TIMEOUT_MS = 15_000

async function failure(res: Response): Promise<string> {
  try {
    const data: unknown = await res.json()
    if (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string') {
      return data.error
    }
  } catch {
    /* not JSON, fall through */
  }
  if (res.status === 401) return 'Anmeldung abgelaufen'
  if (res.status === 403) return 'Dafür fehlt die Berechtigung'
  if (res.status === 404) return 'Nicht gefunden'
  return res.statusText || `Fehler ${res.status}`
}

/** Logs in and hands back the token Audiobookshelf keeps for the account. */
export async function absLogin(
  server: string,
  username: string,
  password: string,
): Promise<{ baseUrl: string; token: string; user: AbsUser }> {
  const baseUrl = normalizeServerUrl(server)
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    let res: Response
    try {
      res = await fetch(`${baseUrl}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
        signal: controller.signal,
        cache: 'no-store',
      })
    } catch {
      throw new AbsError(
        0,
        'Server nicht erreichbar. Oder er erlaubt den Zugriff aus dem Browser nicht (CORS).',
      )
    }
    if (!res.ok) throw new AbsError(res.status, await failure(res))
    const data = (await res.json()) as { user?: AbsUser }
    if (!data.user?.token) throw new AbsError(0, 'Der Server hat kein Token zurückgegeben.')
    return { baseUrl, token: data.user.token, user: data.user }
  } finally {
    window.clearTimeout(timer)
  }
}

export class AbsClient {
  readonly baseUrl: string
  readonly token: string

  constructor(baseUrl: string, token: string) {
    this.baseUrl = normalizeServerUrl(baseUrl)
    this.token = token
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      let res: Response
      try {
        res = await fetch(`${this.baseUrl}${path}`, {
          ...init,
          signal: controller.signal,
          cache: 'no-store',
          headers: {
            Authorization: `Bearer ${this.token}`,
            ...(init.body ? { 'Content-Type': 'application/json' } : {}),
            ...init.headers,
          },
        })
      } catch {
        throw new AbsError(
          0,
          'Server nicht erreichbar. Oder er erlaubt den Zugriff aus dem Browser nicht (CORS).',
        )
      }
      if (!res.ok) throw new AbsError(res.status, await failure(res))
      if (res.status === 204) return undefined as T
      return (await res.json()) as T
    } finally {
      window.clearTimeout(timer)
    }
  }

  /* ---------------------------------------------------------------- account */

  /** Confirms the token and returns the user it belongs to. */
  async authorize(): Promise<AbsUser> {
    const data = await this.request<{ user: AbsUser }>('/api/authorize')
    return data.user
  }

  async getMe(): Promise<AbsUser> {
    const data = await this.request<{ user: AbsUser }>('/api/me')
    return data.user
  }

  async getLibraries(): Promise<AbsLibrary[]> {
    const data = await this.request<{ libraries: AbsLibrary[] }>('/api/libraries')
    return data.libraries ?? []
  }

  /* --------------------------------------------------------------- browsing */

  /** Everything in a library. Minified for lists, full for details. */
  async getItems(
    libraryId: string,
    opts: { sort?: string; desc?: boolean; minified?: boolean; collapseseries?: boolean } = {},
  ): Promise<AbsLibraryItem[]> {
    const query = new URLSearchParams()
    query.set('limit', '0')
    if (opts.sort) query.set('sort', opts.sort)
    if (opts.desc) query.set('desc', '1')
    if (opts.minified) query.set('minified', '1')
    if (opts.collapseseries) query.set('collapseseries', '1')
    const data = await this.request<{ results: AbsLibraryItem[] }>(
      `/api/libraries/${encodeURIComponent(libraryId)}/items?${query.toString()}`,
    )
    return data.results ?? []
  }

  async getItem(itemId: string): Promise<AbsLibraryItem> {
    const data = await this.request<{ libraryItem?: AbsLibraryItem } | AbsLibraryItem>(
      `/api/items/${encodeURIComponent(itemId)}`,
    )
    if ('libraryItem' in data && data.libraryItem) return data.libraryItem
    return data as AbsLibraryItem
  }

  async getAuthors(libraryId: string): Promise<AbsAuthor[]> {
    const data = await this.request<{ authors: AbsAuthor[] }>(
      `/api/libraries/${encodeURIComponent(libraryId)}/authors`,
    )
    return data.authors ?? []
  }

  async getAuthor(authorId: string): Promise<{ author?: AbsAuthor; libraryItems?: AbsLibraryItem[] }> {
    return this.request(`/api/authors/${encodeURIComponent(authorId)}`)
  }

  async getSeries(libraryId: string): Promise<AbsSeries[]> {
    const data = await this.request<{ results: AbsSeries[] }>(
      `/api/libraries/${encodeURIComponent(libraryId)}/series`,
    )
    return data.results ?? []
  }

  async getSeriesById(seriesId: string): Promise<AbsSeries> {
    return this.request(`/api/series/${encodeURIComponent(seriesId)}`)
  }

  async getCollections(libraryId: string): Promise<AbsCollection[]> {
    const data = await this.request<{ results: AbsCollection[] }>(
      `/api/libraries/${encodeURIComponent(libraryId)}/collections`,
    )
    return data.results ?? []
  }

  async getCollection(collectionId: string): Promise<AbsCollection> {
    return this.request(`/api/collections/${encodeURIComponent(collectionId)}`)
  }

  /** Shelves the server builds itself, e.g. "Continue Listening". */
  async getPersonalized(libraryId: string): Promise<AbsShelf[]> {
    return this.request(`/api/libraries/${encodeURIComponent(libraryId)}/personalized`)
  }

  async getRecentEpisodes(libraryId: string): Promise<AbsEpisode[]> {
    const data = await this.request<{ episodes: AbsEpisode[] }>(
      `/api/libraries/${encodeURIComponent(libraryId)}/recent-episodes`,
    )
    return data.episodes ?? []
  }

  /* --------------------------------------------------------------- podcasts */

  async searchPodcasts(term: string): Promise<AbsPodcastSearchResult[]> {
    const data = await this.request<AbsPodcastSearchResult[] | { results: AbsPodcastSearchResult[] }>(
      `/api/search/podcast?term=${encodeURIComponent(term)}`,
    )
    return Array.isArray(data) ? data : (data.results ?? [])
  }

  /** Hands a feed the server found to the library; it downloads the episodes. */
  async addPodcast(input: {
    libraryId: string
    folderId: string
    result: AbsPodcastSearchResult
  }): Promise<AbsLibraryItem> {
    const { result } = input
    const body = {
      libraryId: input.libraryId,
      folderId: input.folderId,
      media: {
        metadata: {
          title: result.title,
          author: result.artistName ?? '',
          description: result.descriptionPlain || result.description || '',
          releaseDate: result.releaseDate ?? null,
          genres: result.genres ?? [],
          feedUrl: result.feedUrl ?? '',
          imageUrl: result.cover ?? null,
          itunesPageUrl: result.pageUrl ?? null,
          itunesId: result.id,
          itunesArtistId: result.artistId ?? null,
          explicit: Boolean(result.explicit),
          language: null,
        },
      },
    }
    const data = await this.request<{ libraryItem?: AbsLibraryItem } | AbsLibraryItem>('/api/podcasts', {
      method: 'POST',
      body: JSON.stringify(body),
    })
    if ('libraryItem' in data && data.libraryItem) return data.libraryItem
    return data as AbsLibraryItem
  }

  /* --------------------------------------------------------------- progress */

  /** Remembers where the user stopped, on the server, so other devices follow. */
  async updateProgress(input: {
    itemId: string
    episodeId?: string
    currentTime: number
    duration: number
    isFinished?: boolean
  }): Promise<void> {
    const path = input.episodeId
      ? `/api/me/progress/${encodeURIComponent(input.itemId)}/${encodeURIComponent(input.episodeId)}`
      : `/api/me/progress/${encodeURIComponent(input.itemId)}`
    const duration = input.duration > 0 ? input.duration : 0
    await this.request(path, {
      method: 'PATCH',
      body: JSON.stringify({
        currentTime: Math.max(0, input.currentTime),
        duration,
        progress: duration > 0 ? Math.min(1, Math.max(0, input.currentTime / duration)) : 0,
        isFinished: Boolean(input.isFinished),
      }),
    })
  }

  /* ----------------------------------------------------------------- images */

  /** A cover for a library item, with the token the server requires. */
  coverUrl(itemId: string, token = this.token): string {
    return `${this.baseUrl}/api/items/${encodeURIComponent(itemId)}/cover?token=${encodeURIComponent(token)}`
  }

  authorImageUrl(authorId: string): string {
    return `${this.baseUrl}/api/authors/${encodeURIComponent(authorId)}/image?token=${encodeURIComponent(this.token)}`
  }

  /** Turns a track's `contentUrl` into something an `<audio>` can open. */
  streamUrl(contentUrl: string): string {
    const absolute = /^https?:\/\//i.test(contentUrl) ? contentUrl : `${this.baseUrl}${contentUrl}`
    return `${absolute}${absolute.includes('?') ? '&' : '?'}token=${encodeURIComponent(this.token)}`
  }
}
