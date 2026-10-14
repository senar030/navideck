import { useEffect, useState } from 'react'
import type { Album } from '../api/types'
import { formatTime } from '../lib/format'
import { useAuth } from '../state/AuthContext'
import { useNav } from '../state/NavContext'
import { usePlayer } from '../state/PlayerContext'
import { CoverArt } from './CoverArt'
import { IconPlay, IconStar } from './Icons'
import { TrackList } from './TrackList'

export function AlbumDetail({ id }: { id: string }) {
  const { client } = useAuth()
  const { go } = useNav()
  const { playTracks, addToQueue } = usePlayer()
  const [album, setAlbum] = useState<Album | null>(null)
  const [error, setError] = useState('')
  const [starred, setStarred] = useState(false)

  useEffect(() => {
    if (!client) return
    void client
      .getAlbum(id)
      .then((next) => {
        setAlbum(next)
        setStarred(Boolean(next.starred))
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load album'))
  }, [client, id])

  if (error) return <p className="error">{error}</p>
  if (!album) return <p className="muted">Loading album…</p>

  const songs = album.song ?? []

  const bg = client?.coverUrl(album.coverArt, 80)

  return (
    <div className="view detail">
      <div className="hero-banner">
        {bg ? <img className="hero-bg" src={bg} alt="" /> : null}
        <div className="hero-veil" />
        <div className="hero">
        <CoverArt coverArt={album.coverArt} alt="" size={600} className="hero-cover" />
        <div className="hero-copy">
          <p className="eyebrow">Album</p>
          <h2>{album.name}</h2>
          {album.artistId ? (
            <button type="button" className="link-btn" onClick={() => go({ name: 'artist', id: album.artistId! })}>
              {album.artist}
            </button>
          ) : (
            <p>{album.artist}</p>
          )}
          <p className="muted">
            {[album.year, songs.length ? `${songs.length} tracks` : null, formatTime(album.duration)]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <div className="hero-actions">
            <button type="button" className="primary-btn" onClick={() => playTracks(songs, 0)}>
              <IconPlay size={22} /> Play
            </button>
            <button type="button" className="primary-btn ghost" onClick={() => addToQueue(songs)}>
              Queue album
            </button>
            <button
              type="button"
              className={`icon-btn ${starred ? 'is-on' : ''}`}
              aria-label={starred ? 'Unstar album' : 'Star album'}
              onClick={() => {
                if (!client) return
                const next = !starred
                setStarred(next)
                void (next ? client.star(album.id, 'albumId') : client.unstar(album.id, 'albumId'))
              }}
            >
              <IconStar filled={starred} />
            </button>
          </div>
        </div>
        </div>
      </div>
      <TrackList songs={songs} />
    </div>
  )
}
