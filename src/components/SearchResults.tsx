import { useEffect, useState } from 'react'
import type { SearchResult } from '../api/types'
import { useAuth } from '../state/AuthContext'
import { useNav } from '../state/NavContext'
import { usePrefs } from '../state/PrefsContext'
import { CoverArt } from './CoverArt'
import { LayoutToggle } from './LayoutToggle'
import { MarqueeText } from './MarqueeText'
import { TrackList } from './TrackList'

type Props = {
  query: string
  onPick?: () => void
}

export function SearchResults({ query, onPick }: Props) {
  const { client, selectedFolderIds } = useAuth()
  const { go } = useNav()
  const { layout } = usePrefs()
  const [result, setResult] = useState<SearchResult>({})
  const [busy, setBusy] = useState(false)
  const trimmed = query.trim()
  const [lastQuery, setLastQuery] = useState(query)

  /*
   * Dropping below the two-character minimum clears the previous hits while
   * rendering, so none of them can flash back the moment the query grows again.
   */
  if (lastQuery !== query) {
    setLastQuery(query)
    if (trimmed.length < 2) setResult({})
  }

  useEffect(() => {
    if (!client || trimmed.length < 2) return
    const t = window.setTimeout(() => {
      setBusy(true)
      void client
        .search(trimmed)
        .then(setResult)
        .finally(() => setBusy(false))
    }, 280)
    return () => window.clearTimeout(t)
  }, [client, selectedFolderIds, trimmed])

  function open(view: Parameters<typeof go>[0]) {
    onPick?.()
    go(view)
  }

  const songs = result.song ?? []

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
          <div className={layout.search === 'list' ? 'artist-list' : 'artist-heads'}>
            {result.artist.map((a) =>
              layout.search === 'list' ? (
                <button key={a.id} type="button" className="artist-row" onClick={() => open({ name: 'artist', id: a.id })}>
                  <CoverArt coverArt={a.coverArt} alt="" size={120} className="avatar" />
                  <span>
                    <MarqueeText className="artist-name">{a.name}</MarqueeText>
                    <MarqueeText className="artist-count">
                      {a.albumCount ?? 0} {(a.albumCount ?? 0) === 1 ? 'Album' : 'Alben'}
                    </MarqueeText>
                  </span>
                </button>
              ) : (
                <button key={a.id} type="button" className="artist-head" onClick={() => open({ name: 'artist', id: a.id })}>
                  <CoverArt coverArt={a.coverArt} alt="" size={160} className="avatar" />
                  <MarqueeText>{a.name}</MarqueeText>
                </button>
              ),
            )}
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
                  <MarqueeText className="album-name">{album.name}</MarqueeText>
                  <MarqueeText className="album-artist">{album.artist}</MarqueeText>
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
