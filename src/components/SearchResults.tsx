import { useEffect, useState } from 'react'
import type { SearchResult } from '../api/types'
import { useAuth } from '../state/AuthContext'
import { useNav } from '../state/NavContext'
import { usePrefs } from '../state/PrefsContext'
import { CoverArt } from './CoverArt'
import { LayoutToggle } from './LayoutToggle'
import { TrackList } from './TrackList'

type Props = {
  query: string
  onPick?: () => void
}

export function SearchResults({ query, onPick }: Props) {
  const { client } = useAuth()
  const { go } = useNav()
  const { layout } = usePrefs()
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

  function open(view: Parameters<typeof go>[0]) {
    onPick?.()
    go(view)
  }

  const songs = result.song ?? []
  const trimmed = query.trim()

  if (trimmed.length < 2) {
    return <p className="muted">Mindestens zwei Zeichen eingeben…</p>
  }

  return (
    <div className="search-results">
      <div className="search-results-tools">
        <LayoutToggle section="search" />
      </div>
      {busy ? <p className="muted">Suche…</p> : null}
      {result.artist?.length ? (
        <section className="block">
          <h3>Künstler</h3>
          <div className="chip-row wrap">
            {result.artist.map((a) => (
              <button key={a.id} type="button" className="chip" onClick={() => open({ name: 'artist', id: a.id })}>
                {a.name}
              </button>
            ))}
          </div>
        </section>
      ) : null}
      {result.album?.length ? (
        <section className="block">
          <h3>Alben</h3>
          <div className={`album-grid compact ${layout.search === 'list' ? 'is-list' : ''}`}>
            {result.album.map((album) => (
              <article key={album.id} className="album-card">
                <button type="button" className="album-hit" onClick={() => open({ name: 'album', id: album.id })}>
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
          <TrackList songs={songs} showCover playAllLabel="Alle Ergebnisse spielen" />
        </section>
      ) : null}
      {trimmed.length >= 2 && !busy && !songs.length && !result.album?.length && !result.artist?.length ? (
        <p className="muted">Keine Treffer.</p>
      ) : null}
    </div>
  )
}
