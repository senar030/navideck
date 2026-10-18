import { useEffect, useRef, useState } from 'react'
import { formatTime, sortSongs, type SongSort } from '../lib/format'
import { centerInScroller } from '../lib/scroll'
import { usePlayer } from '../state/PlayerContext'
import { CoverArt } from './CoverArt'
import { IconClose } from './Icons'
import { MarqueeText } from './MarqueeText'

const OPTIONS: { id: SongSort; label: string }[] = [
  { id: 'original', label: 'Standard' },
  { id: 'title', label: 'Titel' },
  { id: 'artist', label: 'Künstler' },
  { id: 'album', label: 'Album' },
  { id: 'duration', label: 'Dauer' },
]

export function QueuePanel() {
  const { queue, index, playIndex, removeFromQueue, reorderQueue, queueOpen, setQueueOpen } = usePlayer()
  const [sort, setSort] = useState<SongSort>('original')
  const [desc, setDesc] = useState(false)
  const snapshot = useRef(queue)
  const listRef = useRef<HTMLDivElement>(null)
  const jumped = useRef(false)

  useEffect(() => {
    if (queueOpen) {
      snapshot.current = queue
      setSort('original')
      setDesc(false)
      jumped.current = false
    }
  }, [queueOpen])

  useEffect(() => {
    if (!queueOpen) return
    const root = listRef.current
    const item = root?.querySelector('.is-active') as HTMLElement | null
    const smooth = jumped.current
    jumped.current = true
    const id = requestAnimationFrame(() => centerInScroller(root, item, smooth))
    return () => cancelAnimationFrame(id)
  }, [index, queueOpen, queue.length])

  if (!queueOpen) return null

  function pick(next: SongSort) {
    const nextDesc = next === sort ? !desc : false
    setSort(next)
    setDesc(nextDesc)
    reorderQueue(sortSongs(snapshot.current, next, nextDesc))
  }

  return (
    <div className="sheet-backdrop" onClick={() => setQueueOpen(false)}>
      <aside className="sheet" onClick={(e) => e.stopPropagation()}>
        <header className="sheet-head">
          <h3>Warteschlange · {queue.length}</h3>
          <button type="button" className="icon-btn" aria-label="Warteschlange schließen" onClick={() => setQueueOpen(false)}>
            <IconClose />
          </button>
        </header>
        {queue.length > 1 ? (
          <div className="chip-row wrap sort-row sheet-sort" role="toolbar" aria-label="Warteschlange sortieren">
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
        <div className="sheet-body" ref={listRef}>
          {queue.map((song, i) => (
            <div key={`${song.id}-${i}`} className={`queue-row ${i === index ? 'is-active' : ''}`}>
              <button type="button" className="queue-main" onClick={() => playIndex(i)}>
                <CoverArt coverArt={song.coverArt} src={song.radio?.logo} alt="" size={80} className="track-cover" />
                <span className="track-meta">
                  <MarqueeText className="track-title">{song.title}</MarqueeText>
                  <span className="track-sub">{song.artist}</span>
                </span>
              </button>
              <span className="track-time">{song.radio ? 'LIVE' : formatTime(song.duration)}</span>
              <button type="button" className="icon-btn" aria-label="Entfernen" onClick={() => removeFromQueue(i)}>
                <IconClose size={18} />
              </button>
            </div>
          ))}
          {!queue.length ? <p className="muted">Warteschlange ist leer. Starte ein Album, um loszulegen.</p> : null}
        </div>
      </aside>
    </div>
  )
}
