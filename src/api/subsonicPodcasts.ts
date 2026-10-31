import type { AbsEpisode, AbsLibraryItem, AbsPodcast, AbsProgress, AbsTrack } from './abs'
import { AbsError } from './abs'
import { SubsonicClient, type SubsonicPodcastChannel, type SubsonicPodcastEpisode } from './client'

/*
 * Subsonic servers that keep podcasts (Nextcloud Music does) do not know about
 * Audiobookshelf's library model. This adapter asks for the channels and maps
 * them onto the shapes the podcast views already use, so there is one podcast
 * area no matter which server feeds it.
 *
 * Subsonic has no "episode progress" endpoint: Nextcloud explicitly ignores
 * podcast IDs in `scrobble`. Progress therefore stays on this device, keyed by
 * the source, and is merged into the account's progress map at start-up.
 */

const LIBRARY_ID = 'subsonic-podcasts'
const PROGRESS_PREFIX = 'navideck.subsonic.progress.'
const CACHE_MS = 30_000

type StoredProgress = Record<string, AbsProgress>

export type SubsonicPodcastSource = {
  id: string
  name: string
  baseUrl: string
  username: string
  password: string
}

export class SubsonicPodcastClient {
  readonly kind = 'subsonic' as const
  readonly baseUrl: string
  readonly sourceId: string
  readonly name: string

  private readonly sub: SubsonicClient
  private readonly progressKey: string
  private podcasts: { at: number; data: Promise<SubsonicPodcastChannel[]> } | null = null

  constructor(source: SubsonicPodcastSource) {
    this.baseUrl = source.baseUrl
    this.sourceId = source.id
    this.name = source.name
    this.progressKey = `${PROGRESS_PREFIX}${source.id}`
    this.sub = new SubsonicClient(source.baseUrl, source.username, source.password, 'password')
  }

  private channels(): Promise<SubsonicPodcastChannel[]> {
    if (this.podcasts && Date.now() - this.podcasts.at < CACHE_MS) return this.podcasts.data
    const data = this.sub.getPodcasts().catch((error: unknown) => {
      this.podcasts = null
      throw error
    })
    this.podcasts = { at: Date.now(), data }
    return data
  }

  private show(channel: SubsonicPodcastChannel, withEpisodes: boolean): AbsLibraryItem {
    return {
      id: channel.id,
      libraryId: LIBRARY_ID,
      mediaType: 'podcast',
      addedAt: 0,
      updatedAt: 0,
      media: {
        metadata: {
          title: channel.title,
          author: channel.episode?.[0]?.artist ?? null,
          description: channel.description ?? null,
          imageUrl: channel.originalImageUrl ?? null,
          feedUrl: channel.url ?? null,
          genres: [],
        },
        numEpisodes: channel.episode?.length,
        episodes: withEpisodes ? (channel.episode ?? []).map((entry) => this.episode(channel, entry)) : undefined,
      },
    }
  }

  private episode(channel: SubsonicPodcastChannel, entry: SubsonicPodcastEpisode): AbsEpisode {
    const stream = entry.streamId || entry.id
    const track: AbsTrack = {
      index: 0,
      startOffset: 0,
      duration: entry.duration ?? 0,
      title: entry.title,
      contentUrl: this.sub.streamUrl(stream),
    }
    const podcast: AbsPodcast & { libraryItemId?: string } = {
      libraryItemId: channel.id,
      metadata: {
        title: channel.title,
        author: entry.artist ?? null,
        description: channel.description ?? null,
        imageUrl: channel.originalImageUrl ?? null,
        feedUrl: channel.url ?? null,
        genres: [],
      },
      numEpisodes: channel.episode?.length,
    }
    return {
      id: entry.id,
      libraryItemId: channel.id,
      title: entry.title,
      description: entry.description ?? null,
      publishedAt: entry.publishDate ? Date.parse(entry.publishDate) : null,
      podcast,
      audioTrack: track,
    }
  }

  async getItems(_libraryId: string, opts: { minified?: boolean } = {}): Promise<AbsLibraryItem[]> {
    const channels = await this.channels()
    return channels.map((channel) => this.show(channel, !opts.minified))
  }

  async searchItems(_libraryId: string, term: string, limit = 20): Promise<AbsLibraryItem[]> {
    const needle = term.toLocaleLowerCase('de')
    const channels = await this.channels()
    return channels
      .filter((channel) => {
        const haystack = [channel.title, channel.description, channel.episode?.[0]?.artist]
          .filter(Boolean)
          .join(' ')
          .toLocaleLowerCase('de')
        return haystack.includes(needle)
      })
      .slice(0, limit)
      .map((channel) => this.show(channel, false))
  }

  async getRecentEpisodes(
    _libraryId: string,
    opts: { limit?: number } = {},
  ): Promise<AbsEpisode[]> {
    const [episodes, channels] = await Promise.all([
      this.sub.getNewestPodcasts(opts.limit ?? 24),
      this.channels(),
    ])
    const byId = new Map(channels.map((channel) => [channel.id, channel]))
    return episodes.map((entry) => {
      const channel = byId.get(entry.channelId ?? '') ?? {
        id: entry.channelId || entry.coverArt || entry.id,
        title: entry.artist || 'Podcast',
        coverArt: entry.coverArt,
        episode: [entry],
      }
      return this.episode(channel, entry)
    })
  }

  async getItem(id: string): Promise<AbsLibraryItem> {
    const channel = (await this.channels()).find((candidate) => candidate.id === id)
    if (!channel) throw new AbsError(404, 'Podcast nicht gefunden')
    return this.show(channel, true)
  }

  coverUrl(id: string): string {
    return this.sub.coverUrl(id, 400) ?? ''
  }

  /** The stream URL already carries the Subsonic credentials. */
  streamUrl(contentUrl: string): string {
    return contentUrl
  }

  getStoredProgress(): StoredProgress {
    try {
      const raw = localStorage.getItem(this.progressKey)
      if (!raw) return {}
      const data: unknown = JSON.parse(raw)
      return data && typeof data === 'object' ? (data as StoredProgress) : {}
    } catch {
      return {}
    }
  }

  async updateProgress(input: {
    itemId: string
    episodeId?: string
    currentTime: number
    duration: number
    isFinished?: boolean
  }): Promise<void> {
    const key = `${input.itemId}:${input.episodeId ?? ''}`
    const stored = this.getStoredProgress()
    const duration = input.duration > 0 ? input.duration : (stored[key]?.duration ?? 0)
    const currentTime = Math.max(0, input.currentTime)
    stored[key] = {
      id: key,
      libraryItemId: input.itemId,
      episodeId: input.episodeId ?? null,
      currentTime,
      duration,
      progress: duration > 0 ? Math.min(1, currentTime / duration) : 0,
      isFinished: Boolean(input.isFinished),
      lastUpdate: Date.now(),
    }
    try {
      localStorage.setItem(this.progressKey, JSON.stringify(stored))
    } catch {
      /* a full quota must not break playback */
    }
  }
}
