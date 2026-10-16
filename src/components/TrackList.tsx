import { useMemo, useState } from 'react'
import type { Song } from '../api/types'
import { sortSongs, type SongSort } from '../lib/format'
import { usePlayer } from '../state/PlayerContext'
import { TrackRow } from './TrackRow'

const OPTIONS: { id: SongSort; label: string }[] = [
  { id: 'original', label: 'Standard' },
  { id: 'title', label: 'Titel' },
  { id: 'artist', label: 'Künstler' },
  { id: 'album', label: 'Album' },
  { id: 'duration', label: 'Dauer' },
]

type Props = {
  songs: Song[]
  showCover?: boolean
  playAllLabel?: string
}

export function TrackList({ songs, showCover = false, playAllLabel }: Props) {
  const { playTracks } = usePlayer()
  const [sort, setSort] = useState<SongSort>('original')
  const [desc, setDesc] = useState(false)
  const ordered = useMemo(() => sortSongs(songs, sort, desc), [songs, sort, desc])

  function pick(next: SongSort) {
    if (next === sort) setDesc((d) => !d)
    else {
      setSort(next)
      setDesc(false)
    }
  }

  return (
    <div>
      {playAllLabel && songs.length ? (
        <button type="button" className="primary-btn ghost sort-play" onClick={() => playTracks(ordered, 0)}>
          {playAllLabel}
        </button>
      ) : null}
      {songs.length > 1 ? (
        <div className="chip-row wrap sort-row" role="toolbar" aria-label="Titel sortieren">
          {OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`chip ${sort === opt.id ? 'is-on' : ''}`}
              onClick={() => pick(opt.id)}
            >
              {opt.label}
              {sort === opt.id ? (desc ? ' ↓' : ' ↑') : ''}
            </button>
          ))}
        </div>
      ) : null}
      <div className="track-list">
        {ordered.map((song, i) => (
          <TrackRow key={`${song.id}-${i}`} tracks={ordered} song={song} index={i} showCover={showCover} />
        ))}
      </div>
    </div>
  )
}
