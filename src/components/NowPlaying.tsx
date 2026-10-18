import { useEffect, useRef, useState } from 'react'
import { formatTime } from '../lib/format'
import { centerInScroller } from '../lib/scroll'
import { useAuth } from '../state/AuthContext'
import { useNav } from '../state/NavContext'
import { usePlayer } from '../state/PlayerContext'
import { usePrefs } from '../state/PrefsContext'
import { CoverArt } from './CoverArt'
import {
  IconClose,
  IconNext,
  IconPause,
  IconPlay,
  IconPrev,
  IconQueue,
  IconRadio,
  IconRepeat,
  IconShuffle,
  IconStar,
  IconVolume,
} from './Icons'
import { LiveBadge } from './LiveBadge'
import { MarqueeText } from './MarqueeText'

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
    volumeSupported,
    expanded,
    setExpanded,
    queue,
    index,
    playIndex,
    playTracks,
    toggleStar,
  } = usePlayer()
  const { mixSize } = usePrefs()
  const [showList, setShowList] = useState(false)
  const [showLyrics, setShowLyrics] = useState(false)
  const [lyrics, setLyrics] = useState('')
  const [lyricsBusy, setLyricsBusy] = useState(false)
  const [mixBusy, setMixBusy] = useState(false)
  const queueRef = useRef<HTMLDivElement>(null)
  const queueJumped = useRef(false)

  useEffect(() => {
    setShowLyrics(false)
    setLyrics('')
  }, [current?.id])

  useEffect(() => {
    if (!showList) {
      queueJumped.current = false
      return
    }
    const root = queueRef.current
    const item = root?.querySelector('.is-active') as HTMLElement | null
    const smooth = queueJumped.current
    queueJumped.current = true
    const id = requestAnimationFrame(() => centerInScroller(root, item, smooth))
    return () => cancelAnimationFrame(id)
  }, [index, showList, queue.length])

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

  const live = Boolean(current.radio)
  const bg = current.radio?.logo ?? client?.coverUrl(current.coverArt, 80)
  const progress = duration ? (currentTime / duration) * 100 : 0

  function open(view: Parameters<typeof go>[0]) {
    setExpanded(false)
    go(view)
  }

  async function mixFromSong() {
    if (!client || !current) return
    setMixBusy(true)
    try {
      let songs = await client.getSimilarSongs(current.id, mixSize)
      if (songs.length < Math.min(8, mixSize) && current.genre) {
        const extra = await client.getRandomSongs(mixSize, current.genre)
        songs = [...songs, ...extra]
      }
      if (songs.length < Math.min(8, mixSize)) {
        const extra = await client.getRandomSongs(mixSize)
        songs = [...songs, ...extra]
      }
      const rest = songs.filter((s) => s.id !== current.id).slice(0, mixSize)
      playTracks([current, ...rest], 0)
    } finally {
      setMixBusy(false)
    }
  }

  return (
    <div className={`now-playing ${showList ? 'has-list' : ''}`}>
      {bg ? <img className="np-bg" src={bg} alt="" /> : null}
      <div className="np-veil" />
      <button type="button" className="icon-btn np-close" aria-label="Schließen" data-tip="Schließen" onClick={() => setExpanded(false)}>
        <IconClose />
      </button>
      <div className="np-scroll">
      <div className="np-main">
        <div className={`np-flip ${showLyrics ? 'is-flipped' : ''}`}>
          <div className="np-flip-inner">
            <button
              type="button"
              className="np-flip-face np-flip-front"
              aria-label={live ? undefined : 'Songtext anzeigen'}
              data-tip={live ? undefined : 'Songtext anzeigen'}
              disabled={live}
              onClick={() => setShowLyrics(true)}
            >
              <CoverArt coverArt={current.coverArt} src={current.radio?.logo} alt="" size={900} className="np-cover" />
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
                  <p className="muted">Songtext wird geladen…</p>
                ) : lyrics ? (
                  <pre>{lyrics}</pre>
                ) : (
                  <p className="muted">Kein Songtext gefunden.</p>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="np-title">
          <span className="np-title-slot" aria-hidden />
          <h2>
            <MarqueeText className="np-title-text">{current.title}</MarqueeText>
          </h2>
          {live ? null : (
            <button
              type="button"
              className={`icon-btn ${current.starred ? 'is-on' : ''}`}
              aria-label={current.starred ? 'Favorit entfernen' : 'Als Favorit merken'}
              data-tip={current.starred ? 'Favorit entfernen' : 'Als Favorit merken'}
              onClick={toggleStar}
            >
              <IconStar size={22} filled={Boolean(current.starred)} />
            </button>
          )}
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
          {current.radio?.homepage ? (
            <a className="link-btn" href={current.radio.homepage} target="_blank" rel="noreferrer noopener">
              Webseite
            </a>
          ) : null}
        </div>
        {live ? (
          <div className="np-live">
            <LiveBadge />
          </div>
        ) : (
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
        )}
        <div className="np-transport">
          <button type="button" className={`icon-btn ${shuffle ? 'is-on' : ''}`} aria-label="Zufallswiedergabe" data-tip="Zufallswiedergabe" onClick={toggleShuffle}>
            <IconShuffle size={22} />
          </button>
          <button type="button" className="icon-btn lg" aria-label="Vorheriger Titel" data-tip="Vorheriger Titel" onClick={prev}>
            <IconPrev size={28} />
          </button>
          <button type="button" className="play-xl" aria-label={playing ? 'Pause' : 'Wiedergeben'} data-tip={playing ? 'Pause' : 'Wiedergeben'} onClick={togglePlay}>
            {playing ? <IconPause size={32} /> : <IconPlay size={32} />}
          </button>
          <button type="button" className="icon-btn lg" aria-label="Nächster Titel" data-tip="Nächster Titel" onClick={next}>
            <IconNext size={28} />
          </button>
          <button
            type="button"
            className={`icon-btn ${repeat !== 'off' ? 'is-on' : ''}`}
            aria-label={repeat === 'one' ? 'Titel wiederholen' : repeat === 'all' ? 'Alle wiederholen' : 'Wiederholen'}
            data-tip={repeat === 'one' ? 'Titel wiederholen' : repeat === 'all' ? 'Alle wiederholen' : 'Wiederholen'}
            onClick={cycleRepeat}
          >
            <IconRepeat size={22} />
            {repeat === 'one' ? <abbr>1</abbr> : null}
          </button>
        </div>
        <div className="vol-row">
          {live ? null : (
            <button
              type="button"
              className="icon-btn mix-btn"
              disabled={mixBusy}
              aria-label={mixBusy ? 'Mische…' : 'Ähnlichen Mix'}
              data-tip={mixBusy ? 'Mische…' : 'Ähnlichen Mix'}
              onClick={() => void mixFromSong()}
            >
              <IconRadio size={22} />
            </button>
          )}
          {volumeSupported ? (
            <>
              <IconVolume size={18} />
              <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(e) => setVolume(Number(e.target.value))} title="Lautstärke" aria-label="Lautstärke" />
            </>
          ) : null}
          <button
            type="button"
            className={`icon-btn np-list-btn ${showList ? 'is-on' : ''}`}
            aria-label="Warteschlange"
            data-tip="Warteschlange"
            onClick={() => setShowList((v) => !v)}
          >
            <IconQueue size={22} />
          </button>
        </div>
      </div>
      {showList ? (
        <aside className="np-queue">
          <p className="np-queue-title">Als Nächstes</p>
          <div className="np-queue-body" ref={queueRef}>
            {queue.map((song, i) => (
              <button
                key={`${song.id}-${i}`}
                type="button"
                className={`np-queue-item ${i === index ? 'is-active' : ''}`}
                onClick={() => playIndex(i)}
              >
                <span className="np-q-num">
                  {i === index ? <IconPlay size={16} /> : String(i + 1).padStart(2, '0')}
                </span>
                <span className="track-meta">
                  <MarqueeText className="track-title">{song.title}</MarqueeText>
                  <span className="track-sub">{song.artist}</span>
                </span>
                <span className="track-time">{song.radio ? 'LIVE' : formatTime(song.duration)}</span>
              </button>
            ))}
          </div>
        </aside>
      ) : null}
      </div>
    </div>
  )
}
