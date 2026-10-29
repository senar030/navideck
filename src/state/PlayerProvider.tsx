import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { AbsClient } from '../api/abs'
import type { Song } from '../api/types'
import { readRadioNow, type RadioNow } from '../lib/radioNow'
import { useAccount, type PodcastClient } from './AccountContext'
import { useAuth } from './AuthContext'
import { PlayerContext, type RepeatMode } from './PlayerContext'

const VOLUME_KEY = 'navideck.volume'
const SESSION_KEY = 'navideck.session'

/** How often a live stream is asked what is on air. */
const RADIO_POLL_MS = 25_000

/** The last start call wins; an older seek must not touch a newer track. */
let startSequence = 0

/** Which song an element really holds; queue refs can be one render behind. */
const songByElement = new WeakMap<HTMLAudioElement, Song>()

/** What the last poll of a station's status page said. */
type RadioPoll = { url: string; now: RadioNow | null; misses: number }

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
    songByElement.delete(element)
  } catch {
    /* nothing to do */
  }
}

/** Data saver users asked not to spend mobile data on tracks they may skip. */
function saveData(): boolean {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
  return Boolean(connection?.saveData)
}

/** A live stream answers with `Infinity` — or nothing — when asked how long it is. */
function finiteDuration(element: HTMLAudioElement, fallback = 0): number {
  return Number.isFinite(element.duration) ? element.duration : fallback
}

const volumeSupported = supportsVolume(first)

/**
 * How close to the end of a track the next one starts buffering, in seconds.
 * Long before that the download would compete with the audio that is playing
 * (and with whatever else the app is fetching at the same time), which is
 * exactly what makes a freshly started playlist feel slower.
 */
