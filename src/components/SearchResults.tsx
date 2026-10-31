import { useEffect, useState } from 'react'
import type { AbsAuthor, AbsClient, AbsLibraryItem, AbsSearchEpisode } from '../api/abs'
import type { SearchResult } from '../api/types'
import { useAbsPlayer } from '../lib/useAbsPlayer'
import { useAccount } from '../state/AccountContext'
import { useAuth } from '../state/AuthContext'
import { useNav } from '../state/NavContext'
import { usePrefs } from '../state/PrefsContext'
import { AuthorCard, BookCard, EpisodeCard, PodcastCard } from './AbsParts'
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
  const { abs, podcasts } = useAccount()
  const { playEpisode } = useAbsPlayer()
  const { go } = useNav()
  const { layout } = usePrefs()
  const [music, setMusic] = useState<SearchResult>({})
  const [books, setBooks] = useState<AbsLibraryItem[]>([])
  const [authors, setAuthors] = useState<AbsAuthor[]>([])
  const [shows, setShows] = useState<AbsLibraryItem[]>([])
  const [episodes, setEpisodes] = useState<AbsSearchEpisode[]>([])
  const [busy, setBusy] = useState(false)
  const trimmed = query.trim()
  const [lastQuery, setLastQuery] = useState(query)
  const booksClient = abs?.client ?? null
  const booksLibraryId = abs?.books?.id ?? null
  const podcastClient = podcasts?.client ?? null
  const podcastLibraryId = podcasts?.libraryId ?? null
  const podcastKind = podcasts?.kind ?? null
  const canSearch = Boolean(client || (booksClient && booksLibraryId) || podcastClient)

  /*
   * Dropping below the two-character minimum clears the previous hits while
   * rendering, so none of them can flash back the moment the query grows again.
   */
  if (lastQuery !== query) {
    setLastQuery(query)
    if (trimmed.length < 2) {
      setMusic({})
      setBooks([])
      setAuthors([])
      setShows([])
      setEpisodes([])
    }
  }

  useEffect(() => {
    if (trimmed.length < 2) return
    if (!client && !(booksClient && booksLibraryId) && !podcastClient) return
    let alive = true
    const t = window.setTimeout(() => {
      setBusy(true)
      const jobs: Promise<unknown>[] = []

      if (client) {
        jobs.push(
          client
            .search(trimmed)
            .then((result) => {
              if (alive) setMusic(result)
            })
            .catch(() => undefined),
        )
      } else {
        setMusic({})
      }

      if (booksClient && booksLibraryId) {
        jobs.push(
          booksClient
            .searchLibrary(booksLibraryId, trimmed, 24)
            .then((result) => {
              if (!alive) return
              setBooks(result.items)
              setAuthors(result.authors)
            })
            .catch(() => undefined),
        )
      } else {
        setBooks([])
        setAuthors([])
      }

      if (podcastClient && podcastLibraryId) {
        if (podcastKind === 'audiobookshelf') {
          jobs.push(
            (podcastClient as AbsClient)
              .searchLibrary(podcastLibraryId, trimmed, 24)
              .then((result) => {
                if (!alive) return
                setShows(result.items)
                setEpisodes(result.episodes)
              })
              .catch(() => undefined),
          )
        } else {
          jobs.push(
            podcastClient
              .searchItems(podcastLibraryId, trimmed, 24)
              .then((items) => {
                if (!alive) return
                setShows(items)
                setEpisodes([])
              })
              .catch(() => undefined),
          )
        }
      } else {
        setShows([])
        setEpisodes([])
      }

      void Promise.allSettled(jobs).finally(() => {
        if (alive) setBusy(false)
      })
    }, 280)
    return () => {
      alive = false
      window.clearTimeout(t)
    }
  }, [booksClient, booksLibraryId, client, podcastClient, podcastKind, podcastLibraryId, selectedFolderIds, trimmed])

  function open(view: Parameters<typeof go>[0]) {
    onPick?.()
    go(view)
  }

  const songs = music.song ?? []
  const artists = music.artist ?? []
  const albums = music.album ?? []
  const empty =
    !busy &&
    !songs.length &&
    !artists.length &&
    !albums.length &&
    !books.length &&
    !authors.length &&
    !shows.length &&
    !episodes.length

  if (trimmed.length < 2) {
    return <p className="muted">Mindestens zwei Zeichen eingeben…</p>
  }

  return (
    <div className="search-results">
      <div className="search-results-tools">
        <LayoutToggle section="search" />
      </div>
      {busy ? <p className="muted">Suche…</p> : null}
      {!canSearch ? <p className="muted">Noch keine Quelle verbunden.</p> : null}
      {artists.length ? (
        <section className="block">
          <h3>Künstler</h3>
          <div className={layout.search === 'list' ? 'artist-list' : 'artist-heads'}>
            {artists.map((artist) =>
              layout.search === 'list' ? (
                <button
                  key={artist.id}
                  type="button"
                  className="artist-row"
                  onClick={() => open({ name: 'artist', id: artist.id })}
                >
                  <CoverArt coverArt={artist.coverArt} alt="" size={120} className="avatar" />
                  <span>
                    <MarqueeText className="artist-name">{artist.name}</MarqueeText>
                    <MarqueeText className="artist-count">
                      {artist.albumCount ?? 0} {(artist.albumCount ?? 0) === 1 ? 'Album' : 'Alben'}
                    </MarqueeText>
                  </span>
                </button>
              ) : (
                <button
                  key={artist.id}
                  type="button"
                  className="artist-head"
                  onClick={() => open({ name: 'artist', id: artist.id })}
                >
                  <CoverArt coverArt={artist.coverArt} alt="" size={160} className="avatar" />
                  <MarqueeText>{artist.name}</MarqueeText>
                </button>
              ),
            )}
          </div>
        </section>
      ) : null}
      {albums.length ? (
        <section className="block">
          <h3>Alben</h3>
          <div className={`album-grid compact ${layout.search === 'list' ? 'is-list' : ''}`}>
            {albums.map((album) => (
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
      {books.length ? (
        <section className="block">
          <h3>Hörbücher</h3>
          <div className={`album-grid compact ${layout.search === 'list' ? 'is-list' : ''}`}>
            {books.map((item) => (
              <BookCard
                key={item.id}
                item={item}
                onOpen={() => open({ name: 'abs-book', id: item.id })}
              />
            ))}
          </div>
        </section>
      ) : null}
      {authors.length ? (
        <section className="block">
          <h3>Autoren</h3>
          <div className={`artist-list ${layout.search === 'list' ? '' : 'is-grid'}`}>
            {authors.map((author) => (
              <AuthorCard
                key={author.id}
                author={author}
                onOpen={() => open({ name: 'abs-author', id: author.id })}
              />
            ))}
          </div>
        </section>
      ) : null}
      {episodes.length ? (
        <section className="block">
          <h3>Podcast-Folgen</h3>
          <div className={`album-grid compact ${layout.search === 'list' ? 'is-list' : ''}`}>
            {episodes.map((ref) => (
              <EpisodeCard
                key={`${ref.item.id}:${ref.episode.id}`}
                item={ref.item}
                episode={ref.episode}
                onOpen={() => open({ name: 'podcast', id: ref.item.id })}
                onPlay={() => void playEpisode(ref.item, ref.episode)}
              />
            ))}
          </div>
        </section>
      ) : null}
      {shows.length ? (
        <section className="block">
          <h3>Podcasts</h3>
          <div className={`album-grid compact ${layout.search === 'list' ? 'is-list' : ''}`}>
            {shows.map((item) => (
              <PodcastCard
                key={item.id}
                item={item}
                onOpen={() => open({ name: 'podcast', id: item.id })}
              />
            ))}
          </div>
        </section>
      ) : null}
      {empty ? <p className="muted">Keine Treffer.</p> : null}
    </div>
  )
}
