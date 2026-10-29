import { useCallback, useEffect, useRef, useState } from 'react'
import { ALBUM_PAGE } from '../api/client'
import type { Album, AlbumListType } from '../api/types'
import { useAuth } from '../state/AuthContext'
import { useNav } from '../state/NavContext'
import { usePlayer } from '../state/PlayerContext'
import { CoverArt } from './CoverArt'
import { IconPlay } from './Icons'
import { LayoutToggle } from './LayoutToggle'
import { SortMenu } from './SortMenu'
import { usePrefs } from '../state/PrefsContext'

const FILTERS: { id: AlbumListType; label: string }[] = [
  { id: 'newest', label: 'Neueste' },
  { id: 'recent', label: 'Zuletzt' },
  { id: 'frequent', label: 'Häufig' },
  { id: 'random', label: 'Zufällig' },
  { id: 'starred', label: 'Favoriten' },
  { id: 'alphabeticalByName', label: 'A–Z' },
]

export function AlbumGrid() {
  const { client, selectedFolderIds } = useAuth()
  const { go } = useNav()
  const { playTracks } = usePlayer()
  const { layout } = usePrefs()
  const [type, setType] = useState<AlbumListType>('newest')
  const [albums, setAlbums] = useState<Album[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [more, setMore] = useState(false)
  const sentinel = useRef<HTMLDivElement>(null)
  const loadingRef = useRef(false)
  /*
   * The filter and the library the grid on screen was asked for. A different one
   * starts from an empty grid and a spinner, adjusted while rendering so the old
   * albums never paint under the new chip; the effect below only fetches.
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
    (listType: AlbumListType, offset: number, append: boolean) => {
      if (!client || loadingRef.current) return
      loadingRef.current = true
      void client
        .getAlbumList(listType, offset)
        .then((page) => {
          setAlbums((prev) => (append ? [...prev, ...page] : page))
          setMore(page.length === ALBUM_PAGE)
          setError('')
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : 'Alben konnten nicht geladen werden')
        })
        .finally(() => {
          setLoading(false)
          loadingRef.current = false
        })
    },
    [client],
  )

  useEffect(() => {
    load(type, 0, false)
  }, [load, selectedFolderIds, type])

  useEffect(() => {
    const el = sentinel.current
    if (!el) return
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && more && !loading && !error) {
        setLoading(true)
        load(type, albums.length, true)
      }
    })
    io.observe(el)
    return () => io.disconnect()
  }, [albums.length, error, load, loading, more, type])

  async function playAlbum(album: Album) {
    if (!client) return
    const full = await client.getAlbum(album.id)
    playTracks(full.song ?? [], 0)
  }

  return (
    <div className="view">
      <header className="view-head">
        <h2>Alben</h2>
        <div className="view-head-tools">
          <SortMenu options={FILTERS} value={type} onChange={setType} />
          <LayoutToggle section="albums" />
        </div>
      </header>
      {error ? <p className="error">{error}</p> : null}
      <div className={`album-grid ${layout.albums === 'list' ? 'is-list' : ''}`}>
        {albums.map((album) => (
          <article key={album.id} className="album-card">
            <button type="button" className="album-hit" onClick={() => go({ name: 'album', id: album.id })}>
              <CoverArt coverArt={album.coverArt} alt="" size={400} />
              <span className="album-name">{album.name}</span>
              <span className="album-artist">{album.artist}</span>
            </button>
            <button
              type="button"
              className="play-fab"
              aria-label={`${album.name} abspielen`}
              onClick={() => void playAlbum(album)}
            >
              <IconPlay size={26} />
            </button>
          </article>
        ))}
      </div>
      <div ref={sentinel} className="sentinel" />
      {more && loading ? <p className="muted">Mehr wird geladen…</p> : null}
      {loading && albums.length === 0 ? <p className="muted">Alben werden geladen…</p> : null}
    </div>
  )
}
