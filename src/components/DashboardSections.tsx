import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ALBUM_PAGE, type NavidromeClient } from '../api/client'
import type { Album, AlbumListType, Genre, Song } from '../api/types'
import { matchMoodGenre, MOODS, type MoodId } from '../lib/moods'
import { useAuth } from '../state/AuthContext'
import { usePlayer } from '../state/PlayerContext'
import { usePrefs } from '../state/PrefsContext'
import { IconPlay } from './Icons'
import {
  AlbumTile,
  ArtistTile,
  DashBlock,
  Empty,
  GenrePlayTile,
  MoreTile,
  PREVIEW,
  ReshuffleButton,
  SongTile,
  TileRow,
  type SectionId,
  type SectionProps,
} from './DashboardParts'
import {
  FREQUENT_SAMPLE,
  orderSongs,
  randomAlbumStore,
  randomArtistStore,
  useAlbumSongs,
  useAlbums,
  useGenres,
  useRandom,
  useStarred,
} from './DashboardData'

/*
 * Every block on the start page is one entry in `SECTIONS`. A section owns the
 * whole `<section class="dash-block">` — heading, optional action button and
 * body — so a section that needs a control next to its title (the reshuffle
 * button) keeps that state in one place. Adding a new category means writing one
 * component, adding one registry entry at the bottom, and optionally a `Page`
 * for the "Weitere laden…" tile.
 */

/** Albums per step when a full song page walks an album list. */
const SONG_ALBUM_STEP = 6

/* ==========================================================================
   Sections
   ========================================================================== */

function RecentAlbumsSection(props: SectionProps) {
  const { albums, loading } = useAlbums('recent')

  return (
    <DashBlock label="Letzte Alben" {...props}>
      <AlbumRowBody albums={albums} loading={loading} moreTo="recentAlbums" />
    </DashBlock>
  )
}

function FrequentAlbumsSection(props: SectionProps) {
  const { albums, loading } = useAlbums('frequent')

  return (
    <DashBlock label="Meist gespielte Alben" {...props}>
      <AlbumRowBody albums={albums} loading={loading} moreTo="frequentAlbums" />
    </DashBlock>
  )
}

function AlbumRowBody({ albums, loading, moreTo }: { albums: Album[]; loading: boolean; moreTo: SectionId }) {
  if (loading) return <Empty>Alben werden geladen…</Empty>
  if (!albums.length) return <Empty>Noch nichts hier.</Empty>
  return (
    <TileRow more={albums.length > PREVIEW ? <MoreTile to={moreTo} /> : undefined}>
      {albums.slice(0, PREVIEW).map((album) => (
        <AlbumTile key={album.id} album={album} />
      ))}
    </TileRow>
  )
}

function SongRowBody({
  songs,
  loading,
  moreTo,
}: {
  songs: Song[]
  loading: boolean
  moreTo: SectionId
}) {
  if (loading) return <Empty>Songs werden geladen…</Empty>
  if (!songs.length) return <Empty>Noch nichts hier.</Empty>
  return (
    <TileRow more={songs.length > PREVIEW ? <MoreTile to={moreTo} /> : undefined}>
      {songs.slice(0, PREVIEW).map((song) => (
        <SongTile key={song.id} song={song} tracks={songs} />
      ))}
    </TileRow>
  )
}

function RecentSongsSection(props: SectionProps) {
  const { songs, loading } = useAlbumSongs('recent', 3)

  return (
    <DashBlock label="Letzte Songs" {...props}>
      <SongRowBody songs={songs} loading={loading} moreTo="recentSongs" />
    </DashBlock>
  )
}

function FrequentSongsSection(props: SectionProps) {
  const { songs, loading } = useAlbumSongs('frequent', FREQUENT_SAMPLE, true)

  return (
    <DashBlock label="Meist gespielte Songs" {...props}>
      <SongRowBody songs={songs} loading={loading} moreTo="frequentSongs" />
    </DashBlock>
  )
}

function StarredArtistsSection(props: SectionProps) {
  const { data, loading } = useStarred()
  const artists = data.artist ?? []

  return (
    <DashBlock label="Favoriten Künstler" {...props}>
      {loading ? (
        <Empty>Künstler werden geladen…</Empty>
      ) : !artists.length ? (
        <Empty>Noch keine Favoriten.</Empty>
      ) : (
        <TileRow more={artists.length > PREVIEW ? <MoreTile to="starredArtists" /> : undefined}>
          {artists.slice(0, PREVIEW).map((artist) => (
            <ArtistTile key={artist.id} artist={artist} />
          ))}
        </TileRow>
      )}
    </DashBlock>
  )
}

