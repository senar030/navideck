import { useState } from 'react'
import type { Song } from '../api/types'
import { formatTime } from '../lib/format'
import { useAuth } from '../state/AuthContext'
import { usePlayer } from '../state/PlayerContext'
import { CoverArt } from './CoverArt'
import { IconPlay, IconQueue, IconStar } from './Icons'
import { MarqueeText } from './MarqueeText'

type Props = {
  tracks: Song[]
  song: Song
  index: number
  showCover?: boolean
}

export function TrackRow({ tracks, song, index, showCover = false }: Props) {
  const { client } = useAuth()
  const { current, playing, playTracks, addToQueue } = usePlayer()
  const active = current?.id === song.id
  /* What Navidrome says: the row's own song, or the playing one when it is this. */
  const external = Boolean(song.starred) || (active && Boolean(current?.starred))
  const [starred, setStarred] = useState(external)
  const [known, setKnown] = useState(external)

  /*
   * A star set here only has to hold until Navidrome reports the new state back,
   * which is what `external` then carries. Adjusted while rendering rather than
   * in an effect, so the row is never painted once with the star it is about to
   * replace.
   */
  if (known !== external) {
    setKnown(external)
    setStarred(external)
  }

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
          <MarqueeText className="track-title" delay={1.2 + (index % 5) * 0.5}>
            {song.title}
          </MarqueeText>
          <span className="track-sub">{[song.artist, song.album].filter(Boolean).join(' · ')}</span>
        </span>
      </button>
      <span className="track-time">{formatTime(song.duration)}</span>
      <button
        type="button"
        className="icon-btn"
        aria-label="Zur Warteschlange hinzufügen"
        onClick={() => addToQueue([song])}
      >
        <IconQueue size={20} />
      </button>
      <button
        type="button"
        className={`icon-btn ${starred ? 'is-on' : ''}`}
        aria-label={starred ? 'Favorit entfernen' : 'Als Favorit merken'}
        onClick={() => void toggleStar()}
      >
        <IconStar size={20} filled={starred} />
      </button>
    </div>
  )
}
