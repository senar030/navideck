import { formatTime } from '../lib/format'
import { usePlayer } from '../state/PlayerContext'
import { CoverArt } from './CoverArt'
import { IconPause, IconPlay } from './Icons'

/*
 * The way back into whatever was playing. The player already keeps the queue,
 * the track and the position in local storage and loads that track into the
 * audio element on start, so this is only the button: it starts the sound again
 * and the position comes from the player. With no queue there is nothing to
 * continue, and the whole panel stays away.
 *
 * `only` narrows it to one kind of content: the audiobook and podcast homes
 * show their own half of the queue, not a song that happens to be playing.
 */
export function ResumePlaying({ only }: { only?: 'book' | 'episode' } = {}) {
  const { queue, index, current, playing, currentTime, duration, togglePlay } = usePlayer()

  if (!queue.length || !current) return null
  if (only === 'book' && !(current.abs && !current.abs.episodeId)) return null
  if (only === 'episode' && !current.abs?.episodeId) return null

  const label = playing ? 'Pause' : 'Weiterhören'

  return (
    <section className="resume" aria-label="Weiterhören">
      <CoverArt coverArt={current.coverArt} src={current.abs?.cover ?? current.radio?.logo} alt="" size={240} className="resume-art" />
      <div className="resume-text">
        <p className="eyebrow">{playing ? 'Läuft gerade' : 'Weiterhören'}</p>
        <p className="resume-title">{current.title}</p>
        <p className="resume-sub muted">{[current.artist, current.album].filter(Boolean).join(' · ')}</p>
        <p className="resume-facts muted">
          Titel {index + 1} von {queue.length}
          {duration ? ` · ${formatTime(currentTime)} / ${formatTime(duration)}` : ''}
        </p>
      </div>
      <button
        type="button"
        className="play-xl resume-btn"
        aria-label={label}
        data-tip={label}
        onClick={togglePlay}
      >
        {playing ? <IconPause size={26} /> : <IconPlay size={26} />}
      </button>
    </section>
  )
}
