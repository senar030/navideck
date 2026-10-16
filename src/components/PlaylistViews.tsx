import { useEffect, useState } from 'react'
import type { Playlist } from '../api/types'
import { formatTime } from '../lib/format'
import { useAuth } from '../state/AuthContext'
import { useNav } from '../state/NavContext'
import { usePlayer } from '../state/PlayerContext'
import { CoverArt } from './CoverArt'
import { usePrefs } from '../state/PrefsContext'
import { IconPlay } from './Icons'
import { LayoutToggle } from './LayoutToggle'
import { TrackList } from './TrackList'

export function PlaylistList() {
  const { client, selectedFolderIds } = useAuth()
  const { go } = useNav()
  const { layout } = usePrefs()
  const [lists, setLists] = useState<Playlist[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!client) return
    void client
      .getPlaylists()
      .then(setLists)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Playlists konnten nicht geladen werden'))
  }, [client, selectedFolderIds])

  return (
    <div className="view">
      <header className="view-head">
        <h2>Playlists</h2>
        <LayoutToggle section="playlists" />
      </header>
      {error ? <p className="error">{error}</p> : null}
      <div className={`playlist-list ${layout.playlists === 'grid' ? 'is-grid' : ''}`}>
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
                {list.songCount ?? 0} Titel
                {list.duration ? ` · ${formatTime(list.duration)}` : ''}
              </em>
            </span>
          </button>
        ))}
        {!lists.length && !error ? <p className="muted">Noch keine Playlists.</p> : null}
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
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Playlist konnte nicht geladen werden'))
  }, [client, id])

  if (error) return <p className="error">{error}</p>
  if (!list) return <p className="muted">Playlist wird geladen…</p>
  const songs = list.entry ?? []
  const bg = client?.coverUrl(list.coverArt, 80)

  return (
    <div className="view detail">
      <div className="hero-banner">
        {bg ? <img className="hero-bg" src={bg} alt="" /> : null}
        <div className="hero-veil" />
        <div className="hero">
          <CoverArt coverArt={list.coverArt} alt="" size={600} className="hero-cover" />
          <div className="hero-copy">
            <p className="eyebrow">Playlist</p>
            <h2>{list.name}</h2>
            {list.comment ? <p>{list.comment}</p> : null}
            <p className="muted">
              {songs.length} Titel
              {list.duration ? ` · ${formatTime(list.duration)}` : ''}
            </p>
            <div className="hero-actions">
              <button type="button" className="primary-btn" onClick={() => playTracks(songs, 0)}>
                <IconPlay size={22} /> Abspielen
              </button>
              <button type="button" className="primary-btn ghost" onClick={() => addToQueue(songs)}>
                Alle einreihen
              </button>
            </div>
          </div>
        </div>
      </div>
      <TrackList songs={songs} showCover />
    </div>
  )
}
