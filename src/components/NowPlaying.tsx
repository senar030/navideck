import { useEffect, useState } from 'react'
import { formatTime } from '../lib/format'
import { useAuth } from '../state/AuthContext'
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
  IconSpark,
  IconStar,
  IconVolume,
} from './Icons'

export function NowPlaying() {
  const { client } = useAuth()
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
    expanded,
    setExpanded,
    queue,
    index,
    playIndex,
    playTracks,
    toggleStar,
  } = usePlayer()
  const [showList, setShowList] = useState(false)
  const [showLyrics, setShowLyrics] = useState(false)
  const [lyrics, setLyrics] = useState('')
  const [lyricsBusy, setLyricsBusy] = useState(false)
  const [mixBusy, setMixBusy] = useState(false)

  useEffect(() => {
    setShowLyrics(false)
    setLyrics('')
  }, [current?.id])

  useEffect(() => {
    if (!showLyrics || !client || !current) return
    let cancelled = false
    setLyricsBusy(true)
    void client.getLyricsForSong(current).then((text) => {
      if (cancelled) return
      setLyrics(text)
      setLyricsBusy(false)
    })
    return () => {
      cancelled = true
    }
  }, [showLyrics, client, current])

  if (!expanded || !current) return null

  const bg = client?.coverUrl(current.coverArt, 80)
  const progress = duration ? (currentTime / duration) * 100 : 0

  function open(view: Parameters<typeof go>[0]) {
    setExpanded(false)
    go(view)
  }

  async function mixFromSong() {
    if (!client || !current) return
    setMixBusy(true)
    try {
      let songs = await client.getSimilarSongs(current.id, 40)
      if (songs.length < 8 && current.genre) {
        const extra = await client.getRandomSongs(40, current.genre)
        songs = [...songs, ...extra]
      }
      if (songs.length < 8) {
        const extra = await client.getRandomSongs(30)
        songs = [...songs, ...extra]
      }
      const rest = songs.filter((s) => s.id !== current.id)
      playTracks([current, ...rest], 0)
    } finally {
      setMixBusy(false)
    }
  }

  return (
    <div className={`now-playing ${showList ? 'has-list' : ''}`}>
      {bg ? <img className="np-bg" src={bg} alt="" /> : null}
      <div className="np-veil" />
      <button type="button" className="icon-btn np-close" aria-label="Schließen" onClick={() => setExpanded(false)}>
        <IconClose />
      </button>
      <div className="np-main">
        <div className={`np-flip ${showLyrics ? 'is-flipped' : ''}`}>
          <div className="np-flip-inner">
            <button
              type="button"
              className="np-flip-face np-flip-front"
              aria-label="Lyrics anzeigen"
              onClick={() => setShowLyrics(true)}
            >
              <CoverArt coverArt={current.coverArt} alt="" size={900} className="np-cover" />
            </button>
            <div className="np-flip-face np-flip-back">
              <div
                className="np-lyrics"
                onClick={() => setShowLyrics(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') setShowLyrics(false)
                }}
                role="button"
                tabIndex={0}
                aria-label="Cover wieder anzeigen"
              >
                {lyricsBusy ? (
                  <p className="muted">Lade Lyrics…</p>
                ) : lyrics ? (
                  <pre>{lyrics}</pre>
                ) : (
                  <p className="muted">Keine Lyrics gefunden.</p>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="np-title">
          <span className="np-title-slot" aria-hidden />
          <h2>{current.title}</h2>
          <button
            type="button"
            className={`icon-btn ${current.starred ? 'is-on' : ''}`}
            aria-label={current.starred ? 'Favorit entfernen' : 'Als Favorit merken'}
            onClick={toggleStar}
          >
            <IconStar size={22} filled={Boolean(current.starred)} />
          </button>
        </div>
        <div className="np-links">
          {current.artistId ? (
            <button type="button" className="link-btn np-artist" onClick={() => open({ name: 'artist', id: current.artistId! })}>
              {current.artist}
            </button>
          ) : (
            <span className="np-artist">{current.artist}</span>
          )}
          {current.albumId ? (
            <button type="button" className="link-btn" onClick={() => open({ name: 'album', id: current.albumId! })}>
              {current.album}
            </button>
          ) : current.album ? (
            <span>{current.album}</span>
          ) : null}
          {current.genre ? (
            <button type="button" className="link-btn" onClick={() => open({ name: 'genre', id: current.genre! })}>
              {current.genre}
            </button>
          ) : null}
        </div>
        <label className="seek">
          <span>{formatTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.5}
            value={Math.min(currentTime, duration || 0)}
            onChange={(e) => seek(Number(e.target.value))}
            style={{ ['--progress' as string]: `${progress}%` }}
          />
          <span>{formatTime(duration)}</span>
        </label>
        <div className="np-transport">
          <div className="np-transport-side">
            <button type="button" className={`icon-btn ${shuffle ? 'is-on' : ''}`} aria-label="Shuffle" onClick={toggleShuffle}>
              <IconShuffle size={22} />
            </button>
            <button type="button" className="icon-btn lg" aria-label="Previous" onClick={prev}>
              <IconPrev size={28} />
            </button>
          </div>
          <button type="button" className="play-xl" aria-label={playing ? 'Pause' : 'Play'} onClick={togglePlay}>
            {playing ? <IconPause size={32} /> : <IconPlay size={32} />}
          </button>
          <div className="np-transport-side np-transport-end">
            <button type="button" className="icon-btn lg" aria-label="Next" onClick={next}>
              <IconNext size={28} />
            </button>
            <button type="button" className={`icon-btn ${repeat !== 'off' ? 'is-on' : ''}`} aria-label="Repeat" onClick={cycleRepeat}>
              <IconRepeat size={22} />
              {repeat === 'one' ? <abbr>1</abbr> : null}
            </button>
            <button
              type="button"
              className={`icon-btn ${showList ? 'is-on' : ''}`}
              aria-label="Aktuelle Playlist"
              onClick={() => setShowList((v) => !v)}
            >
              <IconQueue size={22} />
            </button>
          </div>
        </div>
        <div className="vol-row">
          <IconVolume size={18} />
          <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(e) => setVolume(Number(e.target.value))} />
          <button type="button" className="chip mix-btn" disabled={mixBusy} onClick={() => void mixFromSong()}>
            <IconSpark size={16} /> {mixBusy ? 'Mische…' : 'Ähnlichen Mix'}
          </button>
        </div>
      </div>
      {showList ? (
        <aside className="np-queue">
          <p className="np-queue-title">Playing next</p>
          <div className="np-queue-body">
            {queue.map((song, i) => (
              <button
                key={`${song.id}-${i}`}
                type="button"
                className={`np-queue-item ${i === index ? 'is-active' : ''}`}
                onClick={() => playIndex(i)}
              >
                <span className="np-q-num">{String(i + 1).padStart(2, '0')}</span>
                <span className="track-meta">
                  <span className="track-title">{song.title}</span>
                  <span className="track-sub">{song.artist}</span>
                </span>
                <span className="track-time">{formatTime(song.duration)}</span>
              </button>
            ))}
          </div>
        </aside>
      ) : null}
    </div>
  )
}
