import { useCallback, useEffect, useRef, useState } from 'react'
import { ALBUM_PAGE } from '../api/client'
import type { Album, AlbumListType, Song } from '../api/types'
import { useAuth } from '../state/AuthContext'
import {
  AlbumTile,
  ArtistTile,
  DashBlock,
  Empty,
  GenrePlayTile,
  MoreTile,
  ReshuffleButton,
  SongTile,
  TileRow,
  type SectionId,
  type SectionProps,
} from './DashboardParts'
import {
  randomAlbumStore,
  randomArtistStore,
  useAlbumSongs,
  useAlbums,
  useGenres,
  useRandom,
  useStarred,
} from './DashboardData'

/*
 * The blocks the start page is built from: each one owns a whole
 * `<section class="dash-block">` — heading, optional action button and body — so
 * a block that needs a control next to its title (the reshuffle button) keeps
 * that state in one place.
 *
 * Which blocks a start page shows, in which order and under which name is not
 * decided here: that is the registry in `DashboardRegistry.tsx`, which keeps this
 * module to components only.
 */

/** Albums per step when a full song page walks an album list. */
const SONG_ALBUM_STEP = 6

/* ==========================================================================
   Sections
   ========================================================================== */

export function RecentAlbumsSection(props: SectionProps) {
  const { albums, loading } = useAlbums('recent')

  return (
    <DashBlock label="Zuletzt gehört" {...props}>
      <AlbumRowBody albums={albums} loading={loading} moreTo="recentAlbums" />
    </DashBlock>
  )
}

export function NewAlbumsSection(props: SectionProps) {
  const { albums, loading } = useAlbums('newest')

  return (
    <DashBlock label="Zuletzt hinzugefügt" {...props}>
      <AlbumRowBody albums={albums} loading={loading} moreTo="newAlbums" />
    </DashBlock>
  )
}

