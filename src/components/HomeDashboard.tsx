import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Album, Genre, Playlist } from '../api/types'
import { matchMoodGenre, MOODS, type MoodId } from '../lib/moods'
import { useAuth } from '../state/AuthContext'
import { useNav } from '../state/NavContext'
import { usePlayer } from '../state/PlayerContext'
import { usePrefs } from '../state/PrefsContext'
import { CoverArt } from './CoverArt'
import { IconPlay } from './Icons'

const DASH_KEY = 'navideck.dashboard'
const ALL_WIDGETS = ['recent', 'mood', 'randomAlbums', 'genres'] as const
type WidgetId = (typeof ALL_WIDGETS)[number]
const LABELS: Record<WidgetId, string> = {
  recent: 'Kürzlich gespielt',
  mood: 'Playlist nach Stimmung',
  randomAlbums: 'Zufällige Alben',
  genres: 'Genres',
}

function readWidgets(): WidgetId[] {
  try {
    const raw = localStorage.getItem(DASH_KEY)
    if (!raw) return [...ALL_WIDGETS]
    const parsed = JSON.parse(raw) as string[]
    const valid = parsed.filter((id): id is WidgetId => ALL_WIDGETS.includes(id as WidgetId))
    return valid.length ? valid : [...ALL_WIDGETS]
  } catch {
    return [...ALL_WIDGETS]
  }
}

export function HomeDashboard() {
  const { client, selectedFolderIds } = useAuth()
  const { go } = useNav()
  const { playTracks } = usePlayer()
  const { mixSize } = usePrefs()
  const [widgets, setWidgets] = useState<WidgetId[]>(readWidgets)
  const [edit, setEdit] = useState(false)
  const [recent, setRecent] = useState<Album[]>([])
  const [random, setRandom] = useState<Album[]>([])
  const [genres, setGenres] = useState<Genre[]>([])
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [mood, setMood] = useState<MoodId>('chill')
  const [moodBusy, setMoodBusy] = useState(false)

  useEffect(() => {
    localStorage.setItem(DASH_KEY, JSON.stringify(widgets))
  }, [widgets])

  useEffect(() => {
    if (!client) return
    void client.getAlbumList('recent').then((list) => setRecent(list.slice(0, 12)))
    void client.getAlbumList('random').then((list) => setRandom(list.slice(0, 12)))
    void client.getGenres().then(setGenres)
    void client.getPlaylists().then(setPlaylists)
  }, [client, selectedFolderIds])

  const unused = ALL_WIDGETS.filter((id) => !widgets.includes(id))

  function move(index: number, dir: -1 | 1) {
    const next = index + dir
    if (next < 0 || next >= widgets.length) return
    setWidgets((w) => {
      const copy = [...w]
      const tmp = copy[index]
      copy[index] = copy[next]
      copy[next] = tmp
      return copy
    })
  }

  const startMoodMix = useCallback(async () => {
    if (!client) return
    setMoodBusy(true)
    try {
      const names = genres.map((g) => g.value)
      const genre = matchMoodGenre(mood, names)
      let songs = await client.getRandomSongs(mixSize, genre)
      if (!songs.length && genre) songs = await client.getRandomSongs(mixSize)
      if (!songs.length) {
        const moodName = MOODS.find((m) => m.id === mood)?.label.toLowerCase() ?? ''
        const list = playlists.find((p) => p.name.toLowerCase().includes(moodName))
        if (list) {
          const full = await client.getPlaylist(list.id)
          songs = [...(full.entry ?? [])].sort(() => Math.random() - 0.5)
        }
      }
      if (songs.length) playTracks(songs.slice(0, mixSize), 0)
    } finally {
      setMoodBusy(false)
    }
  }, [client, genres, mixSize, mood, playlists, playTracks])

  const genrePreview = useMemo(() => genres.slice(0, 10), [genres])

  return (
    <div className="view dashboard">
      <header className="view-head">
        <h2>Start</h2>
        <button type="button" className={`chip ${edit ? 'is-on' : ''}`} onClick={() => setEdit((e) => !e)}>
          {edit ? 'Fertig' : 'Anpassen'}
        </button>
      </header>
      {edit && unused.length ? (
        <div className="chip-row wrap dash-add">
          {unused.map((id) => (
            <button key={id} type="button" className="chip" onClick={() => setWidgets((w) => [...w, id])}>
              + {LABELS[id]}
            </button>
          ))}
        </div>
      ) : null}
      {widgets.map((id, index) => (
        <section key={id} className="dash-block">
          <header className="dash-head">
            <h3>{LABELS[id]}</h3>
            {edit ? (
              <div className="dash-edit">
                <button type="button" className="text-btn" onClick={() => move(index, -1)} disabled={index === 0}>
                  Hoch
                </button>
                <button
                  type="button"
                  className="text-btn"
                  onClick={() => move(index, 1)}
                  disabled={index === widgets.length - 1}
                >
                  Runter
                </button>
                <button type="button" className="text-btn" onClick={() => setWidgets((w) => w.filter((x) => x !== id))}>
                  Entfernen
                </button>
              </div>
            ) : null}
          </header>
          {id === 'recent' ? <AlbumRow albums={recent} /> : null}
          {id === 'randomAlbums' ? <AlbumRow albums={random} /> : null}
          {id === 'genres' ? (
            <div className="chip-row wrap">
              {genrePreview.map((g) => (
                <button key={g.value} type="button" className="chip" onClick={() => go({ name: 'genre', id: g.value })}>
                  {g.value}
                </button>
              ))}
              <button type="button" className="chip" onClick={() => go({ name: 'genres' })}>
                Alle Genres
              </button>
            </div>
          ) : null}
          {id === 'mood' ? (
            <div className="mood-box">
              <div className="chip-row wrap">
                {MOODS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`chip ${mood === m.id ? 'is-on' : ''}`}
                    onClick={() => setMood(m.id)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <button type="button" className="primary-btn" disabled={moodBusy} onClick={() => void startMoodMix()}>
                <IconPlay size={20} /> {moodBusy ? 'Mische…' : 'Zufällige Playlist starten'}
              </button>
            </div>
          ) : null}
        </section>
      ))}
    </div>
  )
}

function AlbumRow({ albums }: { albums: Album[] }) {
  const { go } = useNav()
  const { client } = useAuth()
  const { playTracks } = usePlayer()
  if (!albums.length) return <p className="muted">Noch nichts hier.</p>
  return (
    <div className="album-grid compact">
      {albums.map((album) => (
        <article key={album.id} className="album-card">
          <button type="button" className="album-hit" onClick={() => go({ name: 'album', id: album.id })}>
            <CoverArt coverArt={album.coverArt} alt="" size={240} />
            <span className="album-name">{album.name}</span>
            <span className="album-artist">{album.artist}</span>
          </button>
          <button
            type="button"
            className="play-fab"
            aria-label={`${album.name} abspielen`}
            onClick={() => {
              if (!client) return
              void client.getAlbum(album.id).then((full) => playTracks(full.song ?? [], 0))
            }}
          >
            <IconPlay size={20} />
          </button>
        </article>
      ))}
    </div>
  )
}