const PRELOAD_LEAD_S = 60
/** ... and never earlier than this share of the track, whatever its length. */
const PRELOAD_EARLIEST = 0.4

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
  const { abs, podcasts, noteProgress } = useAccount()
  /** The account a saved session belongs to; music and books share one queue. */
  const sessionUser = client?.username ?? (abs ? 'konto' : null)
  /*
   * The session is read once, when the provider mounts, and never written to —
   * state rather than a ref, so the initializers below can read it during render
   * and the stored queue is not parsed again on every render.
   */
  const [boot] = useState(() => readSession(sessionUser ?? undefined))
  /** What the last session left behind, if anything: the track the app opens on. */
  const restored = boot?.queue[boot.index]
  const [queue, setQueue] = useState<Song[]>(() => boot?.queue ?? [])
  const [index, setIndex] = useState(() => boot?.index ?? 0)
  const [playing, setPlaying] = useState(false)
  const [shuffle, setShuffle] = useState(() => boot?.shuffle ?? false)
  const [repeat, setRepeat] = useState<RepeatMode>(() => boot?.repeat ?? 'off')
  const [volume, setVolumeState] = useState(readVolume)
  const [muted, setMuted] = useState(false)
  const [duration, setDuration] = useState(0)
  /*
   * A live stream has no position, so the one the last session remembered means
   * nothing for it and the clock starts at zero.
   */
  const [currentTime, setCurrentTime] = useState(() => (restored?.radio ? 0 : boot?.time ?? 0))
  const [queueOpen, setQueueOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const scrobbled = useRef(false)
  const lastTick = useRef(0)
  const lastAbs = useRef(0)
  const absRef = useRef<{ client: AbsClient; note: typeof noteProgress } | null>(null)
  const podcastRef = useRef<{ client: PodcastClient; note: typeof noteProgress } | null>(null)
  const queueRef = useRef(queue)
  const indexRef = useRef(index)
  const repeatRef = useRef(repeat)
  const shuffleRef = useRef(shuffle)

  /*
   * The audio element's own listeners and the promise chains around them are
   * registered once and read the queue through these refs. They are written
   * after the commit, which is where every reader runs, and this is the first
   * effect in the component, so the ones below it already see the new values.
   */
  useEffect(() => {
    queueRef.current = queue
    indexRef.current = index
    repeatRef.current = repeat
    shuffleRef.current = shuffle
  }, [index, queue, repeat, shuffle])

  const current = queue[index]

  /*
   * Listening progress for books and episodes is reported to the server that
   * owns them, not to Navidrome. The session lives in a ref because the audio
   * element's listeners are bound once and must always see the current one.
   */
  useEffect(() => {
    absRef.current = abs ? { client: abs.client, note: noteProgress } : null
    podcastRef.current = podcasts ? { client: podcasts.client, note: noteProgress } : null
  }, [abs, podcasts, noteProgress])

  const reportAbs = useCallback((song: Song, seconds: number, finished = false) => {
    const entry = song.abs
    const live = entry?.subsonic ? podcastRef.current : absRef.current
    if (!entry || !live) return
    const total = entry.total > 0 ? entry.total : seconds
    const at = Math.max(0, Math.min(total, seconds))
    live.note({
      itemId: entry.itemId,
      episodeId: entry.episodeId,
      currentTime: at,
      duration: total,
      isFinished: finished,
    })
    void live.client
      .updateProgress({
        itemId: entry.itemId,
        episodeId: entry.episodeId,
        currentTime: at,
        duration: total,
        isFinished: finished,
      })
      .catch(() => undefined)
  }, [])

  /*
   * A live stream says what it plays every few minutes, and only through its own
   * status page, so the line is polled while it plays. The answer is tagged with
   * the stream it belongs to: switching stations makes it invisible without an
   * extra state reset, and pausing keeps the last line instead of blanking it.
   */
  const [radioPoll, setRadioPoll] = useState<RadioPoll | null>(null)
  const radioStream = current?.radio?.url
  const radioStation = current?.radio ? current.title : undefined
  const radioNow = radioPoll && radioPoll.url === radioStream ? radioPoll.now : null

  useEffect(() => {
    if (!radioStream || !playing) return
    let cancelled = false
    const controller = new AbortController()

    const poll = async () => {
      const now = await readRadioNow(radioStream, radioStation, controller.signal)
      if (cancelled) return
      setRadioPoll((prev) => {
        if (now) return { url: radioStream, now, misses: 0 }
        // One missed poll is a hiccup; two in a row mean the line is gone.
        if (prev && prev.url === radioStream && prev.misses < 1) {
          return { ...prev, misses: prev.misses + 1 }
        }
        return { url: radioStream, now: null, misses: 1 }
      })
    }

    void poll()
    const timer = window.setInterval(() => void poll(), RADIO_POLL_MS)
    return () => {
      cancelled = true
      controller.abort()
      window.clearInterval(timer)
    }
  }, [radioStream, radioStation, playing])

  /*
   * Starts whatever is already loaded in `element`; used by all three paths
   * below, so a track that is buffered never waits for the network.
   */
  const start = useCallback((element: HTMLAudioElement, song: Song) => {
    element.dataset.songId = song.id
    songByElement.set(element, song)
    const token = ++startSequence

    const begin = () => {
      if (token !== startSequence) return
      void element.play().then(
        () => {
          if (token === startSequence) setPlaying(true)
        },
        () => {
          if (token === startSequence) setPlaying(false)
        },
      )
    }

    const at = song.startAt ?? 0
    if (!(at > 0)) {
      begin()
      return
    }

    /*
     * A book resumes inside its file. Seek before the first sound: playing from
     * zero and jumping a moment later meant a second at the wrong place, and
     * the seek's new range request arrived while the element was already busy.
     * On a slow link that left the book stuck at the seek. Only the entry that
     * carries an offset seeks — the next files of the same book start at zero.
     */
    let done = false
    let timer = 0
    const cleanup = () => {
      element.removeEventListener('loadedmetadata', seek)
      element.removeEventListener('seeked', ready)
      element.removeEventListener('canplay', ready)
      window.clearTimeout(timer)
    }
    const finish = () => {
      if (done) return
      done = true
      cleanup()
      begin()
    }
    const ready = () => finish()
    const seek = () => {
      if (done) return
      if (token !== startSequence) {
        cleanup()
        return
      }
      if (Math.abs(element.currentTime - at) <= 0.5) {
        finish()
        return
      }
      /*
       * Wait for the seek to land before pressing play; `canplay` covers the
       * browsers that do not emit `seeked` for a position already buffered.
       */
      element.addEventListener('seeked', ready, { once: true })
      element.addEventListener('canplay', ready, { once: true })
      try {
        element.currentTime = at
      } catch {
        finish()
        return
      }
      timer = window.setTimeout(finish, 5000)
    }

    if (element.readyState >= 1) seek()
    else element.addEventListener('loadedmetadata', seek, { once: true })
  }, [])

  const loadAndPlay = useCallback(
    (song: Song) => {
      // Music needs Navidrome; a book or a station carries its own stream.
      if (!client && !song.radio && !song.abs) return
      /*
       * A radio entry and an Audiobookshelf entry carry their own stream URL;
       * anything else is a file that Navidrome hands out. Neither is scrobbled
       * to Navidrome — it does not own them.
       */
      const url = song.radio?.url ?? song.abs?.url ?? client!.streamUrl(song.id)
      scrobbled.current = Boolean(song.radio || song.abs)

      const sameSource = (element: HTMLAudioElement) =>
        element.dataset.songId === song.id && element.getAttribute('src') === url
      const holds = (element: HTMLAudioElement) => sameSource(element) && element.readyState >= 1

      if (holds(active)) {
        // The same track again (repeat one, or tapping what already plays):
        // the audio is right here, so start it over instead of fetching it.
        // A live stream has no beginning to jump back to, so it reconnects.
        if (song.radio) active.load()
        else active.currentTime = 0
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
        setDuration(finiteDuration(active, song.duration ?? 0))
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
      } else if (sameSource(active)) {
        /*
         * The same file is already on its way — the session started loading it,
         * or an earlier click did. Calling load() again aborts that request and
         * makes the server read the large file from the beginning a second time,
         * which is exactly the long stall before a book starts. Wait for the
         * request already in flight instead.
         */
        setCurrentTime(song.startAt ?? active.currentTime)
        start(active, song)
      } else if (sameSource(idle())) {
        // The other element is still loading this file; take it over as it is.
        const previous = active
        active = idle()
        active.volume = previous.volume
        active.muted = previous.muted
        start(active, song)
        release(previous)
      } else {
        /*
         * Whatever the other element was buffering belongs to a queue that is
         * no longer playing: it would steal bandwidth from this track right
         * when it needs its first bytes — the one moment where it is noticed.
         */
        const other = idle()
        if (other.dataset.songId && other.dataset.songId !== song.id) release(other)
        active.src = url
        active.load()
        start(active, song)
      }

      if (!song.radio && !song.abs) void client?.scrobble(song.id, false)
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
    // A station has no id Navidrome could star, and a book belongs elsewhere.
    if (!song || !client || song.radio || song.abs) return
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
    if (queueRef.current[indexRef.current]?.radio) {
      // A live stream has no start to go back to: reconnect to the live edge.
      active.load()
      void active.play().then(
        () => setPlaying(true),
        () => setPlaying(false),
      )
      return
    }
    if (active.currentTime > 3) {
      active.currentTime = 0
      return
    }
    const i = indexRef.current
    if (i > 0) playIndex(i - 1)
    else playIndex(0)
  }, [playIndex])

  const seek = useCallback((time: number) => {
    // A live stream cannot be seeked — the bar is not shown for it either.
    if (queueRef.current[indexRef.current]?.radio) return
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

  /*
   * Nothing left to show and nothing left to play: the bar disappears with the
   * queue. The stored session is dropped here rather than only in the debounced
   * save below, so a tab closed right after clearing does not bring it back.
   */
  const clearQueue = useCallback(() => {
    release(active)
    release(idle())
    scrobbled.current = false
    setPlaying(false)
    setQueue([])
    setIndex(0)
    setCurrentTime(0)
    setDuration(0)
    setQueueOpen(false)
    setExpanded(false)
    try {
      localStorage.removeItem(SESSION_KEY)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    const saved = boot
    const song = saved?.queue[saved.index]
    if (!song || (!client && !song.radio && !song.abs)) return
    const element = active
    element.dataset.songId = song.id
    songByElement.set(element, song)
    element.src = song.radio?.url ?? song.abs?.url ?? client!.streamUrl(song.id)
    if (song.radio) {
      /*
       * A live stream must not be opened just because the app was started: that
       * would pull the station for a session that never plays it. The URL is in
       * place, so the play button fetches it when it is really wanted.
       */
      element.preload = 'none'
      scrobbled.current = true
      return
    }
    element.preload = 'auto'
    const onMeta = () => {
      if (queueRef.current[indexRef.current]?.id !== song.id) return
      const t = song.abs
        ? saved.time || song.startAt || 0
        : Math.min(saved.time, finiteDuration(element, saved.time))
      if (t > 0) element.currentTime = t
      setDuration(finiteDuration(element))
      setCurrentTime(element.currentTime)
    }
    element.addEventListener('loadedmetadata', onMeta, { once: true })
    element.load()
    if (saved.time >= 30) scrobbled.current = true
    return () => element.removeEventListener('loadedmetadata', onMeta)
  }, [boot, client])

  useEffect(() => {
    if (!sessionUser) return
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
        user: sessionUser,
        queue,
        index,
        time: active.currentTime || currentTime,
        shuffle,
        repeat,
      })
    }, 400)
    return () => window.clearTimeout(id)
  }, [sessionUser, queue, index, currentTime, shuffle, repeat])

  useEffect(() => {
    const save = () => {
      if (!sessionUser || !queueRef.current.length) return
      writeSession({
        user: sessionUser,
        queue: queueRef.current,
        index: indexRef.current,
        time: active.currentTime,
        shuffle: shuffleRef.current,
        repeat: repeatRef.current,
      })
    }
    window.addEventListener('pagehide', save)
    return () => window.removeEventListener('pagehide', save)
  }, [sessionUser])

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
      const song = songByElement.get(active) ?? queueRef.current[indexRef.current]
      // A live stream has no progress to show and nothing to scrobble.
      if (song?.radio) return
      setCurrentTime(active.currentTime)
      if (song?.abs) {
        // Every ten seconds is enough for another device to pick up here.
        if (now - lastAbs.current >= 10_000) {
          lastAbs.current = now
          reportAbs(song, song.abs.startOffset + active.currentTime)
        }
        return
      }
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
      if (mine(event)) setDuration(finiteDuration(active))
    }
    const onEnded = (event: Event) => {
      if (!mine(event)) return
      const song = songByElement.get(active) ?? queueRef.current[indexRef.current]
      if (song?.abs) {
        const entry = song.abs
        // The last file of a book, or the only file of an episode, is the end.
        const last = !entry.tracks || entry.track === entry.tracks
        reportAbs(song, entry.total, last)
        lastAbs.current = 0
      }
      next()
    }
    const onPlay = (event: Event) => {
      if (mine(event)) setPlaying(true)
    }
    const onPause = (event: Event) => {
      if (!mine(event)) return
      setPlaying(false)
      const song = songByElement.get(active) ?? queueRef.current[indexRef.current]
      if (song?.abs) reportAbs(song, song.abs.startOffset + active.currentTime)
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
  }, [client, next, reportAbs, volume])

  /*
   * Buffers the next track while the current one plays, but only once the
   * current one is far enough along: never in its first 40 %, and at the
   * latest one minute before it ends. Starting any earlier only competes for
   * bandwidth with the track that is playing — and with the library requests
   * that a playlist being opened right now depends on.
   */
  useEffect(() => {
    const song = queue[index]
    const upcoming = queue[index + 1] ?? (repeat === 'all' ? queue[0] : undefined)
    // A station is never preloaded: there is no beginning to buffer ahead of the
    // live edge, and an open connection would pull it for a track maybe skipped.
    // A book file is long enough that its successor is not wanted early either.
    const wantedSong =
      repeat !== 'one' && upcoming && !upcoming.radio && !upcoming.abs && upcoming.id !== song?.id
        ? upcoming
        : null
    const wanted = wantedSong?.id ?? null
    const wantedUrl = wantedSong ? (wantedSong.abs?.url ?? client?.streamUrl(wantedSong.id)) : undefined

    // A preload for a track this queue no longer plays must not keep running.
    const target = idle()
    if (target.dataset.songId && target.dataset.songId !== wanted) release(target)
    if (!wanted || !wantedUrl || !playing || saveData()) return

    const element = active
    const arm = () => {
      element.removeEventListener('timeupdate', check)
      element.removeEventListener('progress', check)
      if (target.dataset.songId === wanted && target.getAttribute('src')) return
      target.dataset.songId = wanted
      target.preload = 'auto'
      target.src = wantedUrl
      target.load()
    }
    const check = () => {
      const duration = element.duration
      const played = element.currentTime
      if (!(duration > 0)) {
        if (played >= 30) arm()
        return
      }
      const from = Math.max(duration * PRELOAD_EARLIEST, duration - PRELOAD_LEAD_S)
      if (played >= from) arm()
    }
    check()
    element.addEventListener('timeupdate', check)
    element.addEventListener('progress', check)
    return () => {
      element.removeEventListener('timeupdate', check)
      element.removeEventListener('progress', check)
    }
  }, [client, queue, index, repeat, playing])

  useEffect(() => {
    const song = current
    if (!song || !('mediaSession' in navigator)) return
    const session = navigator.mediaSession
    /*
     * For a live stream the app's own title is the station, but a lock screen is
     * more useful with the track that is on air right now; the station moves into
     * the album line so it is not lost.
     */
    const now = song.radio ? radioNow : null
    const artwork = song.radio?.logo
      ? song.radio.logo
      : song.abs?.cover
        ? song.abs.cover
        : song.coverArt && client
          ? client.coverUrl(song.coverArt, 512)
          : null
    try {
      session.metadata = new MediaMetadata({
        title: now?.title ?? song.title,
        artist: now?.artist ?? song.artist ?? '',
        album: now ? song.title : song.album ?? '',
        artwork: artwork ? [{ src: artwork, sizes: '512x512' }] : [],
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
    ]
    // A live stream has no timeline to jump around in.
    if (!song.radio) {
      handlers.push([
        'seekto',
        (details) => {
          if (typeof details.seekTime === 'number') seek(details.seekTime)
        },
      ])
    }
    for (const [action, handler] of handlers) {
      try {
        session.setActionHandler(action, handler)
      } catch {
        /* unsupported on this platform */
      }
    }
  }, [current, client, next, prev, radioNow, seek])

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
      radioNow,
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
      clearQueue,
      setQueueOpen,
      setExpanded,
      toggleStar,
    }),
    [
      queue,
      index,
      current,
      playing,
      radioNow,
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
      clearQueue,
      toggleStar,
    ],
  )

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
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
