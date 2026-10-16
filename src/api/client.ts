import { md5 } from '../lib/md5'
import type {
  Album,
  AlbumListType,
  Artist,
  ArtistIndex,
  ArtistInfo,
  Genre,
  MusicFolder,
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
  musicFolders?: { musicFolder?: MusicFolder | MusicFolder[] }
  artistInfo2?: ArtistInfo
  topSongs?: { song?: Song[] }
  randomSongs?: { song?: Song[] }
  similarSongs2?: { song?: Song[] }
  lyrics?: { artist?: string; title?: string; value?: string }
  lyricsList?: { structuredLyrics?: StructuredLyrics | StructuredLyrics[] }
}

type LyricLine = { start?: number; value?: string }
type StructuredLyrics = {
  lang?: string
  synced?: boolean
  line?: LyricLine | LyricLine[]
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
  folderIds: string[] = []
  private albumCache: { key: string; albums: Album[] } | null = null
  private artistCache: {
    key: string
    ids: Set<string>
    art: Map<string, string | undefined>
  } | null = null

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
    const pages = await this.forFolders((folder) =>
      this.request('getAlbumList2', {
        type,
        size: String(PAGE),
        offset: String(offset),
        ...folder,
      }),
    )
    return uniqueBy(
      pages.flatMap((data) => data.albumList2?.album ?? []),
      (a) => a.id,
    )
  }

  async getGenres(): Promise<Genre[]> {
    // Navidrome's getGenres endpoint ignores musicFolderId, so when a library
    // filter is active we derive the genre list from that library's albums.
    if (this.folderIds.length === 0) {
      const data = await this.request('getGenres')
      const list = data.genres?.genre
      if (!list) return []
      return Array.isArray(list) ? list : [list]
    }
    const albums = await this.getSelectedAlbums()
    const stats = new Map<string, { albumCount: number; songCount: number }>()
    for (const album of albums) {
      const genre = album.genre?.trim()
      if (!genre) continue
      const entry = stats.get(genre) ?? { albumCount: 0, songCount: 0 }
      entry.albumCount += 1
      entry.songCount += album.songCount ?? 0
      stats.set(genre, entry)
    }
    return [...stats.entries()].map(([value, entry]) => ({
      value,
      albumCount: entry.albumCount,
      songCount: entry.songCount,
    }))
  }

  async getAlbumsByGenre(genre: string, offset = 0): Promise<Album[]> {
    const pages = await this.forFolders((folder) =>
      this.request('getAlbumList2', {
        type: 'byGenre',
        genre,
        size: String(PAGE),
        offset: String(offset),
        ...folder,
      }),
    )
    return uniqueBy(
      pages.flatMap((data) => data.albumList2?.album ?? []),
      (a) => a.id,
    )
  }

  async getSongsByGenre(genre: string, offset = 0): Promise<Song[]> {
    const pages = await this.forFolders((folder) =>
      this.request('getSongsByGenre', {
        genre,
        count: String(PAGE),
        offset: String(offset),
        ...folder,
      }),
    )
    return uniqueBy(
      pages.flatMap((data) => data.songsByGenre?.song ?? []),
      (s) => s.id,
    )
  }

  // Navidrome has no "artists by genre" endpoint, so a genre's artists are
  // derived from its albums. Pages through the albums (until a page comes back
  // short or `stopWhenImageFound` is satisfied) and aggregates per artist.
  private async scanGenreArtists(
    genre: string,
    pages: number,
    stopWhenImageFound: boolean,
  ): Promise<{
    byArtist: Map<string, { name: string; albums: number; songs: number; cover?: string }>
    art: Map<string, string | undefined>
    genreCover?: string
  }> {
    const { art } = await this.getArtistIndex()
    const byArtist = new Map<string, { name: string; albums: number; songs: number; cover?: string }>()
    let genreCover: string | undefined
    let hasImage = false
    let offset = 0
    for (let page = 0; page < pages; page++) {
      const albums = await this.getAlbumsByGenre(genre, offset)
      for (const album of albums) {
        if (!genreCover && album.coverArt) genreCover = album.coverArt
        const id = album.artistId
        if (!id) continue
        let entry = byArtist.get(id)
        if (!entry) {
          entry = { name: album.artist ?? '', albums: 0, songs: 0, cover: undefined }
          byArtist.set(id, entry)
        }
        entry.albums += 1
        entry.songs += album.songCount ?? 0
        if (!entry.cover && album.coverArt) entry.cover = album.coverArt
        if (!entry.name && album.artist) entry.name = album.artist
        if (art.get(id)) hasImage = true
      }
      if (albums.length < PAGE) break
      if (stopWhenImageFound && hasImage) break
      offset += albums.length
    }
    return { byArtist, art, genreCover }
  }

  // Represent a genre with the artist that has the most songs in it, but always
  // prefer an artist the server actually has a picture for, so as many genres as
  // possible show real artwork. Falls back to an album cover when no artist in
  // the genre has an image.
  async getGenreTopArtist(genre: string): Promise<Artist | null> {
    const { byArtist, art, genreCover } = await this.scanGenreArtists(genre, 3, true)
    if (!byArtist.size) return null
    const candidates = [...byArtist.entries()].map(([id, entry]) => ({
      id,
      ...entry,
      image: art.get(id),
    }))
    candidates.sort((a, b) => {
      if (Boolean(b.image) !== Boolean(a.image)) return a.image ? -1 : 1
      return b.songs - a.songs
    })
    const best = candidates[0]
    return {
      id: best.id,
      name: best.name,
      coverArt: best.image ?? best.cover ?? genreCover,
    }
  }

  // Every artist that appears in the genre, with artwork where the server has
  // it and an album-cover fallback otherwise.
  async getGenreArtists(genre: string): Promise<Artist[]> {
    const { byArtist, art, genreCover } = await this.scanGenreArtists(genre, 5, false)
    return [...byArtist.entries()]
      .map(([id, entry]) => ({
        id,
        name: entry.name,
        albumCount: entry.albums,
        coverArt: art.get(id) ?? entry.cover ?? genreCover,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  private async getSelectedAlbums(): Promise<Album[]> {
    const key = this.folderIds.join(',')
    if (this.albumCache?.key === key) return this.albumCache.albums
    const albums = await this.getAllAlbums()
    this.albumCache = { key, albums }
    return albums
  }

  private async getArtistIndex(): Promise<{
    ids: Set<string>
    art: Map<string, string | undefined>
  }> {
    const key = this.folderIds.join(',')
    if (this.artistCache?.key === key) return this.artistCache
    const ids = new Set<string>()
    const art = new Map<string, string | undefined>()
    for (const group of await this.getArtists()) {
      for (const artist of group.artist ?? []) {
        ids.add(artist.id)
        art.set(artist.id, artist.coverArt)
      }
    }
    this.artistCache = { key, ids, art }
    return this.artistCache
  }

  private async getSelectedArtistIds(): Promise<Set<string>> {
    return (await this.getArtistIndex()).ids
  }

  private async libraryFilter(): Promise<{ albums: Set<string>; artists: Set<string> }> {
    const [albumList, artists] = await Promise.all([
      this.getSelectedAlbums(),
      this.getSelectedArtistIds(),
    ])
    return { albums: new Set(albumList.map((a) => a.id)), artists }
  }

  // Endpoints without a musicFolderId parameter (search, similar songs, …) are
  // filtered here so the selected libraries behave as if nothing else exists.
  private async filterSongs(songs: Song[]): Promise<Song[]> {
    const distinct = uniqueBy(songs, (s) => s.id)
    if (this.folderIds.length === 0) return distinct
    const { albums, artists } = await this.libraryFilter()
    return distinct.filter((song) => {
      if (song.albumId) return albums.has(song.albumId)
      if (song.artistId) return artists.has(song.artistId)
      return true
    })
  }

  private async getAllAlbums(): Promise<Album[]> {
    const byId = new Map<string, Album>()
    const folders = this.folderIds.length ? this.folderIds : ['']
    for (const folderId of folders) {
      let offset = 0
      for (;;) {
        const extra: Record<string, string> = {
          type: 'alphabeticalByName',
          size: '500',
          offset: String(offset),
        }
        if (folderId) extra.musicFolderId = folderId
        const data = await this.request('getAlbumList2', extra)
        const page = data.albumList2?.album ?? []
        for (const album of page) if (!byId.has(album.id)) byId.set(album.id, album)
        if (page.length < 500) break
        offset += page.length
      }
    }
    return [...byId.values()]
  }

  async getAlbum(id: string): Promise<Album> {
    const data = await this.request('getAlbum', { id })
    if (!data.album) throw new Error('Album nicht gefunden')
    return data.album
  }

  async getArtists(): Promise<ArtistIndex[]> {
    const pages = await this.forFolders((folder) => this.request('getArtists', folder))
    const byLetter = new Map<string, Map<string, Artist>>()
    for (const data of pages) {
      for (const group of data.artists?.index ?? []) {
        let bucket = byLetter.get(group.name)
        if (!bucket) {
          bucket = new Map()
          byLetter.set(group.name, bucket)
        }
        for (const artist of group.artist ?? []) bucket.set(artist.id, artist)
      }
    }
    return [...byLetter.entries()].map(([name, artists]) => ({
      name,
      artist: [...artists.values()],
    }))
  }

  async getMusicFolders(): Promise<MusicFolder[]> {
    const data = await this.request('getMusicFolders')
    const list = data.musicFolders?.musicFolder
    if (!list) return []
    const folders = Array.isArray(list) ? list : [list]
    return folders.map((f) => ({ id: String(f.id), name: f.name }))
  }

  async getArtistInfo(id: string): Promise<ArtistInfo> {
    const data = await this.request('getArtistInfo2', { id, count: '8' })
    return data.artistInfo2 ?? {}
  }

  async getTopSongs(artist: string): Promise<Song[]> {
    const data = await this.request('getTopSongs', { artist, count: '30' })
    return this.filterSongs(data.topSongs?.song ?? [])
  }

  async getSimilarSongs(id: string, count = 40): Promise<Song[]> {
    const data = await this.request('getSimilarSongs2', { id, count: String(count) })
    return this.filterSongs(data.similarSongs2?.song ?? [])
  }

  async getLyricsForSong(song: Song): Promise<string> {
    try {
      const data = await this.request('getLyricsBySongId', { id: song.id })
      const text = structuredLyricsText(data.lyricsList?.structuredLyrics)
      if (text) return text
    } catch {
      /* older servers */
    }
    try {
      const extra: Record<string, string> = { title: song.title }
      if (song.artist) extra.artist = song.artist
      const data = await this.request('getLyrics', extra)
      return (data.lyrics?.value ?? '').trim()
    } catch {
      return ''
    }
  }

  async getRandomSongs(size = 40, genre?: string): Promise<Song[]> {
    const pages = await this.forFolders((folder) =>
      this.request('getRandomSongs', {
        size: String(size),
        ...(genre ? { genre } : {}),
        ...folder,
      }),
    )
    return uniqueBy(
      pages.flatMap((data) => data.randomSongs?.song ?? []),
      (s) => s.id,
    ).slice(0, size)
  }

  async getArtist(id: string): Promise<Artist> {
    const data = await this.request('getArtist', { id })
    if (!data.artist) throw new Error('Künstler nicht gefunden')
    const artist = data.artist
    let albums = uniqueBy(artist.album ?? [], (a) => a.id)
    if (this.folderIds.length > 0) {
      const allowed = new Set((await this.getSelectedAlbums()).map((a) => a.id))
      albums = albums.filter((album) => allowed.has(album.id))
    }
    artist.album = albums
    return artist
  }

  async getPlaylists(): Promise<Playlist[]> {
    const data = await this.request('getPlaylists')
    const lists = data.playlists?.playlist ?? []
    // Navidrome playlists are not scoped to a library, so when a filter is
    // active keep only playlists that actually contain songs from that library.
    if (this.folderIds.length === 0) return lists
    const albumIds = new Set((await this.getSelectedAlbums()).map((a) => a.id))
    const checks = await Promise.all(
      lists.map(async (list) => {
        try {
          const full = await this.getPlaylist(list.id)
          const entries = full.entry ?? []
          return entries.some((song) => song.albumId && albumIds.has(song.albumId)) ? list : null
        } catch {
          return list
        }
      }),
    )
    return checks.filter((list): list is Playlist => list !== null)
  }

  async getPlaylist(id: string): Promise<Playlist> {
    const data = await this.request('getPlaylist', { id })
    if (!data.playlist) throw new Error('Playlist nicht gefunden')
    return data.playlist
  }

  async search(query: string): Promise<SearchResult> {
    const data = await this.request('search3', {
      query,
      artistCount: '12',
      albumCount: '24',
      songCount: '40',
    })
    const result = data.searchResult3 ?? {}
    const allArtists = uniqueBy(result.artist ?? [], (a) => a.id)
    const allAlbums = uniqueBy(result.album ?? [], (a) => a.id)
    const allSongs = uniqueBy(result.song ?? [], (s) => s.id)
    if (this.folderIds.length === 0) {
      return { artist: allArtists, album: allAlbums, song: allSongs }
    }
    const { albums, artists } = await this.libraryFilter()
    return {
      artist: allArtists.filter((a) => artists.has(a.id)),
      album: allAlbums.filter((a) => albums.has(a.id)),
      song: allSongs.filter((s) =>
        s.albumId ? albums.has(s.albumId) : s.artistId ? artists.has(s.artistId) : true,
      ),
    }
  }

  async getStarred(): Promise<SearchResult> {
    const pages = await this.forFolders((folder) => this.request('getStarred2', folder))
    return {
      artist: uniqueBy(pages.flatMap((data) => data.starred2?.artist ?? []), (a) => a.id),
      album: uniqueBy(pages.flatMap((data) => data.starred2?.album ?? []), (a) => a.id),
      song: uniqueBy(pages.flatMap((data) => data.starred2?.song ?? []), (s) => s.id),
    }
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

  private async forFolders(
    run: (folder: Record<string, string>) => Promise<SubsonicResponse>,
  ): Promise<SubsonicResponse[]> {
    const ids = this.folderIds
    if (ids.length <= 1) {
      const folder: Record<string, string> = ids.length === 1 ? { musicFolderId: ids[0] } : {}
      return [await run(folder)]
    }
    return Promise.all(ids.map((id) => run({ musicFolderId: id })))
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
        'Server nicht erreichbar. Prüfe die URL, ob Navidrome läuft und ob CORS erlaubt ist.',
      )
    }
    if (!res.ok) {
      throw new Error(`Server antwortete mit HTTP ${res.status}`)
    }
    const json = (await res.json()) as { 'subsonic-response'?: SubsonicResponse }
    const data = json['subsonic-response']
    if (!data) throw new Error('Unerwartete Antwort vom Server')
    if (data.status === 'failed') {
      throw new Error(data.error?.message ?? 'Anmeldung oder Anfrage fehlgeschlagen')
    }
    return data
  }
}

function asList<T>(value: T | T[] | undefined): T[] {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function structuredLyricsText(raw: StructuredLyrics | StructuredLyrics[] | undefined): string {
  for (const block of asList(raw)) {
    const text = asList(block.line)
      .map((line) => line.value?.trim() ?? '')
      .filter(Boolean)
      .join('\n')
      .trim()
    if (text) return text
  }
  return ''
}

function uniqueBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const item of items) {
    const id = key(item)
    if (seen.has(id)) continue
    seen.add(id)
    out.push(item)
  }
  return out
}

function randomSalt(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export const ALBUM_PAGE = PAGE
