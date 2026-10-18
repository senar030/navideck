import { formatTime } from '../lib/format'
import { usePlayer } from '../state/PlayerContext'
import { CoverArt } from './CoverArt'
import { LiveBadge } from './LiveBadge'
import { MarqueeText } from './MarqueeText'
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
  const live = Boolean(current?.radio)

  return (
    <footer className="player-bar">
      <div className="player-dock">
        <button
          type="button"
          className="player-dock-hit"
          onClick={() => current && setExpanded(true)}
          disabled={!current}
        >
          <CoverArt coverArt={current?.coverArt} src={current?.radio?.logo} alt="" size={120} className="player-cover" />
          <span className="track-meta">
            <MarqueeText className="track-title">{current?.title ?? 'Nichts spielt'}</MarqueeText>
            <span className="track-sub">{current?.artist ?? 'Titel wählen'}</span>
          </span>
        </button>
        <button
          type="button"
          className="icon-btn player-dock-play"
          aria-label={playing ? 'Pause' : 'Wiedergeben'}
          onClick={(e) => {
            e.stopPropagation()
            togglePlay()
          }}
          disabled={!current}
        >
          {playing ? <IconPause size={22} /> : <IconPlay size={22} />}
        </button>
        <button
          type="button"
          className="icon-btn"
          aria-label="Nächster Titel"
          onClick={(e) => {
            e.stopPropagation()
            next()
          }}
          disabled={!current}
        >
          <IconNext size={22} />
        </button>
      </div>
      <button
        type="button"
        className="player-now"
        data-tip={current ? 'Wiedergabe öffnen' : undefined}
        onClick={() => current && setExpanded(true)}
        disabled={!current}
      >
        <CoverArt coverArt={current?.coverArt} src={current?.radio?.logo} alt="" size={160} className="player-cover" />
        <span className="track-meta">
          <MarqueeText className="track-title">{current?.title ?? 'Nichts spielt'}</MarqueeText>
          <span className="track-sub">{current?.artist ?? 'Titel wählen'}</span>
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
        {live ? null : (
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
        )}
        <button type="button" className="icon-btn lg" aria-label="Warteschlange" data-tip="Warteschlange" onClick={() => setQueueOpen(true)}>
          <IconQueue size={22} />
        </button>
      </div>
      {live ? (
        <div className="player-seek is-live">
          <LiveBadge detail={current?.album} />
        </div>
      ) : (
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
      )}
    </footer>
  )
}