function StarredAlbumsSection(props: SectionProps) {
  const { data, loading } = useStarred()
  const albums = data.album ?? []

  return (
    <DashBlock label="Favoriten Alben" {...props}>
      {loading ? (
        <Empty>Alben werden geladen…</Empty>
      ) : !albums.length ? (
        <Empty>Noch keine Favoriten.</Empty>
      ) : (
        <TileRow more={albums.length > PREVIEW ? <MoreTile to="starredAlbums" /> : undefined}>
          {albums.slice(0, PREVIEW).map((album) => (
            <AlbumTile key={album.id} album={album} />
          ))}
        </TileRow>
      )}
    </DashBlock>
  )
}

function StarredSongsSection(props: SectionProps) {
  const { data, loading } = useStarred()
  const songs = data.song ?? []

  return (
    <DashBlock label="Favoriten Songs" {...props}>
      <SongRowBody songs={songs} loading={loading} moreTo="starredSongs" />
    </DashBlock>
  )
}

function RandomAlbumsSection(props: SectionProps) {
  const { items, loading, failed, refresh } = useRandom(randomAlbumStore)

  return (
    <DashBlock
      label="Zufällige Alben"
      action={<ReshuffleButton loading={loading} onClick={refresh} />}
      {...props}
    >
      {items.length ? (
        <TileRow>
          {items.map((album) => (
            <AlbumTile key={album.id} album={album} />
          ))}
        </TileRow>
      ) : (
        <Empty>{failed ? 'Konnte nicht geladen werden.' : 'Alben werden geladen…'}</Empty>
      )}
    </DashBlock>
  )
}

function RandomArtistsSection(props: SectionProps) {
  const { items, loading, failed, refresh } = useRandom(randomArtistStore)

  return (
    <DashBlock
      label="Zufällige Künstler"
      action={<ReshuffleButton loading={loading} onClick={refresh} />}
      {...props}
    >
      {items.length ? (
        <TileRow>
          {items.map((artist) => (
            <ArtistTile key={artist.id} artist={artist} />
          ))}
        </TileRow>
      ) : (
        <Empty>{failed ? 'Konnte nicht geladen werden.' : 'Künstler werden geladen…'}</Empty>
      )}
    </DashBlock>
  )
}

function GenrePlaylistsSection(props: SectionProps) {
  const genres = useGenres()

  return (
    <DashBlock label="Zufällige Playlists" {...props}>
      {genres.length ? (
        <TileRow more={genres.length > PREVIEW ? <MoreTile to="genrePlaylists" /> : undefined}>
          {genres.slice(0, PREVIEW).map((genre) => (
            <GenrePlayTile key={genre.value} genre={genre} />
          ))}
        </TileRow>
      ) : (
        <Empty>Keine Genres gefunden.</Empty>
      )}
    </DashBlock>
  )
}

function MoodSection(props: SectionProps) {
  const { client, selectedFolderIds } = useAuth()
  const { playTracks } = usePlayer()
  const { mixSize } = usePrefs()
  const [genres, setGenres] = useState<Genre[]>([])
  const [playlists, setPlaylists] = useState<Awaited<ReturnType<NavidromeClient['getPlaylists']>>>([])
  const [mood, setMood] = useState<MoodId>('chill')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!client) return
    void client.getGenres().then(setGenres)
    void client.getPlaylists().then(setPlaylists)
  }, [client, selectedFolderIds])

  const start = useCallback(async () => {
    if (!client) return
    setBusy(true)
    try {
      const genre = matchMoodGenre(
        mood,
        genres.map((g) => g.value),
      )
      let songs = await client.getRandomSongs(mixSize, genre)
      if (!songs.length && genre) songs = await client.getRandomSongs(mixSize)
      if (!songs.length) {
        const moodName = MOODS.find((m) => m.id === mood)?.label.toLowerCase() ?? ''
        const list = playlists.find((p) => p.name.toLowerCase().includes(moodName))
        if (list) {
          const full = await client.getPlaylist(list.id)
          songs = [...(full.entry ?? [])].sort(() => Math.random() - 0.5)
        }
      }
      if (songs.length) playTracks(songs.slice(0, mixSize), 0)
    } finally {
      setBusy(false)
    }
  }, [client, genres, mixSize, mood, playlists, playTracks])

  return (
    <DashBlock label="Playlist nach Stimmung" {...props}>
      <div className="mood-box">
        <div className="chip-row wrap">
          {MOODS.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`chip ${mood === m.id ? 'is-on' : ''}`}
              onClick={() => setMood(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
        <button type="button" className="primary-btn" disabled={busy} onClick={() => void start()}>
          <IconPlay size={20} /> {busy ? 'Mische…' : 'Zufällige Playlist starten'}
        </button>
      </div>
    </DashBlock>
  )
}

/* ==========================================================================
   Full listings behind "Weitere laden…"
   ========================================================================== */

/** Paged album grid, used by "Letzte Alben" and "Meist gespielte Alben". */
function AlbumFeed({ type }: { type: AlbumListType }) {
  const { client, selectedFolderIds } = useAuth()
  const [albums, setAlbums] = useState<Album[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [more, setMore] = useState(false)
  const sentinel = useRef<HTMLDivElement>(null)
  const busy = useRef(false)

  const load = useCallback(
    async (offset: number, append: boolean) => {
      if (!client || busy.current) return
      busy.current = true
      setLoading(true)
      try {
        const page = await client.getAlbumList(type, offset)
        setAlbums((prev) => (append ? [...prev, ...page] : page))
        setMore(page.length === ALBUM_PAGE)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Alben konnten nicht geladen werden')
      } finally {
        busy.current = false
        setLoading(false)
      }
    },
    [client, type],
  )

  useEffect(() => {
    void load(0, false)
  }, [load, selectedFolderIds])

  useEffect(() => {
    const el = sentinel.current
    if (!el) return
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && more && !loading && !error) {
        void load(albums.length, true)
      }
    })
    io.observe(el)
    return () => io.disconnect()
  }, [albums.length, error, load, loading, more])

  return (
    <>
      {error ? <p className="error">{error}</p> : null}
      <TileRow full>
        {albums.map((album) => (
          <AlbumTile key={album.id} album={album} />
        ))}
      </TileRow>
      <div ref={sentinel} className="sentinel" />
      {loading && !albums.length ? <Empty>Alben werden geladen…</Empty> : null}
      {loading && albums.length ? <p className="muted">Mehr wird geladen…</p> : null}
    </>
  )
}

