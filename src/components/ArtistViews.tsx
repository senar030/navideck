import { useEffect, useMemo, useRef, useState } from 'react'
import type { Artist, ArtistIndex } from '../api/types'
import { useAuth } from '../state/AuthContext'
import { useNav } from '../state/NavContext'
import { usePlayer } from '../state/PlayerContext'
import { CoverArt } from './CoverArt'
import { IconPlay } from './Icons'

export function ArtistList() {
  const { client } = useAuth()
  const { go } = useNav()
  const [indexes, setIndexes] = useState<ArtistIndex[]>([])
  const [error, setError] = useState('')
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!client) return
    void client
      .getArtists()
      .then(setIndexes)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load artists'))
  }, [client])

  const letters = useMemo(
    () => indexes.map((i) => i.name).filter((n) => /[A-Z0-9#]/.test(n)),
    [indexes],
  )

  function jump(letter: string) {
    const el = scroller.current?.querySelector(`[data-letter="${letter}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="view artist-view">
      <header className="view-head">
        <h2>Artists</h2>
      </header>
      {error ? <p className="error">{error}</p> : null}
      <div className="artist-layout">
        <div className="artist-scroll" ref={scroller}>
          {indexes.map((group) => (
            <section key={group.name} data-letter={group.name}>
              <h3 className="letter">{group.name}</h3>
              <div className="artist-list">
                {(group.artist ?? []).map((artist) => (
                  <button
                    key={artist.id}
                    type="button"
                    className="artist-row"
                    onClick={() => go({ name: 'artist', id: artist.id })}
                  >
                    <CoverArt coverArt={artist.coverArt} alt="" size={120} className="avatar" />
                    <span>
                      <strong>{artist.name}</strong>
                      <em>
                        {artist.albumCount ?? 0} album{(artist.albumCount ?? 0) === 1 ? '' : 's'}
                      </em>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
        <div className="az" aria-label="Jump to letter">
          {letters.map((l) => (
            <button key={l} type="button" onClick={() => jump(l)}>
              {l}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export function ArtistDetail({ id }: { id: string }) {
  const { client } = useAuth()
  const { go } = useNav()
  const { playTracks } = usePlayer()
  const [artist, setArtist] = useState<Artist | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!client) return
    void client
      .getArtist(id)
      .then(setArtist)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load artist'))
  }, [client, id])

  async function playAll() {
    if (!client || !artist?.album?.length) return
    const albums = await Promise.all(artist.album.map((a) => client.getAlbum(a.id)))
    const songs = albums.flatMap((a) => a.song ?? [])
    playTracks(songs, 0)
  }

  if (error) return <p className="error">{error}</p>
  if (!artist) return <p className="muted">Loading artist…</p>

  return (
    <div className="view detail">
      <div className="hero">
        <CoverArt coverArt={artist.coverArt} alt="" size={400} className="hero-cover avatar" />
        <div className="hero-copy">
          <p className="eyebrow">Artist</p>
          <h2>{artist.name}</h2>
          <p className="muted">{artist.albumCount ?? artist.album?.length ?? 0} albums</p>
          <div className="hero-actions">
            <button type="button" className="primary-btn" onClick={() => void playAll()}>
              <IconPlay size={22} /> Play all
            </button>
          </div>
        </div>
      </div>
      <div className="album-grid">
        {(artist.album ?? []).map((album) => (
          <article key={album.id} className="album-card">
            <button type="button" className="album-hit" onClick={() => go({ name: 'album', id: album.id })}>
              <CoverArt coverArt={album.coverArt} alt="" size={400} />
              <span className="album-name">{album.name}</span>
              <span className="album-artist">{album.year}</span>
            </button>
          </article>
        ))}
      </div>
    </div>
  )
}
