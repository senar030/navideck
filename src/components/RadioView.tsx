import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { SubsonicError } from '../api/client'
import type { RadioStation } from '../api/types'
import { followedSource, hostOf, radioSong, radioSubtitle, type RadioSource } from '../lib/radio'
import {
  lookupRadioLogo,
  RADIO_PAGE,
  reportRadioClick,
  searchRadioStations,
  type RadioHit,
} from '../lib/radioBrowser'
import { readRadioLogos, rememberRadioLogo } from '../lib/radioLogos'
import { useAuth } from '../state/AuthContext'
import { usePlayer } from '../state/PlayerContext'
import { usePrefs } from '../state/PrefsContext'
import { CoverArt } from './CoverArt'
import { IconCheck, IconClose, IconExternal, IconPlay, IconPlus, IconSearch } from './Icons'
import { LayoutToggle } from './LayoutToggle'
import { MarqueeText } from './MarqueeText'
import { SortMenu } from './SortMenu'

/** How long the search waits for the next keystroke before asking the server. */
const SEARCH_DELAY_MS = 400

type RadioSort = 'popular' | 'name' | 'bitrate' | 'country'

const RADIO_SORTS: { id: RadioSort; label: string; defaultDesc?: boolean }[] = [
  { id: 'popular', label: 'Beliebt', defaultDesc: true },
  { id: 'name', label: 'Name' },
  { id: 'bitrate', label: 'Bitrate', defaultDesc: true },
  { id: 'country', label: 'Land' },
]

function textCompare(a: string, b: string): number {
  return a.localeCompare(b, 'de', { sensitivity: 'base', numeric: true })
}

function ordered(value: number, desc: boolean): number {
  return desc ? -value : value
}

function sortRadio<T>(
  list: T[],
  sort: RadioSort,
  desc: boolean,
  info: (item: T) => { name: string; country?: string; bitrate?: number; votes?: number },
): T[] {
  const copy = [...list]
  copy.sort((a, b) => {
    const left = info(a)
    const right = info(b)
    if (sort === 'popular') {
      return ordered((left.votes ?? 0) - (right.votes ?? 0), desc) || textCompare(left.name, right.name)
    }
    if (sort === 'bitrate') {
      return ordered((left.bitrate ?? 0) - (right.bitrate ?? 0), desc) || textCompare(left.name, right.name)
    }
    if (sort === 'country') {
      return ordered(textCompare(left.country ?? '', right.country ?? ''), desc) ||
        textCompare(left.name, right.name)
    }
    return ordered(textCompare(left.name, right.name), desc)
  })
  return copy
}

