import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Song } from '../api/types'
import { useAuth } from './AuthContext'

export type RepeatMode = 'off' | 'all' | 'one'

type PlayerContextValue = {
  queue: Song[]
  index: number
  current: Song | undefined
  playing: boolean
  shuffle: boolean
  repeat: RepeatMode
  volume: number
  muted: boolean
  /** False on iOS, where the app cannot change the level at all. */
  volumeSupported: boolean
  currentTime: number
  duration: number
  queueOpen: boolean
  expanded: boolean
  playTracks: (tracks: Song[], startIndex?: number) => void
  addToQueue: (tracks: Song[]) => void
  playNext: (tracks: Song[]) => void
  togglePlay: () => void
  next: () => void
  prev: () => void
  seek: (time: number) => void
  setVolume: (v: number) => void
  toggleMute: () => void
  toggleShuffle: () => void
  cycleRepeat: () => void
  playIndex: (i: number) => void
  removeFromQueue: (i: number) => void
  reorderQueue: (songs: Song[]) => void
  setQueueOpen: (open: boolean) => void
  setExpanded: (open: boolean) => void
  toggleStar: () => void
}

const PlayerContext = createContext<PlayerContextValue | null>(null)
const VOLUME_KEY = 'navideck.volume'
const SESSION_KEY = 'navideck.session'

function createAudio(): HTMLAudioElement {
  const audio = new Audio()
  audio.preload = 'metadata'
  // iOS otherwise takes over the screen for inline media.
  audio.setAttribute('playsinline', 'true')
  return audio
}

/**
 * iOS ignores (and older Safari throws on) writes to `audio.volume`: the
 * hardware buttons are the only way to change the level there.
 */
function supportsVolume(audio: HTMLAudioElement): boolean {
  try {
    const previous = audio.volume
    audio.volume = 0.42
    const supported = Math.abs(audio.volume - 0.42) < 0.01
    audio.volume = previous
    return supported
  } catch {
    return false
  }
}

/**
 * Two players per page, created once for the whole app instead of on every
 * render and living outside the component keeps them out of React's dependency
 * tracking.
 *
 * One of them owns the sound; the other one buffers the *next* track in the
 * background. Handing the sound over to an element that already holds the data
 * costs no network round trip, which is exactly what used to make the gap
 * between two tracks so long over a phone network: the request for the next
 * track only started once the previous one had ended.
 */
const first = createAudio()
const second = createAudio()
second.preload = 'auto'

/** The element that owns the sound right now; `idle()` is the buffering one. */
let active: HTMLAudioElement = first

function idle(): HTMLAudioElement {
  return active === first ? second : first
}

/** Gives the buffer of an element that is no longer in use back to the browser. */
function release(element: HTMLAudioElement) {
  try {
    element.pause()
    element.removeAttribute('src')
    element.load()
    delete element.dataset.songId
  } catch {
    /* nothing to do */
  }
}

/** Data saver users asked not to spend mobile data on tracks they may skip. */
function saveData(): boolean {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
  return Boolean(connection?.saveData)
}

const volumeSupported = supportsVolume(first)

/**
 * Latest point at which the next track starts buffering, counted from the
 * moment the current one starts playing. Short tracks and slow links would
 * otherwise reach the end before the preload ever got going.
 */
const PRELOAD_AFTER_MS = 8000

type Session = {
  user: string
  queue: Song[]
  index: number
  time: number
  shuffle: boolean
  repeat: RepeatMode
}

function readVolume(): number {
  try {
    const raw = localStorage.getItem(VOLUME_KEY)
    if (!raw) return 1
    const n = Number(raw)
    return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 1
  } catch {
    return 1
  }
}

function readSession(user?: string): Session | null {
  if (!user) return null
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as Session
    if (data.user !== user || !Array.isArray(data.queue) || !data.queue.length) return null
    const index = Math.min(Math.max(0, Number(data.index) || 0), data.queue.length - 1)
    const time = Number.isFinite(data.time) ? Math.max(0, data.time) : 0
    const repeat: RepeatMode = data.repeat === 'all' || data.repeat === 'one' ? data.repeat : 'off'
    return { user, queue: data.queue, index, time, shuffle: Boolean(data.shuffle), repeat }
  } catch {
    return null
  }
}

