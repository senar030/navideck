import { useEffect, useState } from 'react'
import type { Playlist } from '../api/types'
import { formatTime } from '../lib/format'
import { useAuth } from '../state/AuthContext'
import { useNav } from '../state/NavContext'
import { usePlayer } from '../state/PlayerContext'
import { CoverArt } from './CoverArt'
import { IconPlay } from './Icons'
import { TrackList } from './TrackList'

export function PlaylistList() {
  const { client } = useAuth()
  const { go } = useNav()
  const [lists, setLists] = useState<Playlist[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!client) return
    void client
      .getPlaylists()
      .then(setLists)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load playlists'))
  }, [client])

  return (
    <div className="view">
      <header className="view-head">
        <h2>Playlists</h2>
      </header>
      {error ? <p className="error">{error}</p> : null}
      <div className="playlist-list">
        {lists.map((list) => (
          <button
            key={list.id}
            type="button"
            className="playlist-row"
            onClick={() => go({ name: 'playlist', id: list.id })}
          >
            <CoverArt coverArt={list.coverArt} alt="" size={160} />
            <span>
              <strong>{list.name}</strong>
              <em>
                {list.songCount ?? 0} tracks
                {list.duration ? ` · ${formatTime(list.duration)}` : ''}
              </em>
            </span>
          </button>
        ))}
        {!lists.length && !error ? <p className="muted">No playlists yet.</p> : null}
      </div>
    </div>
  )
}

export function PlaylistDetail({ id }: { id: string }) {
  const { client } = useAuth()
  const { playTracks, addToQueue } = usePlayer()
  const [list, setList] = useState<Playlist | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!client) return
    void client
      .getPlaylist(id)
      .then(setList)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load playlist'))
  }, [client, id])

  if (error) return <p className="error">{error}</p>
  if (!list) return <p className="muted">Loading playlist…</p>
  const songs = list.entry ?? []

  return (
    <div className="view detail">
      <div className="hero">
        <CoverArt coverArt={list.coverArt} alt="" size={400} className="hero-cover" />
        <div className="hero-copy">
          <p className="eyebrow">Playlist</p>
          <h2>{list.name}</h2>
          {list.comment ? <p>{list.comment}</p> : null}
          <p className="muted">
            {songs.length} tracks
            {list.duration ? ` · ${formatTime(list.duration)}` : ''}
          </p>
          <div className="hero-actions">
            <button type="button" className="primary-btn" onClick={() => playTracks(songs, 0)}>
              <IconPlay size={22} /> Play
            </button>
            <button type="button" className="primary-btn ghost" onClick={() => addToQueue(songs)}>
              Queue all
            </button>
          </div>
        </div>
      </div>
      <TrackList songs={songs} showCover />
    </div>
  )
}
