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
  const audioRef = useRef(new Audio())
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

  const loadAndPlay = useCallback(
    (song: Song) => {
      if (!client) return
      const audio = audioRef.current
      audio.src = client.streamUrl(song.id)
      audio.load()
      scrobbled.current = false
      void audio.play().then(
        () => setPlaying(true),
        () => setPlaying(false),
      )
      void client.scrobble(song.id, false)
    },
    [client],
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
    const audio = audioRef.current
    if (!queueRef.current.length) return
    if (audio.paused) {
      void audio.play().then(
        () => setPlaying(true),
        () => setPlaying(false),
      )
    } else {
      audio.pause()
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
      audioRef.current.pause()
      setPlaying(false)
    }
  }, [playIndex])

  const prev = useCallback(() => {
    const audio = audioRef.current
    if (audio.currentTime > 3) {
      audio.currentTime = 0
      return
    }
    const i = indexRef.current
    if (i > 0) playIndex(i - 1)
    else playIndex(0)
  }, [playIndex])

  const seek = useCallback((time: number) => {
    audioRef.current.currentTime = time
    setCurrentTime(time)
  }, [])

  const setVolume = useCallback((v: number) => {
    const clamped = Math.min(1, Math.max(0, v))
    audioRef.current.volume = clamped
    setVolumeState(clamped)
    localStorage.setItem(VOLUME_KEY, String(clamped))
    if (clamped > 0) {
      audioRef.current.muted = false
      setMuted(false)
    }
  }, [])

  const toggleMute = useCallback(() => {
    const audio = audioRef.current
    audio.muted = !audio.muted
    setMuted(audio.muted)
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
            audioRef.current.pause()
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
    const audio = audioRef.current
    audio.src = client.streamUrl(song.id)
    audio.preload = 'auto'
    const onMeta = () => {
      if (queueRef.current[indexRef.current]?.id !== song.id) return
      const t = Math.min(saved.time, Number.isFinite(audio.duration) ? audio.duration : saved.time)
      if (t > 0) audio.currentTime = t
      setDuration(audio.duration || 0)
      setCurrentTime(audio.currentTime)
    }
    audio.addEventListener('loadedmetadata', onMeta, { once: true })
    audio.load()
    if (saved.time >= 30) scrobbled.current = true
    return () => audio.removeEventListener('loadedmetadata', onMeta)
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
        time: audioRef.current.currentTime || currentTime,
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
        time: audioRef.current.currentTime,
        shuffle: shuffleRef.current,
        repeat: repeatRef.current,
      })
    }
    window.addEventListener('pagehide', save)
    return () => window.removeEventListener('pagehide', save)
  }, [client])

  useEffect(() => {
    const audio = audioRef.current
    audio.preload = 'metadata'
    audio.volume = volume
    const onTime = () => {
      const now = performance.now()
      if (now - lastTick.current < 200) return
      lastTick.current = now
      setCurrentTime(audio.currentTime)
      const song = queueRef.current[indexRef.current]
      if (
        song &&
        !scrobbled.current &&
        audio.duration > 0 &&
        (audio.currentTime >= 30 || audio.currentTime >= audio.duration * 0.5)
      ) {
        scrobbled.current = true
        void client?.scrobble(song.id, true)
      }
    }
    const onMeta = () => setDuration(audio.duration || 0)
    const onEnded = () => next()
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onMeta)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onMeta)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
    }
  }, [client, next])

  useEffect(() => {
    const song = current
    if (!song || !('mediaSession' in navigator)) return
    navigator.mediaSession.metadata = new MediaMetadata({
      title: song.title,
      artist: song.artist ?? '',
      album: song.album ?? '',
      artwork: song.coverArt && client
        ? [{ src: client.coverUrl(song.coverArt, 512) ?? '', sizes: '512x512' }]
        : [],
    })
    navigator.mediaSession.setActionHandler('play', () => {
      void audioRef.current.play()
    })
    navigator.mediaSession.setActionHandler('pause', () => audioRef.current.pause())
    navigator.mediaSession.setActionHandler('previoustrack', () => prev())
    navigator.mediaSession.setActionHandler('nexttrack', () => next())
    navigator.mediaSession.setActionHandler('seekto', (d) => {
      if (typeof d.seekTime === 'number') seek(d.seekTime)
    })
  }, [current, client, next, prev, seek])

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
