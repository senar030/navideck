import { formatTime } from '../lib/format'
import { useNav } from '../state/NavContext'
import { usePlayer } from '../state/PlayerContext'
import { CoverArt } from './CoverArt'
import {
  IconClose,
  IconNext,
  IconPause,
  IconPlay,
  IconPrev,
  IconQueue,
  IconRepeat,
  IconShuffle,
  IconVolume,
} from './Icons'

export function NowPlaying() {
  const { go } = useNav()
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
    volume,
    setVolume,
    setQueueOpen,
    expanded,
    setExpanded,
  } = usePlayer()

  if (!expanded || !current) return null

  return (
    <div className="now-playing">
      <button type="button" className="icon-btn np-close" aria-label="Close" onClick={() => setExpanded(false)}>
        <IconClose />
      </button>
      <CoverArt coverArt={current.coverArt} alt="" size={700} className="np-cover" />
      <h2>{current.title}</h2>
      {current.artistId ? (
        <button
          type="button"
          className="link-btn"
          onClick={() => {
            setExpanded(false)
            go({ name: 'artist', id: current.artistId! })
          }}
        >
          {current.artist}
        </button>
      ) : (
        <p>{current.artist}</p>
      )}
      <label className="seek">
        <span>{formatTime(currentTime)}</span>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.5}
          value={Math.min(currentTime, duration || 0)}
          onChange={(e) => seek(Number(e.target.value))}
          style={{ ['--progress' as string]: `${duration ? (currentTime / duration) * 100 : 0}%` }}
        />
        <span>{formatTime(duration)}</span>
      </label>
      <div className="np-transport">
        <button
          type="button"
          className={`icon-btn ${shuffle ? 'is-on' : ''}`}
          aria-label="Shuffle"
          onClick={toggleShuffle}
        >
          <IconShuffle size={26} />
        </button>
        <button type="button" className="icon-btn lg" aria-label="Previous" onClick={prev}>
          <IconPrev size={32} />
        </button>
        <button type="button" className="play-xl" aria-label={playing ? 'Pause' : 'Play'} onClick={togglePlay}>
          {playing ? <IconPause size={40} /> : <IconPlay size={40} />}
        </button>
        <button type="button" className="icon-btn lg" aria-label="Next" onClick={next}>
          <IconNext size={32} />
        </button>
        <button
          type="button"
          className={`icon-btn ${repeat !== 'off' ? 'is-on' : ''}`}
          aria-label="Repeat"
          onClick={cycleRepeat}
        >
          <IconRepeat size={26} />
          {repeat === 'one' ? <abbr>1</abbr> : null}
        </button>
      </div>
      <div className="vol-row">
        <IconVolume />
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
        />
        <button
          type="button"
          className="icon-btn"
          aria-label="Open queue"
          onClick={() => {
            setExpanded(false)
            setQueueOpen(true)
          }}
        >
          <IconQueue size={24} />
        </button>
      </div>
    </div>
  )
}
