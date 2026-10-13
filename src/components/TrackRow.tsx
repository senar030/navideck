import { useState } from 'react'
import type { Song } from '../api/types'
import { formatTime } from '../lib/format'
import { useAuth } from '../state/AuthContext'
import { usePlayer } from '../state/PlayerContext'
import { CoverArt } from './CoverArt'
import { IconPlay, IconPlayNext, IconQueue, IconStar } from './Icons'

type Props = {
  tracks: Song[]
  song: Song
  index: number
  showCover?: boolean
}

export function TrackRow({ tracks, song, index, showCover = false }: Props) {
  const { client } = useAuth()
  const { current, playing, playTracks, addToQueue, playNext } = usePlayer()
  const [starred, setStarred] = useState(Boolean(song.starred))
  const active = current?.id === song.id

  async function toggleStar() {
    if (!client) return
    try {
      if (starred) await client.unstar(song.id)
      else await client.star(song.id)
      setStarred(!starred)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className={`track-row ${active ? 'is-active' : ''}`}>
      <button type="button" className="track-main" onClick={() => playTracks(tracks, index)}>
        {showCover ? (
          <CoverArt coverArt={song.coverArt} alt="" size={80} className="track-cover" />
        ) : (
          <span className="track-num">
            {active && playing ? <IconPlay size={18} /> : (song.track ?? index + 1)}
          </span>
        )}
        <span className="track-meta">
          <span className="track-title">{song.title}</span>
          <span className="track-sub">{[song.artist, song.album].filter(Boolean).join(' · ')}</span>
        </span>
      </button>
      <span className="track-time">{formatTime(song.duration)}</span>
      <button
        type="button"
        className="icon-btn"
        aria-label="Play next"
        onClick={() => playNext([song])}
      >
        <IconPlayNext />
      </button>
      <button
        type="button"
        className="icon-btn"
        aria-label="Add to queue"
        onClick={() => addToQueue([song])}
      >
        <IconQueue size={20} />
      </button>
      <button
        type="button"
        className={`icon-btn ${starred ? 'is-on' : ''}`}
        aria-label={starred ? 'Unstar' : 'Star'}
        onClick={() => void toggleStar()}
      >
        <IconStar size={20} filled={starred} />
      </button>
    </div>
  )
}
