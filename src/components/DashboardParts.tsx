import { Children, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import type { Album, Artist, Genre, Song } from '../api/types'
import { useAuth } from '../state/AuthContext'
import { useNav } from '../state/NavContext'
import { usePlayer } from '../state/PlayerContext'
import { usePrefs } from '../state/PrefsContext'
import { CoverArt } from './CoverArt'
import { IconArrowRight, IconPlay, IconRefresh } from './Icons'

/*
 * The pieces every start-page category is built from: the block chrome, the row
 * that caps itself at two lines of tiles, and the tiles themselves.
 */

/** Tiles shown per category before the "Weitere laden…" tile. */
export const PREVIEW = 15

/** Categories behind a start-page "Weitere laden…" tile. */
export type SectionId =
  | 'recentAlbums'
  | 'recentSongs'
  | 'randomAlbums'
  | 'genrePlaylists'
  | 'randomArtists'
  | 'frequentAlbums'
  | 'frequentSongs'
  | 'starredArtists'
  | 'starredAlbums'
  | 'starredSongs'
  | 'mood'

export type SectionProps = {
  editing: boolean
  canUp: boolean
  canDown: boolean
  onMove: (dir: -1 | 1) => void
  onRemove: () => void
}

/* ==========================================================================
   Shared chrome
   ========================================================================== */

export function DashBlock({
  label,
  action,
  children,
  editing,
  canUp,
  canDown,
  onMove,
  onRemove,
}: SectionProps & { label: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="dash-block">
      <header className="dash-head">
        <h3>{label}</h3>
        <div className="dash-head-tools">
          {action}
          {editing ? (
            <div className="dash-edit">
              <button type="button" className="text-btn" disabled={!canUp} onClick={() => onMove(-1)}>
                Hoch
              </button>
              <button type="button" className="text-btn" disabled={!canDown} onClick={() => onMove(1)}>
                Runter
              </button>
              <button type="button" className="text-btn" onClick={onRemove}>
                Entfernen
              </button>
            </div>
          ) : null}
        </div>
      </header>
      {children}
    </section>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="muted dash-empty">{children}</p>
}

export function ReshuffleButton({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`icon-btn ${loading ? 'is-busy' : ''}`}
      aria-label="Neue Zufallsauswahl"
      data-tip="Neu mischen"
      disabled={loading}
      onClick={onClick}
    >
      <IconRefresh size={20} />
    </button>
  )
}

/**
 * How many tiles fit in one row of a `.tile-row`. The grid is `auto-fill`, so
 * the resolved track list is exactly what the browser laid out. Returns 0 when
 * the row is not a grid — on phones it is a horizontal scroller and nothing may
 * be dropped.
 */
function useGridColumns(ref: RefObject<HTMLDivElement | null>) {
  const [columns, setColumns] = useState(0)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const style = getComputedStyle(el)
      if (style.display !== 'grid') {
        setColumns(0)
        return
      }
      setColumns(style.gridTemplateColumns.split(' ').filter(Boolean).length)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])

  return columns
}

const TILE_CLASS: Record<'row' | 'grid', string> = { row: 'tile-row', grid: 'album-grid' }

/**
 * The body of a category. On the start page it is at most two rows of tiles on
 * wide screens and one horizontally scrollable row on phones; the "Weitere
 * laden…" tile always keeps a slot, taking the place of the last tile when the
 * two rows are full.
 */
export function TileRow({ more, full = false, children }: { more?: ReactNode; full?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const columns = useGridColumns(ref)
  const items = Children.toArray(children)
  const capacity = columns * 2
  const total = items.length + (more ? 1 : 0)
  const visible =
    !full && capacity > 0 && total > capacity ? items.slice(0, Math.max(1, capacity - 1)) : items

  return (
    <div className={full ? TILE_CLASS.grid : TILE_CLASS.row} ref={ref}>
      {visible}
      {!full ? more : null}
    </div>
  )
}

/* ==========================================================================
   Tiles
   ========================================================================== */

export function AlbumTile({ album }: { album: Album }) {
  const { go } = useNav()
  const { client } = useAuth()
  const { playTracks } = usePlayer()

  return (
    <article className="album-card">
      <button type="button" className="album-hit" onClick={() => go({ name: 'album', id: album.id })}>
        <CoverArt coverArt={album.coverArt} alt="" size={240} />
        <span className="album-name">{album.name}</span>
        <span className="album-artist">{album.artist}</span>
      </button>
      <button
        type="button"
        className="play-fab"
        aria-label={`${album.name} abspielen`}
        onClick={() => {
          if (!client) return
          void client.getAlbum(album.id).then((full) => playTracks(full.song ?? [], 0))
        }}
      >
        <IconPlay size={20} />
      </button>
    </article>
  )
}

export function SongTile({ song, tracks }: { song: Song; tracks: Song[] }) {
  const { playTracks } = usePlayer()
  const index = Math.max(0, tracks.findIndex((t) => t.id === song.id))

  return (
    <article className="album-card song-card">
      <button type="button" className="album-hit" onClick={() => playTracks(tracks, index)}>
        <CoverArt coverArt={song.coverArt} alt="" size={240} />
        <span className="album-name">{song.title}</span>
        <span className="album-artist">{song.artist ?? song.album}</span>
      </button>
      <button
        type="button"
        className="play-fab"
        aria-label={`${song.title} abspielen`}
        onClick={() => playTracks(tracks, index)}
      >
        <IconPlay size={20} />
      </button>
    </article>
  )
}

export function ArtistTile({ artist }: { artist: Artist }) {
  const { go } = useNav()
  const count = artist.albumCount

  return (
    <article className="album-card artist-card">
      <button type="button" className="album-hit" onClick={() => go({ name: 'artist', id: artist.id })}>
        <CoverArt coverArt={artist.coverArt} alt="" size={240} className="avatar" />
        <span className="album-name">{artist.name}</span>
        <span className="album-artist">
          {count === undefined ? '' : `${count} ${count === 1 ? 'Album' : 'Alben'}`}
        </span>
      </button>
    </article>
  )
}

/**
 * One button per genre: it builds a fresh random playlist out of that genre
 * every time it is pressed, which is as close as Subsonic gets to "surprise me
 * within this genre".
 */
export function GenrePlayTile({ genre }: { genre: Genre }) {
  const { client } = useAuth()
  const { playTracks } = usePlayer()
  const { mixSize } = usePrefs()
  const [busy, setBusy] = useState(false)

  async function start() {
    if (!client || busy) return
    setBusy(true)
    try {
      const songs = await client.getRandomSongs(mixSize, genre.value)
      if (songs.length) playTracks(songs, 0)
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="album-card genre-play-card">
      <button
        type="button"
        className="album-hit"
        disabled={busy}
        aria-label={`Zufällige Playlist aus ${genre.value} starten`}
        onClick={() => void start()}
      >
        <span className="genre-play-face">
          <IconPlay size={34} />
        </span>
        <span className="album-name">{genre.value}</span>
        <span className="album-artist">{busy ? 'Wird gemischt…' : `${genre.songCount ?? 0} Titel`}</span>
      </button>
    </article>
  )
}

export function MoreTile({ to }: { to: SectionId }) {
  const { go } = useNav()

  return (
    <article className="album-card more-card">
      <button type="button" className="album-hit" onClick={() => go({ name: 'section', id: to })}>
        <span className="more-face">
          <IconArrowRight size={26} />
        </span>
        <span className="album-name">Weitere laden…</span>
      </button>
    </article>
  )
}