export function FrequentAlbumsSection(props: SectionProps) {
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
  // The row decides how many tiles fit; the "more" tile shows up by itself when
  // the category is longer than that.
  return (
    <TileRow more={<MoreTile to={moreTo} />}>
      {albums.map((album) => (
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
    <TileRow compact rows={3} more={<MoreTile to={moreTo} />}>
      {songs.map((song) => (
        <SongTile key={song.id} song={song} tracks={songs} compact />
      ))}
    </TileRow>
  )
}

export function RecentSongsSection(props: SectionProps) {
  const { songs, loading } = useAlbumSongs('recent', 3)

  return (
    <DashBlock label="Letzte Songs" {...props}>
      <SongRowBody songs={songs} loading={loading} moreTo="recentSongs" />
    </DashBlock>
  )
}

export function StarredArtistsSection(props: SectionProps) {
  const { data, loading } = useStarred()
  const artists = data.artist ?? []

  return (
    <DashBlock label="Favoriten Künstler" {...props}>
      {loading ? (
        <Empty>Künstler werden geladen…</Empty>
      ) : !artists.length ? (
        <Empty>Noch keine Favoriten.</Empty>
      ) : (
        <TileRow more={<MoreTile to="starredArtists" />}>
          {artists.map((artist) => (
            <ArtistTile key={artist.id} artist={artist} />
          ))}
        </TileRow>
      )}
    </DashBlock>
  )
}

export function StarredAlbumsSection(props: SectionProps) {
  const { data, loading } = useStarred()
  const albums = data.album ?? []

  return (
    <DashBlock label="Favoriten Alben" {...props}>
      {loading ? (
        <Empty>Alben werden geladen…</Empty>
      ) : !albums.length ? (
        <Empty>Noch keine Favoriten.</Empty>
      ) : (
        <TileRow more={<MoreTile to="starredAlbums" />}>
          {albums.map((album) => (
            <AlbumTile key={album.id} album={album} />
          ))}
        </TileRow>
      )}
    </DashBlock>
  )
}

export function StarredSongsSection(props: SectionProps) {
  const { data, loading } = useStarred()
  const songs = data.song ?? []

  return (
    <DashBlock label="Favoriten Songs" {...props}>
      <SongRowBody songs={songs} loading={loading} moreTo="starredSongs" />
    </DashBlock>
  )
}

export function RandomAlbumsSection(props: SectionProps) {
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

export function RandomArtistsSection(props: SectionProps) {
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

export function GenrePlaylistsSection(props: SectionProps) {
  const genres = useGenres()

  return (
    <DashBlock label="Genre Radio" {...props}>
      {genres.length ? (
        <TileRow compact all>
          {genres.map((genre) => (
            <GenrePlayTile key={genre.value} genre={genre} compact />
          ))}
        </TileRow>
      ) : (
        <Empty>Keine Genres gefunden.</Empty>
      )}
    </DashBlock>
  )
}

/* ==========================================================================
   Full listings behind "Weitere laden…"
   ========================================================================== */

/** Paged album grid, used by "Zuletzt gehört" and "Meist gespielte Alben". */
export function AlbumFeed({ type }: { type: AlbumListType }) {
  const { client, selectedFolderIds } = useAuth()
  const [albums, setAlbums] = useState<Album[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [more, setMore] = useState(false)
  const sentinel = useRef<HTMLDivElement>(null)
  const busy = useRef(false)
  /*
   * The list and the library the grid on screen answers. A different one starts
   * from an empty grid and a spinner, adjusted while rendering so the previous
   * albums never paint as if they belonged to the new request.
   */
  const requested = `${type}|${selectedFolderIds.join(',')}`
  const [shown, setShown] = useState(requested)

  if (shown !== requested) {
    setShown(requested)
    setAlbums([])
    setError('')
    setLoading(true)
  }

  const load = useCallback(
    (offset: number, append: boolean) => {
      if (!client || busy.current) return
      busy.current = true
      void client
        .getAlbumList(type, offset)
        .then((page) => {
          setAlbums((prev) => (append ? [...prev, ...page] : page))
          setMore(page.length === ALBUM_PAGE)
          setError('')
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : 'Alben konnten nicht geladen werden')
        })
        .finally(() => {
          busy.current = false
          setLoading(false)
        })
    },
    [client, type],
  )

  useEffect(() => {
    load(0, false)
  }, [load, selectedFolderIds])

  useEffect(() => {
    const el = sentinel.current
    if (!el) return
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && more && !loading && !error) {
        setLoading(true)
        load(albums.length, true)
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
export function AlbumSongsFeed({ type }: { type: AlbumListType }) {
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
  /*
   * The list and the library the songs on screen answer. A different one starts
   * empty and loading, adjusted while rendering rather than in the effect that
   * restarts the walk through the albums.
   */
  const requested = `${type}|${selectedFolderIds.join(',')}`
  const [shown, setShown] = useState(requested)

  if (shown !== requested) {
    setShown(requested)
    setSongs([])
    setHasMore(true)
    setLoading(true)
  }

  const step = useCallback(async () => {
    if (!client || busy.current || !hasMoreRef.current) return
    busy.current = true
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
      setSongs((prev) => [...prev, ...fresh])
    } finally {
      busy.current = false
      setLoading(false)
    }
  }, [client, type])

  useEffect(() => {
    /*
     * A new list, or a library switch, starts the walk from the beginning: the
     * album page, the index into it and the songs already collected all belong
     * to the request that just ended.
     */
    albums.current = []
    albumPage.current = 0
    albumIndex.current = 0
    hasMoreRef.current = true
    seen.current = new Set()
    void step()
  }, [selectedFolderIds, step])

  useEffect(() => {
    const el = sentinel.current
    if (!el) return
    const io = new IntersectionObserver((entries) => {
      /* Only announce loading when the step below will really run. */
      if (!entries.some((e) => e.isIntersecting) || busy.current || !hasMoreRef.current) return
      setLoading(true)
      void step()
    })
    io.observe(el)
    return () => io.disconnect()
  }, [step])

  return (
    <>
      <TileRow full compact>
        {songs.map((song) => (
          <SongTile key={song.id} song={song} tracks={songs} compact />
        ))}
      </TileRow>
      <div ref={sentinel} className="sentinel" />
      {loading && !songs.length ? <Empty>Songs werden geladen…</Empty> : null}
      {loading && songs.length ? <p className="muted">Mehr wird geladen…</p> : null}
      {!hasMore && songs.length ? <p className="muted">Das war alles.</p> : null}
    </>
  )
}

export function StarredArtistsPage() {
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

export function StarredAlbumsPage() {
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

export function StarredSongsPage() {
  const { data, loading } = useStarred()
  const songs = data.song ?? []
  if (loading) return <Empty>Songs werden geladen…</Empty>
  if (!songs.length) return <Empty>Noch keine Favoriten.</Empty>
  return (
    <TileRow full compact>
      {songs.map((song) => (
        <SongTile key={song.id} song={song} tracks={songs} compact />
      ))}
    </TileRow>
  )
}
