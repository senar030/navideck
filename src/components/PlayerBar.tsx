import { formatTime } from '../lib/format'
import { usePlayer } from '../state/PlayerContext'
import { CoverArt } from './CoverArt'
import {
  IconNext,
  IconPause,
  IconPlay,
  IconPrev,
  IconQueue,
  IconRepeat,
  IconShuffle,
  IconStar,
} from './Icons'

export function PlayerBar() {
  const {
    current,
    playing,
    togglePlay,
    next,
    prev,
    currentTime,
    duration,
    seek,
    shuffle,
    toggleShuffle,
    repeat,
    cycleRepeat,
    setQueueOpen,
    setExpanded,
    toggleStar,
  } = usePlayer()

  const progress = duration ? (currentTime / duration) * 100 : 0

  return (
    <footer className="player-bar">
      <button
        type="button"
        className="player-now"
        data-tip={current ? 'Now Playing öffnen' : undefined}
        onClick={() => current && setExpanded(true)}
        disabled={!current}
      >
        <CoverArt coverArt={current?.coverArt} alt="" size={160} className="player-cover" />
        <span className="track-meta">
          <span className="track-title">{current?.title ?? 'Nothing playing'}</span>
          <span className="track-sub">{current?.artist ?? 'Pick an album to start'}</span>
        </span>
      </button>
      <div className="player-controls">
        <div className="player-buttons">
          <button
            type="button"
            className={`icon-btn ${shuffle ? 'is-on' : ''}`}
            aria-label="Zufallswiedergabe"
            data-tip="Zufallswiedergabe"
            onClick={toggleShuffle}
          >
            <IconShuffle />
          </button>
          <button type="button" className="icon-btn lg" aria-label="Vorheriger Titel" data-tip="Vorheriger Titel" onClick={prev} disabled={!current}>
            <IconPrev />
          </button>
          <button
            type="button"
            className="play-md"
            aria-label={playing ? 'Pause' : 'Wiedergeben'}
            data-tip={playing ? 'Pause' : 'Wiedergeben'}
            onClick={togglePlay}
            disabled={!current}
          >
            {playing ? <IconPause size={26} /> : <IconPlay size={26} />}
          </button>
          <button type="button" className="icon-btn lg" aria-label="Nächster Titel" data-tip="Nächster Titel" onClick={next} disabled={!current}>
            <IconNext />
          </button>
          <button
            type="button"
            className={`icon-btn ${repeat !== 'off' ? 'is-on' : ''}`}
            aria-label={repeat === 'one' ? 'Titel wiederholen' : repeat === 'all' ? 'Alle wiederholen' : 'Wiederholen'}
            data-tip={repeat === 'one' ? 'Titel wiederholen' : repeat === 'all' ? 'Alle wiederholen' : 'Wiederholen'}
            onClick={cycleRepeat}
          >
            <IconRepeat />
            {repeat === 'one' ? <abbr>1</abbr> : null}
          </button>
        </div>
      </div>
      <div className="player-extra">
        <button
          type="button"
          className={`icon-btn lg ${current?.starred ? 'is-on' : ''}`}
          aria-label={current?.starred ? 'Favorit entfernen' : 'Als Favorit merken'}
          data-tip={current?.starred ? 'Favorit entfernen' : 'Als Favorit merken'}
          onClick={toggleStar}
          disabled={!current}
        >
          <IconStar size={22} filled={Boolean(current?.starred)} />
        </button>
        <button type="button" className="icon-btn lg" aria-label="Warteschlange" data-tip="Warteschlange" onClick={() => setQueueOpen(true)}>
          <IconQueue size={22} />
        </button>
      </div>
      <label className="seek player-seek">
        <span>{formatTime(currentTime)}</span>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.5}
          value={Math.min(currentTime, duration || 0)}
          onChange={(e) => seek(Number(e.target.value))}
          disabled={!current}
          style={{ ['--progress' as string]: `${progress}%` }}
        />
        <span>{formatTime(duration)}</span>
      </label>
    </footer>
  )
}
