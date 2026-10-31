import { useEffect, useMemo, useRef, useState } from 'react'
import type { Artist, ArtistIndex, ArtistInfo, Song } from '../api/types'
import { stripHtml } from '../lib/format'
import { useAuth } from '../state/AuthContext'
import { useNav } from '../state/NavContext'
import { usePlayer } from '../state/PlayerContext'
import { CoverArt } from './CoverArt'
import { usePrefs } from '../state/PrefsContext'
import { IconStar } from './Icons'
import { LayoutToggle } from './LayoutToggle'
import { PlayGlyph } from './PlayGlyph'
import { MarqueeText } from './MarqueeText'
import { TrackList } from './TrackList'

export function ArtistList() {
  const { client, selectedFolderIds } = useAuth()
  const { go } = useNav()
  const { layout } = usePrefs()
  const [indexes, setIndexes] = useState<ArtistIndex[]>([])
  const [error, setError] = useState('')
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!client) return
    void client
      .getArtists()
      .then(setIndexes)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Künstler konnten nicht geladen werden'))
  }, [client, selectedFolderIds])

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
        <h2>Künstler</h2>
        <LayoutToggle section="artists" />
      </header>
      {error ? <p className="error">{error}</p> : null}
      <div className="artist-layout">
        <div className="artist-scroll" ref={scroller}>
          {indexes.map((group) => (
            <section key={group.name} data-letter={group.name}>
              <h3 className="letter">{group.name}</h3>
              <div className={`artist-list ${layout.artists === 'grid' ? 'is-grid' : ''}`}>
                {(group.artist ?? []).map((artist) => (
                  <button
                    key={artist.id}
                    type="button"
                    className="artist-row"
                    onClick={() => go({ name: 'artist', id: artist.id })}
                  >
                    <CoverArt coverArt={artist.coverArt} alt="" size={120} className="avatar" />
                    <span>
                      <MarqueeText className="artist-name">{artist.name}</MarqueeText>
                      <MarqueeText className="artist-count">
                        {artist.albumCount ?? 0} {(artist.albumCount ?? 0) === 1 ? 'Album' : 'Alben'}
                      </MarqueeText>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
        <div className="az" aria-label="Zum Buchstaben springen">
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
  const { layout } = usePrefs()
  const { playTracks } = usePlayer()
  const [artist, setArtist] = useState<Artist | null>(null)
  const [info, setInfo] = useState<ArtistInfo>({})
  const [songs, setSongs] = useState<Song[]>([])
  const [error, setError] = useState('')
  const [starred, setStarred] = useState(false)

  useEffect(() => {
    if (!client) return
    void client
      .getArtist(id)
      .then(async (next) => {
        setArtist(next)
        setStarred(Boolean(next.starred))
        const albums = await Promise.all((next.album ?? []).map((a) => client.getAlbum(a.id)))
        setSongs(albums.flatMap((a) => a.song ?? []))
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Künstler konnte nicht geladen werden'))
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

  const bg = client?.coverUrl(artist.coverArt, 80)

  return (
    <div className="view detail">
      <div className="hero-banner">
        {bg ? <img className="hero-bg" src={bg} alt="" /> : null}
        <div className="hero-veil" />
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
              <PlayGlyph size={22} /> Alles spielen
            </button>
            <button
              type="button"
              className={`icon-btn ${starred ? 'is-on' : ''}`}
              aria-label={starred ? 'Favorit entfernen' : 'Als Favorit merken'}
              data-tip={starred ? 'Favorit entfernen' : 'Als Favorit merken'}
              onClick={() => {
                if (!client) return
                const next = !starred
                setStarred(next)
                void (next ? client.star(artist.id, 'artistId') : client.unstar(artist.id, 'artistId'))
              }}
            >
              <IconStar filled={starred} />
            </button>
          </div>
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
          <div className="artist-heads">
            {info.similarArtist.map((a) => (
              <button key={a.id} type="button" className="artist-head" onClick={() => go({ name: 'artist', id: a.id })}>
                <CoverArt coverArt={a.coverArt} alt="" size={120} className="avatar" />
                <MarqueeText>{a.name}</MarqueeText>
              </button>
            ))}
          </div>
        </section>
      ) : null}
      <section className="block">
        <h3>Alben</h3>
        <div className={`album-grid ${layout.albums === 'list' ? 'is-list' : ''}`}>
          {(artist.album ?? []).map((album) => (
            <article key={album.id} className="album-card">
              <button type="button" className="album-hit" onClick={() => go({ name: 'album', id: album.id })}>
                <CoverArt coverArt={album.coverArt} alt="" size={400} />
                <MarqueeText className="album-name">{album.name}</MarqueeText>
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
