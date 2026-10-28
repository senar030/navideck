import {
  Children,
  cloneElement,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
  type RefObject,
} from 'react'
import type { Album, Artist, Genre, Song } from '../api/types'
import { useAuth } from '../state/AuthContext'
import { useNav } from '../state/NavContext'
import { usePlayer } from '../state/PlayerContext'
import { usePrefs } from '../state/PrefsContext'
import { CoverArt } from './CoverArt'
import { IconAlbums, IconArrowDown, IconArrowRight, IconArrowUp, IconBook, IconPlay, IconPodcast, IconRefresh, IconTrash } from './Icons'

/*
 * The pieces every start-page category is built from: the block chrome, the row
 * that caps itself at two lines of tiles, and the tiles themselves.
 */

/** Tiles shown per category on phones, where a row scrolls sideways. */
const PREVIEW = 15

/** Which area a block belongs to; its icon marks the heading. */
export type SectionCategory = 'music' | 'books' | 'podcasts' | 'mixed'

/** Categories behind a start-page "Weitere laden…" tile. */
export type SectionId =
  | 'recentAlbums'
  | 'newAlbums'
  | 'recentSongs'
  | 'randomAlbums'
  | 'randomArtists'
  | 'genrePlaylists'
  | 'frequentAlbums'
  | 'starredArtists'
  | 'starredAlbums'
  | 'starredSongs'
  | 'instantMix'
  | 'continueAll'
  | 'continueBooks'
  | 'continuePodcasts'
  | 'randomBooks'
  | 'randomAuthors'
  | 'collections'
  | 'latestEpisodes'
  | 'podcastShows'

export type SectionProps = {
  category: SectionCategory
  editing: boolean
  canUp: boolean
  canDown: boolean
  onMove: (dir: -1 | 1) => void
  onRemove: () => void
}

function CategoryMark({ category }: { category: SectionCategory }) {
  return (
    <span className="dash-cat" aria-hidden>
      {category === 'music' ? <IconAlbums size={15} /> : null}
      {category === 'books' ? <IconBook size={15} /> : null}
      {category === 'podcasts' ? <IconPodcast size={15} /> : null}
      {category === 'mixed' ? (
        <>
          <IconBook size={15} />
          <IconPodcast size={15} />
        </>
      ) : null}
    </span>
  )
}

/* ==========================================================================
   Shared chrome
   ========================================================================== */

