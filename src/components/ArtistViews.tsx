import { useEffect, useMemo, useRef, useState } from 'react'
import type { Artist, ArtistIndex, ArtistInfo, Song } from '../api/types'
import { stripHtml } from '../lib/format'
import { useAuth } from '../state/AuthContext'
import { useNav } from '../state/NavContext'
import { usePlayer } from '../state/PlayerContext'
import { CoverArt } from './CoverArt'
import { IconPlay } from './Icons'
import { TrackList } from './TrackList'

export function ArtistList() {
  const { client } = useAuth()
  const { go } = useNav()
  const [indexes, setIndexes] = useState<ArtistIndex[]>([])
  const [error, setError] = useState('')
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!client) return
    void client
      .getArtists()
      .then(setIndexes)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load artists'))
  }, [client])

  const letters = useMemo(
    () => indexes.map((i) => i.name).filter((n) => /[A-Z0-9#]/.test(n)),
    [indexes],
  )

  function jump(letter: string) {
    const el = scroller.current?.querySelector(`[data-letter="${letter}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="view artist-view">
      <header className="view-head">
        <h2>Artists</h2>
      </header>
      {error ? <p className="error">{error}</p> : null}
      <div className="artist-layout">
        <div className="artist-scroll" ref={scroller}>
          {indexes.map((group) => (
            <section key={group.name} data-letter={group.name}>
              <h3 className="letter">{group.name}</h3>
              <div className="artist-list">
                {(group.artist ?? []).map((artist) => (
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
                        {artist.albumCount ?? 0} album{(artist.albumCount ?? 0) === 1 ? '' : 's'}
                      </em>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
        <div className="az" aria-label="Jump to letter">
          {letters.map((l) => (
            <button key={l} type="button" onClick={() => jump(l)}>
              {l}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export function ArtistDetail({ id }: { id: string }) {
  const { client } = useAuth()
  const { go } = useNav()
  const { playTracks } = usePlayer()
  const [artist, setArtist] = useState<Artist | null>(null)
  const [info, setInfo] = useState<ArtistInfo>({})
  const [songs, setSongs] = useState<Song[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!client) return
    void client
      .getArtist(id)
      .then(async (next) => {
        setArtist(next)
        const albums = await Promise.all((next.album ?? []).map((a) => client.getAlbum(a.id)))
        setSongs(albums.flatMap((a) => a.song ?? []))
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load artist'))
    void client.getArtistInfo(id).then(setInfo).catch(() => setInfo({}))
  }, [client, id])

  function playAll() {
    if (songs.length) playTracks(songs, 0)
  }

  if (error) return <p className="error">{error}</p>
  if (!artist) return <p className="muted">Künstler wird geladen…</p>

  const bio = stripHtml(info.biography)
  const links = [
    info.lastFmUrl ? { href: info.lastFmUrl, label: 'Last.fm' } : null,
    info.musicBrainzId
      ? { href: `https://musicbrainz.org/artist/${info.musicBrainzId}`, label: 'MusicBrainz' }
      : null,
  ].filter(Boolean) as { href: string; label: string }[]

  return (
    <div className="view detail">
      <div className="hero">
        <CoverArt coverArt={artist.coverArt} alt="" size={400} className="hero-cover avatar" />
        <div className="hero-copy">
          <p className="eyebrow">Künstler</p>
          <h2>{artist.name}</h2>
          <p className="muted">
            {artist.albumCount ?? artist.album?.length ?? 0} Alben
            {songs.length ? ` · ${songs.length} Titel` : ''}
          </p>
          <div className="hero-actions">
            <button type="button" className="primary-btn" onClick={playAll} disabled={!songs.length}>
              <IconPlay size={22} /> Alles spielen
            </button>
          </div>
        </div>
      </div>
      {bio ? <p className="artist-bio">{bio}</p> : null}
      {links.length ? (
        <div className="chip-row wrap">
          {links.map((link) => (
            <a key={link.href} className="chip" href={link.href} target="_blank" rel="noreferrer">
              {link.label}
            </a>
          ))}
        </div>
      ) : null}
      {info.similarArtist?.length ? (
        <section className="block">
          <h3>Ähnliche Künstler</h3>
          <div className="chip-row wrap">
            {info.similarArtist.map((a) => (
              <button key={a.id} type="button" className="chip" onClick={() => go({ name: 'artist', id: a.id })}>
                {a.name}
              </button>
            ))}
          </div>
        </section>
      ) : null}
      <section className="block">
        <h3>Alben</h3>
        <div className="album-grid">
          {(artist.album ?? []).map((album) => (
            <article key={album.id} className="album-card">
              <button type="button" className="album-hit" onClick={() => go({ name: 'album', id: album.id })}>
                <CoverArt coverArt={album.coverArt} alt="" size={400} />
                <span className="album-name">{album.name}</span>
                <span className="album-artist">{album.year}</span>
              </button>
            </article>
          ))}
        </div>
      </section>
      {songs.length ? (
        <section className="block">
          <h3>Titel</h3>
          <TrackList songs={songs} showCover playAllLabel="Alle Titel spielen" />
        </section>
      ) : null}
    </div>
  )
}