export function RadioView() {
  const { client } = useAuth()
  const { playTracks } = usePlayer()

  const [stations, setStations] = useState<RadioStation[]>([])
  const [stationsLoaded, setStationsLoaded] = useState(false)
  const [stationsError, setStationsError] = useState('')
  /*
   * Nothing to show and nothing has failed yet means the first list is still on
   * its way. Derived rather than flagged, so the render that starts the request
   * already knows it is loading.
   */
  const stationsBusy = !stationsLoaded && !stationsError
  const [admin, setAdmin] = useState<boolean | null>(null)
  const [logos, setLogos] = useState(readRadioLogos)
  /** Streams the directory was already asked about, so a reload does not ask twice. */
  const askedForLogo = useRef(new Set<string>())

  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<RadioHit[]>([])
  /** The query the hits on screen answer; `null` until the first answer is in. */
  const [hitsQuery, setHitsQuery] = useState<string | null>(null)
  const [hitsMoreBusy, setHitsMoreBusy] = useState(false)
  const [hitsError, setHitsError] = useState('')
  const [hitsMore, setHitsMore] = useState(false)
  /* Still busy while the hits belong to an earlier query, or while "mehr" loads. */
  const hitsBusy = hitsMoreBusy || hitsQuery !== query.trim()

  const [busyId, setBusyId] = useState('')
  const [confirmId, setConfirmId] = useState('')
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')
  const { layout } = usePrefs()
  const [sort, setSort] = useState<RadioSort>('popular')
  const [desc, setDesc] = useState(true)
  const grid = layout.radio === 'grid'

  const sortedStations = useMemo(
    () =>
      sortRadio(stations, sort, desc, (station) => ({
        name: station.name,
        country: hostOf(station.streamUrl),
        votes: 0,
        bitrate: 0,
      })),
    [desc, sort, stations],
  )
  const sortedHits = useMemo(
    () =>
      sortRadio(hits, sort, desc, (hit) => ({
        name: hit.name,
        country: hit.country,
        votes: hit.votes,
        bitrate: hit.bitrate,
      })),
    [desc, hits, sort],
  )

  const loadStations = useCallback(() => {
    if (!client) return
    return client
      .getRadioStations(true)
      .then((list) => {
        setStations(list)
        setStationsError('')
      })
      .catch((err: unknown) => {
        setStationsError(
          `${describe(err)} Sender folgen braucht einen Server mit Radio-Schnittstelle.`,
        )
      })
      .finally(() => setStationsLoaded(true))
  }, [client])

  useEffect(() => {
    void loadStations()
  }, [loadStations])

  /*
   * A station's logo is not part of what Navidrome stores, so the list a second
   * device loads has no logos in it: the only device that ever saw them is the
   * one the stations were followed on. Those devices look the missing ones up in
   * the directory again and keep them in the same cache.
   */
  useEffect(() => {
    const known = readRadioLogos()
    const missing = stations.filter(
      (station) => !station.coverArt && !known[station.streamUrl] && !askedForLogo.current.has(station.streamUrl),
    )
    if (!missing.length) return
    for (const station of missing) askedForLogo.current.add(station.streamUrl)
    void Promise.all(missing.map((station) => lookupRadioLogo(station.name, station.streamUrl))).then((found) => {
      found.forEach((logo, index) => rememberRadioLogo(missing[index].streamUrl, logo))
      setLogos(readRadioLogos())
    })
  }, [stations])

  useEffect(() => {
    if (!client) return
    let cancelled = false
    void client.getMe().then((user) => {
      if (!cancelled) setAdmin(user?.adminRole ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [client])

  /*
   * Every keystroke starts a new search; the timer replaces the pending one, and
   * a response that arrives after the query moved on is dropped. An empty query
   * asks for the directory's most played stations instead, without waiting.
   */
  useEffect(() => {
    let cancelled = false
    const term = query.trim()
    const timer = window.setTimeout(
      () => {
        void searchRadioStations({ term })
          .then((found) => {
            if (cancelled) return
            setHits(found)
            setHitsError('')
            setHitsMore(found.length === RADIO_PAGE)
            setHitsQuery(term)
          })
          .catch((err: unknown) => {
            if (cancelled) return
            setHits([])
            setHitsMore(false)
            setHitsError(describe(err))
            setHitsQuery(term)
          })
      },
      term ? SEARCH_DELAY_MS : 0,
    )
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query])

  const followedUrls = new Set(stations.map((station) => station.streamUrl))

  function play(source: RadioSource) {
    playTracks([radioSong(source)], 0)
  }

  function playStation(station: RadioStation) {
    play(followedSource(station, logos, (coverArt, size) => client?.coverUrl(coverArt, size)))
  }

  function playHit(hit: RadioHit) {
    reportRadioClick(hit.uuid)
    play({
      key: hit.uuid,
      name: hit.name,
      url: hit.url,
      subtitle: radioSubtitle([hit.country, bitrateLabel(hit)]),
      logo: hit.logo,
      homepage: hit.homepage,
    })
  }

  async function follow(hit: RadioHit) {
    if (!client || busyId) return
    setBusyId(hit.uuid)
    setActionError('')
    setNotice('')
    try {
      await client.createRadioStation({
        name: hit.name,
        streamUrl: hit.url,
        homePageUrl: hit.homepage,
      })
      rememberRadioLogo(hit.url, hit.logo)
      setLogos(readRadioLogos())
      await loadStations()
      setNotice(`„${hit.name}" steht jetzt auf dem Musik-Server — auch für deine anderen Subsonic-Apps.`)
    } catch (err) {
      setActionError(describe(err))
    } finally {
      setBusyId('')
    }
  }

  async function remove(station: RadioStation) {
    if (!client || busyId) return
    setBusyId(station.id)
    setActionError('')
    setNotice('')
    try {
      await client.deleteRadioStation(station.id)
      await loadStations()
      setNotice(`„${station.name}" wurde vom Server entfernt.`)
    } catch (err) {
      setActionError(describe(err))
    } finally {
      setBusyId('')
      setConfirmId('')
    }
  }

  async function loadMoreHits() {
    if (hitsBusy) return
    setHitsMoreBusy(true)
    try {
      const found = await searchRadioStations({ term: query, offset: hits.length })
      setHits((previous) => {
        const seen = new Set(previous.map((hit) => hit.uuid))
        return [...previous, ...found.filter((hit) => !seen.has(hit.uuid))]
      })
      setHitsMore(found.length === RADIO_PAGE)
      setHitsError('')
    } catch (err) {
      setHitsError(describe(err))
      setHitsMore(false)
    } finally {
      setHitsMoreBusy(false)
    }
  }

  const canFollow = admin !== false

  return (
    <div className="view radio-view">
      <header className="view-head">
        <h2>Radio</h2>
        <div className="view-head-tools">
          <SortMenu
            options={RADIO_SORTS}
            value={sort}
            desc={desc}
            onChange={(next, nextDesc) => {
              setSort(next)
              setDesc(nextDesc)
            }}
          />
          <LayoutToggle section="radio" />
        </div>
      </header>
      <p className="muted radio-lead">
        Internetradio läuft direkt aus dem Netz, nicht aus deiner Bibliothek. Gefolgte Sender werden auf dem
        Musik-Server gespeichert und stehen dort auch jedem anderen Client zur Verfügung.
      </p>
      {notice ? <p className="radio-notice">{notice}</p> : null}
      {actionError ? <p className="error">{actionError}</p> : null}

      <section className="block">
        <h3>Gefolgt</h3>
        {stationsError ? <p className="error">{stationsError}</p> : null}
        <div className={grid ? 'album-grid radio-tiles' : 'radio-list'}>
          {sortedStations.map((station) => (
            <StationCard
              key={station.id}
              grid={grid}
              coverArt={station.coverArt}
              logo={logos[station.streamUrl]}
              name={station.name}
              subtitle={hostOf(station.streamUrl)}
              onPlay={() => playStation(station)}
              actions={
                <>
                  {station.homePageUrl ? (
                    <a
                      className="icon-btn radio-action"
                      href={station.homePageUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      aria-label={`Webseite von ${station.name}`}
                      data-tip="Webseite"
                    >
                      <IconExternal size={18} />
                    </a>
                  ) : (
                    /* Holds the column, so the play button stays where it is on
                       rows whose station has no website. */
                    <span className="radio-action radio-action-empty" aria-hidden />
                  )}
                  {canFollow ? (
                    confirmId === station.id ? (
                      <button
                        type="button"
                        className="text-btn radio-confirm"
                        disabled={busyId === station.id}
                        onClick={() => void remove(station)}
                      >
                        {busyId === station.id ? 'Wird entfernt…' : 'Wirklich entfernen?'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="icon-btn radio-action"
                        aria-label={`${station.name} entfernen`}
                        data-tip="Vom Server entfernen"
                        onClick={() => setConfirmId(station.id)}
                      >
                        <IconClose size={18} />
                      </button>
                    )
                  ) : null}
                </>
              }
            />
          ))}
        </div>
        {stationsBusy && !stations.length && !stationsError ? <p className="muted">Sender werden geladen…</p> : null}
        {!stationsBusy && !stations.length && !stationsError ? (
          <p className="muted">Noch kein Sender gefolgt. Such unten einen aus und tippe auf „Folgen".</p>
        ) : null}
      </section>

      <section className="block">
        <h3>{query.trim() ? 'Suchergebnisse' : 'Beliebte Sender'}</h3>
        <label className="radio-search">
          <IconSearch />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Sender, Land oder Genre suchen"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
          />
          {query ? (
            <button type="button" className="icon-btn" aria-label="Suche leeren" onClick={() => setQuery('')}>
              <IconClose size={18} />
            </button>
          ) : null}
        </label>
        {hitsError ? <p className="error">{hitsError}</p> : null}
        <div className={grid ? 'album-grid radio-tiles' : 'radio-list'}>
          {sortedHits.map((hit) => (
            <StationCard
              key={hit.uuid}
              grid={grid}
              logo={hit.logo}
              name={hit.name}
              subtitle={radioSubtitle([hit.country, bitrateLabel(hit), hit.tags.slice(0, 2).join(', ')])}
              onPlay={() => playHit(hit)}
              actions={
                canFollow ? (
                  followedUrls.has(hit.url) ? (
                    <span className="icon-btn radio-followed" aria-label="Schon gefolgt" data-tip="Schon gefolgt">
                      <IconCheck size={18} />
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="icon-btn radio-action"
                      aria-label={`${hit.name} folgen`}
                      data-tip="Auf dem Server folgen"
                      disabled={busyId === hit.uuid}
                      onClick={() => void follow(hit)}
                    >
                      <IconPlus size={18} />
                    </button>
                  )
                ) : null
              }
            />
          ))}
        </div>
        {hitsBusy && !hits.length && !hitsError ? <p className="muted">Sender werden gesucht…</p> : null}
        {!hitsBusy && !hits.length && !hitsError ? <p className="muted">Keine Sender gefunden.</p> : null}
        {hitsMore ? (
          <button type="button" className="primary-btn ghost" disabled={hitsBusy} onClick={() => void loadMoreHits()}>
            {hitsBusy ? 'Wird geladen…' : 'Mehr laden'}
          </button>
        ) : null}
        <p className="muted radio-credit">
          Sendersuche über radio-browser.info · es werden nur HTTPS-Ströme angeboten
          {admin === false ? ' · Sender folgen kann nur ein Server-Admin' : ''}
        </p>
      </section>
    </div>
  )
}

function StationCard({
  grid = false,
  coverArt,
  logo,
  name,
  subtitle,
  onPlay,
  actions,
}: {
  grid?: boolean
  coverArt?: string
  logo?: string
  name: string
  subtitle?: string
  onPlay: () => void
  actions?: ReactNode
}) {
  if (grid) {
    return (
      <article className="album-card radio-tile">
        <button type="button" className="album-hit" onClick={onPlay} aria-label={`${name} abspielen`}>
          <CoverArt coverArt={coverArt} src={coverArt ? undefined : logo} alt="" size={400} />
          <MarqueeText className="album-name">{name}</MarqueeText>
          {subtitle ? <MarqueeText className="album-artist">{subtitle}</MarqueeText> : null}
        </button>
        <button type="button" className="play-fab" aria-label={`${name} abspielen`} data-tip="Abspielen" onClick={onPlay}>
          <IconPlay size={22} />
        </button>
        {actions ? <div className="radio-tile-actions">{actions}</div> : null}
      </article>
    )
  }

  return (
    <article className="radio-card">
      <button type="button" className="radio-hit" onClick={onPlay} aria-label={`${name} abspielen`}>
        {/* A logo stored on the server wins over the one the directory told us. */}
        <CoverArt coverArt={coverArt} src={coverArt ? undefined : logo} alt="" size={120} className="radio-art" />
        <span className="radio-text">
          <MarqueeText className="radio-name">{name}</MarqueeText>
          {subtitle ? <MarqueeText className="radio-sub">{subtitle}</MarqueeText> : null}
        </span>
        <span className="radio-start" aria-hidden>
          <IconPlay size={16} />
        </span>
      </button>
      {actions}
    </article>
  )
}

/** A station that says nothing about its quality gets no label at all. */
function bitrateLabel(hit: RadioHit): string | undefined {
  if (!hit.bitrate) return hit.codec
  return hit.codec ? `${hit.bitrate} kbps ${hit.codec}` : `${hit.bitrate} kbps`
}

/** Turns a refused request into something the reader can act on. */
function describe(err: unknown): string {
  if (err instanceof SubsonicError) {
    if (err.code === 50) return 'Nur ein Admin des Musik-Servers darf Sender hinzufügen oder entfernen.'
    return err.message
  }
  return err instanceof Error ? err.message : 'Unerwarteter Fehler.'
}
