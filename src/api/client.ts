import { md5 } from '../lib/md5'
import type {
  Album,
  AlbumListType,
  Artist,
  ArtistIndex,
  Genre,
  Playlist,
  SearchResult,
  Song,
} from './types'

type SubsonicResponse = {
  status: string
  error?: { code: number; message: string }
  artists?: { index?: ArtistIndex[] }
  artist?: Artist
  album?: Album
  albumList2?: { album?: Album[] }
  playlists?: { playlist?: Playlist[] }
  playlist?: Playlist
  searchResult3?: SearchResult
  starred2?: { artist?: Artist[]; album?: Album[]; song?: Song[] }
  genres?: { genre?: Genre | Genre[] }
  songsByGenre?: { song?: Song[] }
}

const CLIENT = 'Navideck'
const VERSION = '1.16.1'
const PAGE = 48

export class NavidromeClient {
  readonly baseUrl: string
  readonly username: string
  private readonly password: string
  private readonly salt: string
  private readonly token: string

  constructor(baseUrl: string, username: string, password: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '')
    this.username = username
    this.password = password
    this.salt = randomSalt()
    this.token = md5(password + this.salt)
  }

  authPayload() {
    return {
      baseUrl: this.baseUrl,
      username: this.username,
      password: this.password,
    }
  }

  coverUrl(id: string | undefined, size = 300): string | undefined {
    if (!id) return undefined
    return this.buildUrl('getCoverArt', { id, size: String(size) })
  }

  streamUrl(id: string): string {
    return this.buildUrl('stream', { id })
  }

  async ping(): Promise<void> {
    await this.request('ping')
  }

  async getAlbumList(type: AlbumListType, offset = 0): Promise<Album[]> {
    const data = await this.request('getAlbumList2', {
      type,
      size: String(PAGE),
      offset: String(offset),
    })
    return data.albumList2?.album ?? []
  }

  async getGenres(): Promise<Genre[]> {
    const data = await this.request('getGenres')
    const list = data.genres?.genre
    if (!list) return []
    return Array.isArray(list) ? list : [list]
  }

  async getAlbumsByGenre(genre: string, offset = 0): Promise<Album[]> {
    const data = await this.request('getAlbumList2', {
      type: 'byGenre',
      genre,
      size: String(PAGE),
      offset: String(offset),
    })
    return data.albumList2?.album ?? []
  }

  async getSongsByGenre(genre: string, offset = 0): Promise<Song[]> {
    const data = await this.request('getSongsByGenre', {
      genre,
      count: String(PAGE),
      offset: String(offset),
    })
    return data.songsByGenre?.song ?? []
  }

  async getAlbum(id: string): Promise<Album> {
    const data = await this.request('getAlbum', { id })
    if (!data.album) throw new Error('Album not found')
    return data.album
  }

  async getArtists(): Promise<ArtistIndex[]> {
    const data = await this.request('getArtists')
    return data.artists?.index ?? []
  }

  async getArtist(id: string): Promise<Artist> {
    const data = await this.request('getArtist', { id })
    if (!data.artist) throw new Error('Artist not found')
    return data.artist
  }

  async getPlaylists(): Promise<Playlist[]> {
    const data = await this.request('getPlaylists')
    return data.playlists?.playlist ?? []
  }

  async getPlaylist(id: string): Promise<Playlist> {
    const data = await this.request('getPlaylist', { id })
    if (!data.playlist) throw new Error('Playlist not found')
    return data.playlist
  }

  async search(query: string): Promise<SearchResult> {
    const data = await this.request('search3', {
      query,
      artistCount: '12',
      albumCount: '24',
      songCount: '40',
    })
    return data.searchResult3 ?? {}
  }

  async getStarred(): Promise<SearchResult> {
    const data = await this.request('getStarred2')
    return data.starred2 ?? {}
  }

  async star(id: string, kind: 'id' | 'albumId' | 'artistId' = 'id'): Promise<void> {
    await this.request('star', { [kind]: id })
  }

  async unstar(id: string, kind: 'id' | 'albumId' | 'artistId' = 'id'): Promise<void> {
    await this.request('unstar', { [kind]: id })
  }

  async scrobble(id: string, submission: boolean): Promise<void> {
    try {
      await this.request('scrobble', {
        id,
        submission: submission ? 'true' : 'false',
      })
    } catch {
      /* optional */
    }
  }

  private buildUrl(method: string, extra: Record<string, string> = {}): string {
    const params = new URLSearchParams({
      u: this.username,
      t: this.token,
      s: this.salt,
      v: VERSION,
      c: CLIENT,
      f: 'json',
      ...extra,
    })
    return `${this.baseUrl}/rest/${method}.view?${params.toString()}`
  }

  private async request(
    method: string,
    extra: Record<string, string> = {},
  ): Promise<SubsonicResponse> {
    const url = this.buildUrl(method, extra)
    let res: Response
    try {
      res = await fetch(url)
    } catch {
      throw new Error(
        'Could not reach the server. Check the URL, that Navidrome is running, and that CORS is allowed.',
      )
    }
    if (!res.ok) {
      throw new Error(`Server returned HTTP ${res.status}`)
    }
    const json = (await res.json()) as { 'subsonic-response'?: SubsonicResponse }
    const data = json['subsonic-response']
    if (!data) throw new Error('Unexpected response from server')
    if (data.status === 'failed') {
      throw new Error(data.error?.message ?? 'Login or request failed')
    }
    return data
  }
}

function randomSalt(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export const ALBUM_PAGE = PAGE
