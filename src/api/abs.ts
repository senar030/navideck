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

/**
 * A file on the server. The item detail answers with these rather than with
 * ready-made tracks, and its contents are what a track is built from.
 */
export type AbsAudioFile = {
  ino: string
  duration?: number
  mimeType?: string
  exclude?: boolean
  metadata?: { filename?: string; path?: string; size?: number }
}

export type AbsChapter = { start: number; end: number; title: string }

export type AbsBook = {
  metadata: AbsBookMeta
  coverPath?: string | null
  duration: number
  numTracks?: number
  numAudioFiles?: number
  numChapters?: number
  audioFiles?: AbsAudioFile[] | null
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
  libraryId?: string
  /** The feed's identifier, used to match an episode against the feed. */
  guid?: string | null
  /** The show, as the recent-episodes endpoint sends it with every episode. */
  podcast?: (AbsPodcast & { libraryItemId?: string }) | null
  audioFile?: AbsAudioFile | null
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
  /** Whether the server downloads new feed episodes by itself. */
  autoDownloadEpisodes?: boolean
  /** Cron expression for that check. */
  autoDownloadSchedule?: string
  maxEpisodesToKeep?: number
  maxNewEpisodesToDownload?: number
  lastEpisodeCheck?: number
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

/** One episode as the server parsed it from the RSS feed. */
export type AbsFeedEpisode = {
  title: string
  subtitle?: string
  description?: string
  descriptionPlain?: string
  pubDate?: string
  episodeType?: string
  season?: string
  episode?: string
  author?: string
  duration?: string
  durationSeconds?: number | null
  explicit?: string
  publishedAt?: number | null
  enclosure?: { url: string; type?: string | null; length?: string | number | null } | null
  guid?: string | null
}

/** What `/api/podcasts/feed` returns: the show and its feed episodes. */
export type AbsFeedPodcast = {
  metadata: {
    title?: string
    author?: string
    description?: string
    descriptionPlain?: string
    image?: string
    feedUrl?: string
    genres?: string[]
    explicit?: boolean
    language?: string
    type?: string
  }
  episodes: AbsFeedEpisode[]
}

export type AbsShelf = {
  id: string
  label: string
  type: string
  entities: AbsLibraryItem[]
}

/** A player-ready track built from a file the server listed. */
function trackOf(itemId: string, file: AbsAudioFile, index: number, startOffset: number): AbsTrack {
  return {
    index,
    startOffset,
    duration: file.duration ?? 0,
    title: file.metadata?.filename || `Datei ${index + 1}`,
    contentUrl: `/api/items/${encodeURIComponent(itemId)}/file/${encodeURIComponent(file.ino)}`,
    mimeType: file.mimeType,
  }
}

/**
 * Fills in what the player needs and the server may not send: `tracks` for a
 * book, `audioTrack` for an episode, and a duration for a book. The item detail
 * only lists audio files unless it is asked to expand them, and a book without
 * tracks simply played nothing at all.
 */
export function expandItem(item: AbsLibraryItem): AbsLibraryItem {
  if (item.mediaType === 'book') {
    const book = item.media as AbsBook
    if (!book) return item
    const files = (book.audioFiles ?? []).filter((file) => file.ino && !file.exclude)
    let startOffset = 0
    const tracks = book.tracks?.length
      ? book.tracks
      : files.map((file, index) => {
          const track = trackOf(item.id, file, index, startOffset)
          startOffset += track.duration
          return track
        })
    const duration = book.duration || tracks.reduce((sum, track) => sum + (track.duration || 0), 0)
    return {
      ...item,
      media: {
        ...book,
        tracks: tracks.length ? tracks : book.tracks,
        duration,
        numTracks: book.numTracks ?? (tracks.length || undefined),
      },
    }
  }

  if (item.mediaType === 'podcast') {
    const podcast = item.media as AbsPodcast
    const episodes = podcast.episodes?.map(expandEpisode)
    return episodes ? { ...item, media: { ...podcast, episodes } } : item
  }

  return item
}

/** An episode that only carries its file still needs the track to be playable. */
function expandEpisode(episode: AbsEpisode): AbsEpisode {
  if (episode.audioTrack?.contentUrl || !episode.audioFile?.ino || !episode.libraryItemId) {
    return episode
  }
  return { ...episode, audioTrack: trackOf(episode.libraryItemId, episode.audioFile, 0, 0) }
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

/** One directory name the server will accept for a new show. */
function podcastFolderName(title: string): string {
  const cleaned = Array.from(title)
    .filter((char) => char.charCodeAt(0) >= 32)
    .join('')
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '')
  return cleaned.slice(0, 120) || 'Podcast'
}

const TIMEOUT_MS = 15_000

async function failure(res: Response): Promise<string> {
  /*
   * Audiobookshelf explains most refuseals as plain text ("Podcast already
   * exists", "Podcast path must be inside..."), not as JSON. Read the body once
   * and prefer it over the generic status text.
   */
  let text = ''
  try {
    text = (await res.text()).trim()
  } catch {
    /* no body */
  }
  if (text) {
    try {
      const data: unknown = JSON.parse(text)
      if (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string') {
        return data.error
      }
    } catch {
      /* plain text is the message */
    }
    return text.length > 300 ? `${text.slice(0, 300)}…` : text
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
  readonly kind = 'audiobookshelf' as const
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

  /** For endpoints that answer with an empty body or a plain "OK". */
  private async requestVoid(path: string, init: RequestInit = {}): Promise<void> {
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

  /**
   * The account. Audiobookshelf sends the user bare from /api/me; only /login
   * wraps it in `user`. A proxy or an older server may still wrap it, so both
   * shapes are read — reading the wrong one used to hand back undefined and
   * take the whole app down.
   */
  async getMe(): Promise<AbsUser> {
    const data = await this.request<AbsUser | { user?: AbsUser }>('/api/me')
    if (data && typeof data === 'object' && 'user' in data && data.user) return data.user
    if (data && typeof data === 'object' && 'id' in data) return data as AbsUser
    throw new AbsError(0, 'Der Server hat kein Benutzerprofil zurückgegeben.')
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
    return (data.results ?? []).map(expandItem)
  }

  async getItem(itemId: string): Promise<AbsLibraryItem> {
    const data = await this.request<{ libraryItem?: AbsLibraryItem } | AbsLibraryItem>(
      `/api/items/${encodeURIComponent(itemId)}?expanded=1`,
    )
    const item = 'libraryItem' in data && data.libraryItem ? data.libraryItem : (data as AbsLibraryItem)
    return expandItem(item)
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

  /**
   * The server's own "what is new": unfinished episodes, newest first. This is
   * the only endpoint that lists episodes across shows — the item list is
   * always minified and carries no episodes at all.
   */
  async getRecentEpisodes(
    libraryId: string,
    opts: { limit?: number; page?: number } = {},
  ): Promise<AbsEpisode[]> {
    const query = new URLSearchParams()
    if (opts.limit) query.set('limit', String(opts.limit))
    if (opts.page) query.set('page', String(opts.page))
    const suffix = query.toString()
    const data = await this.request<{ episodes: AbsEpisode[] }>(
      `/api/libraries/${encodeURIComponent(libraryId)}/recent-episodes${suffix ? `?${suffix}` : ''}`,
    )
    return (data.episodes ?? []).map(expandEpisode)
  }

  /* --------------------------------------------------------------- podcasts */

  async searchPodcasts(term: string, country = 'de'): Promise<AbsPodcastSearchResult[]> {
    const query = new URLSearchParams({ term, country })
    const data = await this.request<AbsPodcastSearchResult[] | { results: AbsPodcastSearchResult[] }>(
      `/api/search/podcast?${query.toString()}`,
    )
    return Array.isArray(data) ? data : (data.results ?? [])
  }

  /** Lets the server fetch and parse the RSS feed, episodes included. */
  async getPodcastFeed(rssFeed: string): Promise<AbsFeedPodcast> {
    const data = await this.request<{ podcast?: AbsFeedPodcast }>('/api/podcasts/feed', {
      method: 'POST',
      body: JSON.stringify({ rssFeed }),
    })
    if (!data.podcast) throw new AbsError(0, 'Der Server konnte den Feed nicht lesen.')
    return data.podcast
  }

  /** Queues the selected feed episodes; the server adds them to the show. */
  async downloadEpisodes(itemId: string, episodes: AbsFeedEpisode[]): Promise<void> {
    if (!episodes.length) return
    await this.requestVoid(`/api/podcasts/${encodeURIComponent(itemId)}/download-episodes`, {
      method: 'POST',
      body: JSON.stringify(episodes),
    })
  }

  /** Turns automatic episode downloads on or off for an existing show. */
  async updatePodcast(
    itemId: string,
    patch: { autoDownloadEpisodes?: boolean; autoDownloadSchedule?: string },
  ): Promise<void> {
    await this.request(`/api/items/${encodeURIComponent(itemId)}/media`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
  }

  /** Hand a feed the server found to the library; it downloads the episodes. */
  async addPodcast(input: {
    libraryId: string
    folderId: string
    /** The library folder's own path, e.g. `/podcasts`. */
    folderPath: string
    result: AbsPodcastSearchResult
    autoDownloadEpisodes?: boolean
    autoDownloadSchedule?: string
  }): Promise<AbsLibraryItem> {
    const { result } = input
    if (!input.folderPath.trim()) {
      throw new AbsError(0, 'Dem Podcast-Ordner fehlt der Pfad. Bitte in Audiobookshelf prüfen.')
    }
    const base = input.folderPath.trim().replace(/\\/g, '/').replace(/\/+$/, '')
    /*
     * The server wants the folder the new show will live in and refuses (400)
     * anything outside the library folder. One directory below the library
     * root, named after the show; characters Windows cannot use in a name are
     * dropped so the server can create it.
     */
    const path = `${base}/${podcastFolderName(result.title)}`
    const body = {
      libraryId: input.libraryId,
      folderId: input.folderId,
      path,
      media: {
        autoDownloadEpisodes: Boolean(input.autoDownloadEpisodes),
        ...(input.autoDownloadSchedule ? { autoDownloadSchedule: input.autoDownloadSchedule } : {}),
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