export function DashBlock({
  label,
  action,
  children,
  category,
  editing,
  canUp,
  canDown,
  onMove,
  onRemove,
}: SectionProps & { label: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className={`dash-block ${editing ? 'is-editing' : ''}`}>
      <header className="dash-head">
        <h3>
          {label}
          <CategoryMark category={category} />
        </h3>
        <div className="dash-head-tools">
          {action && !editing ? action : null}
          {editing ? (
            <div className="dash-edit" role="group" aria-label="Widget anordnen">
              <button
                type="button"
                className="icon-btn dash-tool"
                aria-label="Nach oben"
                data-tip="Nach oben"
                disabled={!canUp}
                onClick={() => onMove(-1)}
              >
                <IconArrowUp size={18} />
              </button>
              <button
                type="button"
                className="icon-btn dash-tool"
                aria-label="Nach unten"
                data-tip="Nach unten"
                disabled={!canDown}
                onClick={() => onMove(1)}
              >
                <IconArrowDown size={18} />
              </button>
              <button
                type="button"
                className="icon-btn dash-tool is-danger"
                aria-label="Widget entfernen"
                data-tip="Entfernen"
                onClick={onRemove}
              >
                <IconTrash size={18} />
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
      /*
       * A row that scrolls sideways is a grid whose columns the tile width
       * decides, and the browser reports the columns it ended up using — for a
       * three-row strip that is however many the tiles needed, not how many are
       * on screen. Counting them would let the row grow past the preview length
       * and swallow the "Weitere laden…" tile, so the direction of the flow
       * decides instead: sideways rows are measured by their preview length.
       */
      if (style.gridAutoFlow.includes('column')) {
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
 * The body of a category. On the start page it is at most `rows` rows of tiles
 * on wide screens, and on phones it is a strip that scrolls sideways — one tile
 * per row for the broad tiles, three rows for the song lists, which ask for a
 * `className` of their own to get that shape.
 *
 * How many tiles fit is measured, not guessed: `columns * rows` tiles fit, and
 * the "Weitere laden…" tile takes the last of those slots as soon as the
 * category holds more than that. On phones, where the row scrolls sideways, the
 * preview length is the limit instead. Nothing is ever dropped silently —
 * either the whole category fits, or the "more" tile follows it.
 *
 * `compact` switches to the list-row shape used by the song and genre
 * categories, where a thumbnail carries no information of its own. `all` keeps
 * every tile, for categories that are short enough to show as they are.
 */
export function TileRow({
  more,
  full = false,
  compact = false,
  rows = 2,
  all = false,
  className,
  children,
}: {
  more?: ReactElement<{ compact?: boolean }>
  full?: boolean
  compact?: boolean
  /** Rows of tiles before the "Weitere laden…" tile steps in. */
  rows?: number
  /** Show every tile, however many rows that takes. */
  all?: boolean
  /** Extra class on the row, for shapes only some categories use. */
  className?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const columns = useGridColumns(ref)
  const items = Children.toArray(children)
  const limit = columns > 0 ? columns * rows : PREVIEW
  const overflow = !full && !all && items.length > limit
  const tail = more && compact ? cloneElement(more, { compact: true }) : more
  const visible = overflow && !tail ? items.slice(0, limit) : overflow ? items.slice(0, limit - 1) : items
  const row = `${full ? TILE_CLASS.grid : TILE_CLASS.row}${compact ? ' is-compact' : ''}`

  return (
    <div className={className ? `${row} ${className}` : row} ref={ref}>
      {visible}
      {overflow && tail ? tail : null}
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

export function SongTile({ song, tracks, compact }: { song: Song; tracks: Song[]; compact?: boolean }) {
  const { playTracks } = usePlayer()
  const index = Math.max(0, tracks.findIndex((t) => t.id === song.id))

  if (compact) {
    return (
      <article className="album-card list-card">
        <button
          type="button"
          className="album-hit"
          aria-label={`${song.title} abspielen`}
          onClick={() => playTracks(tracks, index)}
        >
          <CoverArt coverArt={song.coverArt} alt="" size={96} className="list-art" />
          <span className="list-text">
            <span className="album-name">{song.title}</span>
            <span className="album-artist">{song.artist ?? song.album}</span>
          </span>
        </button>
      </article>
    )
  }

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
 * every time it is pressed — the "Genre Radio" category, and as close as
 * Subsonic gets to "surprise me within this genre".
 */
export function GenrePlayTile({ genre, compact }: { genre: Genre; compact?: boolean }) {
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

  const label = `Genre Radio: ${genre.value}`
  const count = busy ? 'Wird gemischt…' : `${genre.songCount ?? 0} Titel`

  if (compact) {
    return (
      <article className="album-card list-card">
        <button type="button" className="album-hit" disabled={busy} aria-label={label} onClick={() => void start()}>
          <span className="list-art genre-play-face">
            <IconPlay size={20} />
          </span>
          <span className="list-text">
            <span className="album-name">{genre.value}</span>
            <span className="album-artist">{count}</span>
          </span>
        </button>
      </article>
    )
  }

  return (
    <article className="album-card genre-play-card">
      <button type="button" className="album-hit" disabled={busy} aria-label={label} onClick={() => void start()}>
        <span className="genre-play-face">
          <IconPlay size={34} />
        </span>
        <span className="album-name">{genre.value}</span>
        <span className="album-artist">{count}</span>
      </button>
    </article>
  )
}

export function MoreTile({ to, compact }: { to: SectionId; compact?: boolean }) {
  const { go } = useNav()

  if (compact) {
    return (
      <article className="album-card list-card more-card">
        <button type="button" className="album-hit" onClick={() => go({ name: 'section', id: to })}>
          <span className="list-art more-face">
            <IconArrowRight size={18} />
          </span>
          <span className="list-text">
            <span className="album-name">Weitere laden…</span>
          </span>
        </button>
      </article>
    )
  }

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
