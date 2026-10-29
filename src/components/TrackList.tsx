import { useMemo, useState } from 'react'
import type { Song } from '../api/types'
import { sortSongs, type SongSort } from '../lib/format'
import { usePlayer } from '../state/PlayerContext'
import { SortMenu } from './SortMenu'
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

  return (
    <div>
      <div className="sort-bar">
        {playAllLabel && songs.length ? (
          <button type="button" className="primary-btn ghost sort-play" onClick={() => playTracks(ordered, 0)}>
            {playAllLabel}
          </button>
        ) : null}
        {songs.length > 1 ? (
          <SortMenu
            options={OPTIONS}
            value={sort}
            desc={desc}
            onChange={(next, nextDesc) => {
              setSort(next)
              setDesc(nextDesc)
            }}
          />
        ) : null}
      </div>
      <div className="track-list">
        {ordered.map((song, i) => (
          <TrackRow key={`${song.id}-${i}`} tracks={ordered} song={song} index={i} showCover={showCover} />
        ))}
      </div>
    </div>
  )
}
