import { useEffect, useState } from 'react'
import type { Album } from '../api/types'
import { formatTime } from '../lib/format'
import { useAuth } from '../state/AuthContext'
import { useNav } from '../state/NavContext'
import { usePlayer } from '../state/PlayerContext'
import { CoverArt } from './CoverArt'
import { IconPlay, IconQueue, IconStar } from './Icons'
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
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Album konnte nicht geladen werden'))
  }, [client, id])

  if (error) return <p className="error">{error}</p>
  if (!album) return <p className="muted">Album wird geladen…</p>

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
            <button type="button" className="link-btn hero-artist" onClick={() => go({ name: 'artist', id: album.artistId! })}>
              {album.artist}
            </button>
          ) : (
            <p className="hero-artist">{album.artist}</p>
          )}
          {album.genre || album.year ? (
            <p className="hero-facts muted">
              {[album.genre, album.year].filter(Boolean).join(' · ')}
            </p>
          ) : null}
          <p className="hero-meta muted">
            {[songs.length ? `${songs.length} Titel` : null, formatTime(album.duration)].filter(Boolean).join(' · ')}
          </p>
          {/* Star – play – queue, so the play button ends up centred between the
              two icons instead of being pushed left by the queue label. */}
          <div className="hero-actions">
            <button
              type="button"
              className={`icon-btn ${starred ? 'is-on' : ''}`}
              aria-label={starred ? 'Favorit entfernen' : 'Als Favorit merken'}
              data-tip={starred ? 'Favorit entfernen' : 'Als Favorit merken'}
              onClick={() => {
                if (!client) return
                const next = !starred
                setStarred(next)
                void (next ? client.star(album.id, 'albumId') : client.unstar(album.id, 'albumId'))
              }}
            >
              <IconStar filled={starred} />
            </button>
            <button type="button" className="primary-btn" onClick={() => playTracks(songs, 0)}>
              <IconPlay size={22} /> Abspielen
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label="Album einreihen"
              data-tip="Album einreihen"
              onClick={() => addToQueue(songs)}
            >
              <IconQueue />
            </button>
          </div>
        </div>
        </div>
      </div>
      <TrackList songs={songs} />
    </div>
  )
}