/**
 * The album list behind a song category is walked in pages, taking a few albums'
 * songs at a time: the endpoint has no notion of "recently played songs", so the
 * songs inherit the album order and arrive as the reader scrolls.
 */
function AlbumSongsFeed({ type, byPlayCount = false }: { type: AlbumListType; byPlayCount?: boolean }) {
  const { client, selectedFolderIds } = useAuth()
  const [songs, setSongs] = useState<Song[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(true)
  const sentinel = useRef<HTMLDivElement>(null)
  const busy = useRef(false)
  const albums = useRef<Album[]>([])
  const albumPage = useRef(0)
  const albumIndex = useRef(0)
  const hasMoreRef = useRef(true)
  const seen = useRef(new Set<string>())

  const step = useCallback(async () => {
    if (!client || busy.current || !hasMoreRef.current) return
    busy.current = true
    setLoading(true)
    try {
      if (albumIndex.current >= albums.current.length) {
        const page = await client.getAlbumList(type, albumPage.current * ALBUM_PAGE)
        albumPage.current += 1
        albums.current = page
        albumIndex.current = 0
        if (page.length < ALBUM_PAGE) {
          hasMoreRef.current = false
          setHasMore(false)
        }
        if (!page.length) return
      }
      const batch = albums.current.slice(albumIndex.current, albumIndex.current + SONG_ALBUM_STEP)
      albumIndex.current += batch.length
      const next = await client.getSongsOfAlbums(batch)
      const fresh = next.filter((song) => !seen.current.has(song.id))
      for (const song of fresh) seen.current.add(song.id)
      setSongs((prev) => orderSongs([...prev, ...fresh], byPlayCount))
    } finally {
      busy.current = false
      setLoading(false)
    }
  }, [byPlayCount, client, type])

  useEffect(() => {
    albums.current = []
    albumPage.current = 0
    albumIndex.current = 0
    hasMoreRef.current = true
    seen.current = new Set()
    setSongs([])
    setHasMore(true)
    void step()
  }, [step, selectedFolderIds])

  useEffect(() => {
    const el = sentinel.current
    if (!el) return
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) void step()
    })
    io.observe(el)
    return () => io.disconnect()
  }, [step])

  return (
    <>
      <TileRow full>
        {songs.map((song) => (
          <SongTile key={song.id} song={song} tracks={songs} />
        ))}
      </TileRow>
      <div ref={sentinel} className="sentinel" />
      {loading && !songs.length ? <Empty>Songs werden geladen…</Empty> : null}
      {loading && songs.length ? <p className="muted">Mehr wird geladen…</p> : null}
      {!hasMore && songs.length ? <p className="muted">Das war alles.</p> : null}
    </>
  )
}

function StarredArtistsPage() {
  const { data, loading } = useStarred()
  const artists = data.artist ?? []
  if (loading) return <Empty>Künstler werden geladen…</Empty>
  if (!artists.length) return <Empty>Noch keine Favoriten.</Empty>
  return (
    <TileRow full>
      {artists.map((artist) => (
        <ArtistTile key={artist.id} artist={artist} />
      ))}
    </TileRow>
  )
}

