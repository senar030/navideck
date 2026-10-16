import { useEffect, useState } from 'react'
import type { SearchResult } from '../api/types'
import { useAuth } from '../state/AuthContext'
import { useNav } from '../state/NavContext'
import { usePrefs } from '../state/PrefsContext'
import { CoverArt } from './CoverArt'
import { LayoutToggle } from './LayoutToggle'
import { TrackList } from './TrackList'

export function StarredView() {
  const { client, selectedFolderIds } = useAuth()
  const { go } = useNav()
  const { layout } = usePrefs()
  const [data, setData] = useState<SearchResult>({})
  const [error, setError] = useState('')

  useEffect(() => {
    if (!client) return
    void client
      .getStarred()
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Favoriten konnten nicht geladen werden'))
  }, [client, selectedFolderIds])

  const songs = data.song ?? []
  const artists = data.artist ?? []

  return (
    <div className="view">
      <header className="view-head">
        <h2>Favoriten</h2>
        <LayoutToggle section="starred" />
      </header>
      {error ? <p className="error">{error}</p> : null}
      {artists.length ? (
        <section className="block">
          <h3>Künstler</h3>
          <div className={layout.starred === 'list' ? 'artist-list' : 'artist-heads'}>
            {artists.map((artist) =>
              layout.starred === 'list' ? (
                <button
                  key={artist.id}
                  type="button"
                  className="artist-row"
                  onClick={() => go({ name: 'artist', id: artist.id })}
                >
                  <CoverArt coverArt={artist.coverArt} alt="" size={120} className="avatar" />
                  <span>
                    <strong>{artist.name}</strong>
                    <em>
                      {artist.albumCount ?? 0} {(artist.albumCount ?? 0) === 1 ? 'Album' : 'Alben'}
                    </em>
                  </span>
                </button>
              ) : (
                <button
                  key={artist.id}
                  type="button"
                  className="artist-head"
                  onClick={() => go({ name: 'artist', id: artist.id })}
                >
                  <CoverArt coverArt={artist.coverArt} alt="" size={160} className="avatar" />
                  <span>{artist.name}</span>
                </button>
              ),
            )}
          </div>
        </section>
      ) : null}
      {data.album?.length ? (
        <section className="block">
          <h3>Alben</h3>
          <div className={`album-grid compact ${layout.starred === 'list' ? 'is-list' : ''}`}>
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
          <h3>Titel</h3>
          <TrackList songs={songs} showCover playAllLabel="Favoriten spielen" />
        </section>
      ) : null}
      {!data.album?.length && !songs.length && !artists.length && !error ? (
        <p className="muted">Noch keine Favoriten.</p>
      ) : null}
    </div>
  )
}