function writeSession(session: Session) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    /* quota */
  }
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const { client } = useAuth()
  const boot = useRef(readSession(client?.username))
  const [queue, setQueue] = useState<Song[]>(() => boot.current?.queue ?? [])
  const [index, setIndex] = useState(() => boot.current?.index ?? 0)
  const [playing, setPlaying] = useState(false)
  const [shuffle, setShuffle] = useState(() => boot.current?.shuffle ?? false)
  const [repeat, setRepeat] = useState<RepeatMode>(() => boot.current?.repeat ?? 'off')
  const [volume, setVolumeState] = useState(readVolume)
  const [muted, setMuted] = useState(false)
  const [currentTime, setCurrentTime] = useState(() => boot.current?.time ?? 0)
  const [duration, setDuration] = useState(0)
  const [queueOpen, setQueueOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const scrobbled = useRef(false)
  const lastTick = useRef(0)
  const queueRef = useRef(queue)
  const indexRef = useRef(index)
  const repeatRef = useRef(repeat)
  const shuffleRef = useRef(shuffle)

  queueRef.current = queue
  indexRef.current = index
  repeatRef.current = repeat
  shuffleRef.current = shuffle

  const current = queue[index]

  /*
   * Starts whatever is already loaded in `element`; used by all three paths
   * below, so a track that is buffered never waits for the network.
   */
  const start = useCallback((element: HTMLAudioElement, song: Song) => {
    element.dataset.songId = song.id
    void element.play().then(
      () => setPlaying(true),
      () => setPlaying(false),
    )
  }, [])

  const loadAndPlay = useCallback(
    (song: Song) => {
      if (!client) return
      const url = client.streamUrl(song.id)
      scrobbled.current = false

      const holds = (element: HTMLAudioElement) =>
        element.dataset.songId === song.id &&
        element.getAttribute('src') === url &&
        element.readyState >= 1

      if (holds(active)) {
        // The same track again (repeat one, or tapping what already plays):
        // the audio is right here, so start it over instead of fetching it.
        active.currentTime = 0
        setCurrentTime(0)
        start(active, song)
      } else if (holds(idle())) {
        // The other element buffered this track while the last one played:
        // hand the sound over, there is nothing to download.
        const previous = active
        active = idle()
        active.volume = previous.volume
        active.muted = previous.muted
        setCurrentTime(active.currentTime || 0)
        setDuration(active.duration || song.duration || 0)
        void active.play().then(
          () => setPlaying(true),
          () => {
            /*
             * WebKit sometimes refuses a programmatic play() on an element that
             * was never started by hand. Fall back to a plain load, which is
             * what the app did for every track before.
             */
            active = previous
            previous.src = url
            previous.load()
            start(previous, song)
          },
        )
        // Only after the sound is on its way: emptying the other element is
        // heavy enough to be heard as a gap when it runs first.
        release(previous)
      } else {
        active.src = url
        active.load()
        start(active, song)
      }

      void client.scrobble(song.id, false)
    },
    [client, start],
  )

  const playTracks = useCallback(
    (tracks: Song[], startIndex = 0) => {
      if (!tracks.length) return
      const list = shuffleRef.current ? shuffleArray(tracks, startIndex) : tracks
      const idx = shuffleRef.current ? 0 : startIndex
      setQueue(list)
      setIndex(idx)
      loadAndPlay(list[idx])
    },
    [loadAndPlay],
  )

  const addToQueue = useCallback((tracks: Song[]) => {
    setQueue((q) => [...q, ...tracks])
  }, [])

  const playNext = useCallback((tracks: Song[]) => {
    setQueue((q) => {
      const i = indexRef.current
      const next = [...q]
      next.splice(i + 1, 0, ...tracks)
      return next
    })
  }, [])

  const togglePlay = useCallback(() => {
    if (!queueRef.current.length) return
    if (active.paused) {
      void active.play().then(
        () => setPlaying(true),
        () => setPlaying(false),
      )
    } else {
      active.pause()
      setPlaying(false)
    }
  }, [])

  const toggleStar = useCallback(() => {
    const song = queueRef.current[indexRef.current]
    if (!song || !client) return
    const next = !song.starred
    void (next ? client.star(song.id) : client.unstar(song.id)).then(
      () => {
        setQueue((q) =>
          q.map((s) =>
            s.id === song.id ? { ...s, starred: next ? new Date().toISOString() : undefined } : s,
          ),
        )
      },
      () => {
        /* ignore */
      },
    )
  }, [client])

  const playIndex = useCallback(
    (i: number) => {
      const song = queueRef.current[i]
      if (!song) return
      setIndex(i)
      loadAndPlay(song)
    },
    [loadAndPlay],
  )

  const next = useCallback(() => {
    const q = queueRef.current
    if (!q.length) return
    const i = indexRef.current
    const mode = repeatRef.current
    if (mode === 'one') {
      playIndex(i)
      return
    }
    if (i + 1 < q.length) playIndex(i + 1)
    else if (mode === 'all') playIndex(0)
    else {
      active.pause()
      setPlaying(false)
    }
  }, [playIndex])

  const prev = useCallback(() => {
    if (active.currentTime > 3) {
      active.currentTime = 0
      return
    }
    const i = indexRef.current
    if (i > 0) playIndex(i - 1)
    else playIndex(0)
  }, [playIndex])

  const seek = useCallback((time: number) => {
    active.currentTime = time
    setCurrentTime(time)
  }, [])

  const setVolume = useCallback((v: number) => {
    const clamped = Math.min(1, Math.max(0, v))
    try {
      active.volume = clamped
      idle().volume = clamped
    } catch {
      /* iOS only changes the level via the hardware buttons */
    }
    setVolumeState(clamped)
    localStorage.setItem(VOLUME_KEY, String(clamped))
    if (clamped > 0) {
      active.muted = false
      idle().muted = false
      setMuted(false)
    }
  }, [])

  const toggleMute = useCallback(() => {
    const value = !active.muted
    active.muted = value
    idle().muted = value
    setMuted(value)
  }, [])

  const toggleShuffle = useCallback(() => {
    setShuffle((s) => {
      const next = !s
      if (next) {
        setQueue((q) => {
          const i = indexRef.current
          const head = q.slice(0, i + 1)
          const tail = q.slice(i + 1)
          for (let k = tail.length - 1; k > 0; k--) {
            const j = Math.floor(Math.random() * (k + 1))
            const tmp = tail[k]
            tail[k] = tail[j]
            tail[j] = tmp
          }
          return [...head, ...tail]
        })
      }
      return next
    })
  }, [])

  const cycleRepeat = useCallback(() => {
    setRepeat((r) => (r === 'off' ? 'all' : r === 'all' ? 'one' : 'off'))
  }, [])

  const reorderQueue = useCallback((songs: Song[]) => {
    const cur = queueRef.current[indexRef.current]
    setQueue(songs)
    const next = cur ? songs.indexOf(cur) : 0
    setIndex(next >= 0 ? next : 0)
  }, [])

  const removeFromQueue = useCallback(
    (i: number) => {
      setQueue((q) => {
        const nextQ = q.filter((_, idx) => idx !== i)
        const cur = indexRef.current
        if (i < cur) setIndex(cur - 1)
        else if (i === cur) {
          if (nextQ[cur]) loadAndPlay(nextQ[cur])
          else if (nextQ[cur - 1]) {
            setIndex(cur - 1)
            loadAndPlay(nextQ[cur - 1])
          } else {
            active.pause()
            setPlaying(false)
            setIndex(0)
          }
        }
        return nextQ
      })
    },
    [loadAndPlay],
  )

  useEffect(() => {
    const saved = boot.current
    const song = saved?.queue[saved.index]
    if (!client || !song) return
    const element = active
    element.dataset.songId = song.id
    element.src = client.streamUrl(song.id)
    element.preload = 'auto'
    const onMeta = () => {
      if (queueRef.current[indexRef.current]?.id !== song.id) return
      const t = Math.min(saved.time, Number.isFinite(element.duration) ? element.duration : saved.time)
      if (t > 0) element.currentTime = t
      setDuration(element.duration || 0)
      setCurrentTime(element.currentTime)
    }
    element.addEventListener('loadedmetadata', onMeta, { once: true })
    element.load()
    if (saved.time >= 30) scrobbled.current = true
    return () => element.removeEventListener('loadedmetadata', onMeta)
  }, [client])

  useEffect(() => {
    if (!client) return
    const id = window.setTimeout(() => {
      if (!queue.length) {
        try {
          localStorage.removeItem(SESSION_KEY)
        } catch {
          /* ignore */
        }
        return
      }
      writeSession({
        user: client.username,
        queue,
        index,
        time: active.currentTime || currentTime,
        shuffle,
        repeat,
      })
    }, 400)
    return () => window.clearTimeout(id)
  }, [client, queue, index, currentTime, shuffle, repeat])

  useEffect(() => {
    const save = () => {
      if (!client || !queueRef.current.length) return
      writeSession({
        user: client.username,
        queue: queueRef.current,
        index: indexRef.current,
        time: active.currentTime,
        shuffle: shuffleRef.current,
        repeat: repeatRef.current,
      })
    }
    window.addEventListener('pagehide', save)
    return () => window.removeEventListener('pagehide', save)
  }, [client])

  useEffect(() => {
    /*
     * Both elements are wired up once. Only the one that currently owns the
     * sound reports events: the other one is either buffering the next track
     * (its `play`/`timeupdate` must not touch the UI) or has just been emptied.
     */
    const elements = [first, second]
    const mine = (event: Event) => event.currentTarget === active
    if (volumeSupported) {
      first.volume = volume
      second.volume = volume
    }
    const onTime = (event: Event) => {
      if (!mine(event)) return
      const now = performance.now()
      if (now - lastTick.current < 200) return
      lastTick.current = now
      setCurrentTime(active.currentTime)
      const song = queueRef.current[indexRef.current]
      if (
        song &&
        !scrobbled.current &&
        active.duration > 0 &&
        (active.currentTime >= 30 || active.currentTime >= active.duration * 0.5)
      ) {
        scrobbled.current = true
        void client?.scrobble(song.id, true)
      }
    }
    const onMeta = (event: Event) => {
      if (mine(event)) setDuration(active.duration || 0)
    }
    const onEnded = (event: Event) => {
      if (mine(event)) next()
    }
    const onPlay = (event: Event) => {
      if (mine(event)) setPlaying(true)
    }
    const onPause = (event: Event) => {
      if (mine(event)) setPlaying(false)
    }
    for (const element of elements) {
      element.addEventListener('timeupdate', onTime)
      element.addEventListener('loadedmetadata', onMeta)
      element.addEventListener('ended', onEnded)
      element.addEventListener('play', onPlay)
      element.addEventListener('pause', onPause)
    }
    return () => {
      for (const element of elements) {
        element.removeEventListener('timeupdate', onTime)
        element.removeEventListener('loadedmetadata', onMeta)
        element.removeEventListener('ended', onEnded)
        element.removeEventListener('play', onPlay)
        element.removeEventListener('pause', onPause)
      }
    }
  }, [client, next, volume])

  /*
   * Buffers the next track while the current one plays. Waiting for the current
   * one to be buffered enough keeps the extra request from competing with the
   * audio that is actually playing; the timer is the fallback for slow links,
   * where that event arrives late or never.
   */
  useEffect(() => {
    if (!client || !playing) return
    if (repeat === 'one') return
    const song = queue[index]
    const upcoming = queue[index + 1] ?? (repeat === 'all' ? queue[0] : undefined)
    if (!song || !upcoming || upcoming.id === song.id) return
    if (saveData()) return

    const element = active
    let timer = 0
    const arm = () => {
      const target = idle()
      const url = client.streamUrl(upcoming.id)
      if (target.dataset.songId === upcoming.id && target.getAttribute('src') === url) return
      target.dataset.songId = upcoming.id
      target.preload = 'auto'
      target.src = url
      target.load()
    }
    const onBuffered = () => {
      if (element.readyState >= 3) {
        element.removeEventListener('canplay', onBuffered)
        arm()
      }
    }
    if (element.readyState >= 3) arm()
    else {
      element.addEventListener('canplay', onBuffered)
      timer = window.setTimeout(() => {
        element.removeEventListener('canplay', onBuffered)
        arm()
      }, PRELOAD_AFTER_MS)
    }
    return () => {
      window.clearTimeout(timer)
      element.removeEventListener('canplay', onBuffered)
    }
  }, [client, queue, index, repeat, playing])

  useEffect(() => {
    const song = current
    if (!song || !('mediaSession' in navigator)) return
    const session = navigator.mediaSession
    try {
      session.metadata = new MediaMetadata({
        title: song.title,
        artist: song.artist ?? '',
        album: song.album ?? '',
        artwork:
          song.coverArt && client
            ? [{ src: client.coverUrl(song.coverArt, 512) ?? '', sizes: '512x512' }]
            : [],
      })
    } catch {
      /* some WebKit builds reject MediaMetadata */
    }
    // Not every action exists on every platform, and an unsupported one would
    // otherwise abort the whole effect.
    const handlers: Array<[MediaSessionAction, MediaSessionActionHandler]> = [
      ['play', () => void active.play()],
      ['pause', () => active.pause()],
      ['previoustrack', () => prev()],
      ['nexttrack', () => next()],
      ['stop', () => active.pause()],
      [
        'seekto',
        (details) => {
          if (typeof details.seekTime === 'number') seek(details.seekTime)
        },
      ],
    ]
    for (const [action, handler] of handlers) {
      try {
        session.setActionHandler(action, handler)
      } catch {
        /* unsupported on this platform */
      }
    }
  }, [current, client, next, prev, seek])

  // Keeps the lock screen / control centre in sync, and lets the service worker
  // know not to reload the app in the middle of a track.
  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.playbackState = playing ? 'playing' : 'paused'
  }, [playing])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.code === 'Space') {
        e.preventDefault()
        togglePlay()
      } else if (e.code === 'ArrowRight') next()
      else if (e.code === 'ArrowLeft') prev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [togglePlay, next, prev])

  const value = useMemo(
    () => ({
      queue,
      index,
      current,
      playing,
      shuffle,
      repeat,
      volume,
      muted,
      volumeSupported,
      currentTime,
      duration,
      queueOpen,
      expanded,
      playTracks,
      addToQueue,
      playNext,
      togglePlay,
      next,
      prev,
      seek,
      setVolume,
      toggleMute,
      toggleShuffle,
      cycleRepeat,
      playIndex,
      removeFromQueue,
      reorderQueue,
      setQueueOpen,
      setExpanded,
      toggleStar,
    }),
    [
      queue,
      index,
      current,
      playing,
      shuffle,
      repeat,
      volume,
      muted,
      currentTime,
      duration,
      queueOpen,
      expanded,
      playTracks,
      addToQueue,
      playNext,
      togglePlay,
      next,
      prev,
      seek,
      setVolume,
      toggleMute,
      toggleShuffle,
      cycleRepeat,
      playIndex,
      removeFromQueue,
      reorderQueue,
      toggleStar,
    ],
  )

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
}

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext)
  if (!ctx) throw new Error('usePlayer must be used inside PlayerProvider')
  return ctx
}

function shuffleArray(tracks: Song[], startIndex: number): Song[] {
  const first = tracks[startIndex]
  const rest = tracks.filter((_, i) => i !== startIndex)
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = rest[i]
    rest[i] = rest[j]
    rest[j] = tmp
  }
  return first ? [first, ...rest] : rest
}