function StarredAlbumsPage() {
  const { data, loading } = useStarred()
  const albums = data.album ?? []
  if (loading) return <Empty>Alben werden geladen…</Empty>
  if (!albums.length) return <Empty>Noch keine Favoriten.</Empty>
  return (
    <TileRow full>
      {albums.map((album) => (
        <AlbumTile key={album.id} album={album} />
      ))}
    </TileRow>
  )
}

function StarredSongsPage() {
  const { data, loading } = useStarred()
  const songs = data.song ?? []
  if (loading) return <Empty>Songs werden geladen…</Empty>
  if (!songs.length) return <Empty>Noch keine Favoriten.</Empty>
  return (
    <TileRow full>
      {songs.map((song) => (
        <SongTile key={song.id} song={song} tracks={songs} />
      ))}
    </TileRow>
  )
}

function GenrePlaylistsPage() {
  const genres = useGenres()
  if (!genres.length) return <Empty>Keine Genres gefunden.</Empty>
  return (
    <TileRow full>
      {genres.map((genre) => (
        <GenrePlayTile key={genre.value} genre={genre} />
      ))}
    </TileRow>
  )
}

/* ==========================================================================
   Registry
   ========================================================================== */

export type { SectionId }

export type SectionDef = {
  id: SectionId
  label: string
  /** Heading of the page behind the "Weitere laden…" tile. */
  pageTitle: string
  Section: (props: SectionProps) => ReactNode
  Page?: () => ReactNode
}

export const SECTIONS: SectionDef[] = [
  { id: 'recentAlbums', label: 'Letzte Alben', pageTitle: 'Letzte Alben', Section: RecentAlbumsSection, Page: () => <AlbumFeed type="recent" /> },
  { id: 'recentSongs', label: 'Letzte Songs', pageTitle: 'Letzte Songs', Section: RecentSongsSection, Page: () => <AlbumSongsFeed type="recent" /> },
  { id: 'randomAlbums', label: 'Zufällige Alben', pageTitle: 'Zufällige Alben', Section: RandomAlbumsSection },
  { id: 'genrePlaylists', label: 'Zufällige Playlists', pageTitle: 'Alle Genres', Section: GenrePlaylistsSection, Page: GenrePlaylistsPage },
  { id: 'randomArtists', label: 'Zufällige Künstler', pageTitle: 'Zufällige Künstler', Section: RandomArtistsSection },
  { id: 'frequentAlbums', label: 'Meist gespielte Alben', pageTitle: 'Meist gespielte Alben', Section: FrequentAlbumsSection, Page: () => <AlbumFeed type="frequent" /> },
  { id: 'frequentSongs', label: 'Meist gespielte Songs', pageTitle: 'Meist gespielte Songs', Section: FrequentSongsSection, Page: () => <AlbumSongsFeed type="frequent" byPlayCount /> },
  { id: 'starredArtists', label: 'Favoriten Künstler', pageTitle: 'Favoriten Künstler', Section: StarredArtistsSection, Page: StarredArtistsPage },
  { id: 'starredAlbums', label: 'Favoriten Alben', pageTitle: 'Favoriten Alben', Section: StarredAlbumsSection, Page: StarredAlbumsPage },
  { id: 'starredSongs', label: 'Favoriten Songs', pageTitle: 'Favoriten Songs', Section: StarredSongsSection, Page: StarredSongsPage },
  // Kept for anyone who already used it, but no longer part of the default
  // start page.
  { id: 'mood', label: 'Playlist nach Stimmung', pageTitle: 'Playlist nach Stimmung', Section: MoodSection },
]

/** Start page order out of the box; `mood` stays available under "Anpassen". */
export const DEFAULT_SECTIONS: SectionId[] = [
  'recentAlbums',
  'recentSongs',
  'randomAlbums',
  'genrePlaylists',
  'randomArtists',
  'frequentAlbums',
  'frequentSongs',
  'starredArtists',
  'starredAlbums',
  'starredSongs',
]

export function sectionById(id: string): SectionDef | undefined {
  return SECTIONS.find((section) => section.id === id)
}

export function SectionPage({ id }: { id: string }) {
  const def = sectionById(id)

  if (!def?.Page) {
    return (
      <div className="view">
        <header className="view-head">
          <h2>Unbekannte Kategorie</h2>
        </header>
        <Empty>Diese Kategorie gibt es nicht (mehr).</Empty>
      </div>
    )
  }

  const Page = def.Page
  return (
    <div className="view">
      <header className="view-head">
        <h2>{def.pageTitle}</h2>
      </header>
      <Page />
    </div>
  )
}
