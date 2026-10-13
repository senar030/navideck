import { useEffect, useState } from 'react'
import type { SearchResult } from '../api/types'
import { useAuth } from '../state/AuthContext'
import { useNav } from '../state/NavContext'
import { CoverArt } from './CoverArt'
import { TrackList } from './TrackList'

export function StarredView() {
  const { client } = useAuth()
  const { go } = useNav()
  const [data, setData] = useState<SearchResult>({})
  const [error, setError] = useState('')

  useEffect(() => {
    if (!client) return
    void client
      .getStarred()
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load starred'))
  }, [client])

  const songs = data.song ?? []

  return (
    <div className="view">
      <header className="view-head">
        <h2>Starred</h2>
      </header>
      {error ? <p className="error">{error}</p> : null}
      {data.album?.length ? (
        <section className="block">
          <h3>Albums</h3>
          <div className="album-grid compact">
            {data.album.map((album) => (
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
          <TrackList songs={songs} showCover playAllLabel="Play starred tracks" />
        </section>
      ) : null}
      {!data.album?.length && !songs.length && !error ? <p className="muted">Nothing starred yet.</p> : null}
    </div>
  )
}
