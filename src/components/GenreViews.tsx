import { useCallback, useEffect, useRef, useState } from 'react'
import { ALBUM_PAGE } from '../api/client'
import type { Album, Genre, Song } from '../api/types'
import { useAuth } from '../state/AuthContext'
import { useNav } from '../state/NavContext'
import { usePlayer } from '../state/PlayerContext'
import { usePrefs } from '../state/PrefsContext'
import { CoverArt } from './CoverArt'
import { IconPlay, IconRadio } from './Icons'
import { TrackList } from './TrackList'

export function GenreList() {
  const { client } = useAuth()
  const { go } = useNav()
  const { playTracks } = usePlayer()
  const { mixSize } = usePrefs()
  const [genres, setGenres] = useState<Genre[]>([])
  const [error, setError] = useState('')
  const [mixing, setMixing] = useState('')

  useEffect(() => {
    if (!client) return
    void client
      .getGenres()
      .then((list) =>
        setGenres(
          [...list].sort(
            (a, b) => (b.albumCount ?? 0) - (a.albumCount ?? 0) || a.value.localeCompare(b.value),
          ),
        ),
      )
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load genres'))
  }, [client])

  async function mixGenre(name: string) {
    if (!client || mixing) return
    setMixing(name)
    try {
      let songs = await client.getRandomSongs(mixSize, name)
      if (songs.length < Math.min(8, mixSize)) {
        const extra = await client.getSongsByGenre(name, 0)
        songs = [...songs, ...extra]
      }
      const unique = [...new Map(songs.map((s) => [s.id, s])).values()]
      for (let i = unique.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        const tmp = unique[i]
        unique[i] = unique[j]
        unique[j] = tmp
      }
      if (unique.length) playTracks(unique.slice(0, mixSize), 0)
    } finally {
      setMixing('')
    }
  }

  return (
    <div className="view">
      <header className="view-head">
        <h2>Genres</h2>
      </header>
      {error ? <p className="error">{error}</p> : null}
      <div className="genre-grid">
        {genres.map((genre) => (
          <article key={genre.value} className="genre-card">
            <button type="button" className="genre-hit" onClick={() => go({ name: 'genre', id: genre.value })}>
              <strong>{genre.value}</strong>
              <em>
                {genre.albumCount ?? 0} albums · {genre.songCount ?? 0} tracks
              </em>
            </button>
            <button
              type="button"
              className="play-fab"
              disabled={Boolean(mixing)}
              aria-label={`Sofort-Mix: ${genre.value}`}
              data-tip="Sofort-Mix"
              onClick={() => void mixGenre(genre.value)}
            >
              <IconRadio size={18} />
            </button>
          </article>
        ))}
      </div>
      {!genres.length && !error ? <p className="muted">Loading genres…</p> : null}
    </div>
  )
}

export function GenreDetail({ name }: { name: string }) {
  const { client } = useAuth()
  const { go } = useNav()
  const { playTracks } = usePlayer()
  const [albums, setAlbums] = useState<Album[]>([])
  const [songs, setSongs] = useState<Song[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [moreAlbums, setMoreAlbums] = useState(false)
  const [moreSongs, setMoreSongs] = useState(false)
  const loadingRef = useRef(false)

  const load = useCallback(
    async (offset: number, append: boolean) => {
      if (!client || loadingRef.current) return
      loadingRef.current = true
      setLoading(true)
      setError('')
      try {
        const [albumPage, songPage] = await Promise.all([
          client.getAlbumsByGenre(name, offset),
          client.getSongsByGenre(name, offset),
        ])
        setAlbums((prev) => (append ? [...prev, ...albumPage] : albumPage))
        setSongs((prev) => (append ? [...prev, ...songPage] : songPage))
        setMoreAlbums(albumPage.length === ALBUM_PAGE)
        setMoreSongs(songPage.length === ALBUM_PAGE)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load genre')
      } finally {
        setLoading(false)
        loadingRef.current = false
      }
    },
    [client, name],
  )

  useEffect(() => {
    void load(0, false)
  }, [load])

  async function playAlbum(album: Album) {
    if (!client) return
    const full = await client.getAlbum(album.id)
    playTracks(full.song ?? [], 0)
  }

  return (
    <div className="view">
      <header className="view-head">
        <h2>{name}</h2>
      </header>
      {error ? <p className="error">{error}</p> : null}
      {albums.length ? (
        <section className="block">
          <h3>Albums</h3>
          <div className="album-grid">
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
                  aria-label={`Play ${album.name}`}
                  onClick={() => void playAlbum(album)}
                >
                  <IconPlay size={22} />
                </button>
              </article>
            ))}
          </div>
        </section>
      ) : null}
      {songs.length ? (
        <section className="block">
          <h3>Tracks</h3>
          <TrackList songs={songs} showCover playAllLabel="Play genre tracks" />
        </section>
      ) : null}
      {moreAlbums || moreSongs ? (
        <button
          type="button"
          className="primary-btn ghost"
          disabled={loading}
          onClick={() => void load(Math.max(albums.length, songs.length), true)}
        >
          {loading ? 'Loading…' : 'Load more'}
        </button>
      ) : null}
      {loading && !albums.length && !songs.length ? <p className="muted">Loading genre…</p> : null}
    </div>
  )
}
