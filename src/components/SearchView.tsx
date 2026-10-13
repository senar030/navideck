import { useEffect, useState } from 'react'
import type { SearchResult } from '../api/types'
import { useAuth } from '../state/AuthContext'
import { useNav } from '../state/NavContext'
import { CoverArt } from './CoverArt'
import { IconSearch } from './Icons'
import { TrackList } from './TrackList'

export function SearchView() {
  const { client } = useAuth()
  const { go } = useNav()
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<SearchResult>({})
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!client || query.trim().length < 2) {
      setResult({})
      return
    }
    const t = window.setTimeout(() => {
      setBusy(true)
      void client
        .search(query.trim())
        .then(setResult)
        .finally(() => setBusy(false))
    }, 280)
    return () => window.clearTimeout(t)
  }, [client, query])

  const songs = result.song ?? []

  return (
    <div className="view">
      <header className="view-head">
        <h2>Search</h2>
        <label className="search-box">
          <IconSearch />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Albums, artists, tracks"
            autoFocus
          />
        </label>
      </header>
      {busy ? <p className="muted">Searching…</p> : null}
      {result.artist?.length ? (
        <section className="block">
          <h3>Artists</h3>
          <div className="chip-row wrap">
            {result.artist.map((a) => (
              <button key={a.id} type="button" className="chip" onClick={() => go({ name: 'artist', id: a.id })}>
                {a.name}
              </button>
            ))}
          </div>
        </section>
      ) : null}
      {result.album?.length ? (
        <section className="block">
          <h3>Albums</h3>
          <div className="album-grid compact">
            {result.album.map((album) => (
              <article key={album.id} className="album-card">
                <button type="button" className="album-hit" onClick={() => go({ name: 'album', id: album.id })}>
                  <CoverArt coverArt={album.coverArt} alt="" size={300} />
                  <span className="album-name">{album.name}</span>
                  <span className="album-artist">{album.artist}</span>
                </button>
              </article>
            ))}
          </div>
        </section>
      ) : null}
      {songs.length ? (
        <section className="block">
          <h3>Tracks</h3>
          <TrackList songs={songs} showCover playAllLabel="Play all results" />
        </section>
      ) : null}
      {query.trim().length >= 2 && !busy && !songs.length && !result.album?.length && !result.artist?.length ? (
        <p className="muted">No matches.</p>
      ) : null}
    </div>
  )
}
