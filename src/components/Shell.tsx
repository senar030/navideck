import { useEffect, useLayoutEffect, useState, type ReactNode } from 'react'
import { useAccount } from '../state/AccountContext'
import { spaceOf, useNav } from '../state/NavContext'
import { usePlayer } from '../state/PlayerContext'
import { AlbumDetail } from './AlbumDetail'
import { AlbumGrid } from './AlbumGrid'
import { AppChrome } from './AppChrome'
import { ArtistDetail, ArtistList } from './ArtistViews'
import {
  AudiobookHome,
  AuthorsView,
  BooksView,
  CollectionsView,
} from './AudiobookViews'
import {
  AuthorDetail,
  BookDetail,
  CollectionDetail,
  SeriesDetail,
} from './AudiobookDetail'
import { GenreDetail, GenreList } from './GenreViews'
import { HomeDashboard } from './HomeDashboard'
import {
  IconAlbums,
  IconArtists,
  IconBook,
  IconGenres,
  IconHome,
  IconLists,
  IconPlus,
  IconPodcast,
  IconRadio,
  IconStar,
} from './Icons'
import { NowPlaying } from './NowPlaying'
import { PlayerBar } from './PlayerBar'
import { PodcastAdd, PodcastHome, PodcastsView, EpisodesView } from './PodcastViews'
import { PodcastDetail } from './PodcastDetail'
import { SectionPage } from './SectionPage'
import { PlaylistDetail, PlaylistList } from './PlaylistViews'
import { QueuePanel } from './QueuePanel'
import { RadioView } from './RadioView'
import { SettingsView } from './SettingsView'
import { StarredView } from './StarredView'
import { StartHub } from './StartHub'
import { SpaceSwitcher } from './SpaceSwitcher'
import { ViewBoundary } from './ViewBoundary'

export function Shell() {
  const { view, parent, go } = useNav()
  const { abs, music, podcasts } = useAccount()
  const { queue } = usePlayer()
  const [scrolled, setScrolled] = useState(false)
  const space = spaceOf(view)

  /*
   * Settings is a page of its own, but the navigation belongs to the area you
   * came from: switching the rail to the start area while a detail page is
   * still underneath would look like a jump.
   */
  const navSpace = view.name === 'settings' && parent ? spaceOf(parent) : space

  useEffect(() => {
    if (view.name === 'search') go({ name: 'home' })
  }, [view.name, go])

  /* A known empty library hides its area; an unknown one still offers it. */
  const showBooks = Boolean(abs && (abs.books || !abs.libraries.length))
  const showPodcasts = Boolean(podcasts)

  /*
   * Where the way-in button belongs follows the shape of the navigation, and
   * that shape is decided in CSS (a rail on the left, a bar below on narrow
   * screens and on the deck). CSS cannot ask for a flex direction, so record
   * it; both buttons are rendered and exactly one is shown.
   */
  useLayoutEffect(() => {
    const nav = document.querySelector('.nav')
    if (!nav) return
    const apply = () => {
      const bar = getComputedStyle(nav).flexDirection === 'row'
      document.documentElement.dataset.nav = bar ? 'bar' : 'rail'
    }
    apply()
    const observer = new ResizeObserver(apply)
    observer.observe(nav)
    window.addEventListener('resize', apply)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', apply)
    }
  }, [])

  return (
    <div className={`app ${queue.length ? 'has-player' : ''}`}>
      <nav className="nav" aria-label="Hauptnavigation">
        <div className="nav-brand">
          <SpaceSwitcher />
        </div>

        {navSpace === 'music' ? (
          <>
            <NavBtn active={view.name === 'home'} onClick={() => go({ name: 'home' })} icon={<IconHome />} label="Musik" />
            <NavBtn active={view.name === 'albums'} onClick={() => go({ name: 'albums' })} icon={<IconAlbums />} label="Alben" />
            <NavBtn active={view.name === 'artists'} onClick={() => go({ name: 'artists' })} icon={<IconArtists />} label="Künstler" />
            <NavBtn active={view.name === 'genres' || view.name === 'genre'} onClick={() => go({ name: 'genres' })} icon={<IconGenres />} label="Genres" />
            <NavBtn active={view.name === 'radio'} onClick={() => go({ name: 'radio' })} icon={<IconRadio />} label="Radio" />
            <NavBtn active={view.name === 'playlists'} onClick={() => go({ name: 'playlists' })} icon={<IconLists />} label="Playlists" />
            <NavBtn active={view.name === 'starred'} onClick={() => go({ name: 'starred' })} icon={<IconStar />} label="Favoriten" />
          </>
        ) : null}

        {navSpace === 'audiobooks' ? (
          <>
            <NavBtn active={view.name === 'ab-home'} onClick={() => go({ name: 'ab-home' })} icon={<IconHome />} label="Hörbücher" />
            <NavBtn active={view.name === 'abs-books' || view.name === 'abs-book'} onClick={() => go({ name: 'abs-books' })} icon={<IconBook />} label="Bücher" />
            <NavBtn active={view.name === 'abs-authors' || view.name === 'abs-author'} onClick={() => go({ name: 'abs-authors' })} icon={<IconArtists />} label="Autoren" />
            <NavBtn
              active={view.name === 'abs-collections' || view.name === 'abs-collection' || view.name === 'abs-series'}
              onClick={() => go({ name: 'abs-collections' })}
              icon={<IconLists />}
              label="Sammlungen"
            />
          </>
        ) : null}

        {navSpace === 'podcasts' ? (
          <>
            <NavBtn active={view.name === 'pod-home'} onClick={() => go({ name: 'pod-home' })} icon={<IconHome />} label="Podcasts" />
            <NavBtn active={view.name === 'podcasts' || view.name === 'podcast'} onClick={() => go({ name: 'podcasts' })} icon={<IconPodcast />} label="Sendungen" />
            <NavBtn active={view.name === 'pod-episodes'} onClick={() => go({ name: 'pod-episodes' })} icon={<IconLists />} label="Episoden" />
            {podcasts?.kind === 'audiobookshelf' ? (
              <NavBtn active={view.name === 'pod-add'} onClick={() => go({ name: 'pod-add' })} icon={<IconPlus />} label="Hinzufügen" />
            ) : null}
          </>
        ) : null}

        {navSpace === 'start' ? (
          <>
            <NavBtn active={view.name === 'start'} onClick={() => go({ name: 'start' })} icon={<IconHome />} label="Start" />
            {music ? (
              <NavBtn active={false} onClick={() => go({ name: 'home' })} icon={<IconAlbums />} label="Musik" />
            ) : null}
            {showBooks ? (
              <NavBtn active={false} onClick={() => go({ name: 'ab-home' })} icon={<IconBook />} label="Hörbücher" />
            ) : null}
            {showPodcasts ? (
              <NavBtn active={false} onClick={() => go({ name: 'pod-home' })} icon={<IconPodcast />} label="Podcasts" />
            ) : null}
          </>
        ) : null}

        <div className="nav-spacer" />
      </nav>

      <main className="main">
        <AppChrome scrolled={scrolled} />
        <div
          className="main-body"
          onScroll={(e) => {
            // A dead zone between the two thresholds: without it a finger
            // resting near the top would flip the bar back and forth, and every
            // flip re-renders the whole view.
            const top = e.currentTarget.scrollTop
            setScrolled((prev) => (top > 24 ? true : top < 8 ? false : prev))
          }}
        >
          <ViewBoundary resetKey={'id' in view ? `${view.name}:${view.id}` : view.name}>
            {view.name === 'start' ? <StartHub /> : null}
            {view.name === 'settings' ? <SettingsView /> : null}
            {view.name === 'home' || view.name === 'search' ? <HomeDashboard /> : null}
            {view.name === 'albums' ? <AlbumGrid /> : null}
            {view.name === 'artists' ? <ArtistList /> : null}
            {view.name === 'playlists' ? <PlaylistList /> : null}
            {view.name === 'starred' ? <StarredView /> : null}
            {view.name === 'genres' ? <GenreList /> : null}
            {view.name === 'radio' ? <RadioView /> : null}
            {view.name === 'album' ? <AlbumDetail id={view.id} /> : null}
            {view.name === 'artist' ? <ArtistDetail id={view.id} /> : null}
            {view.name === 'playlist' ? <PlaylistDetail id={view.id} /> : null}
            {view.name === 'genre' ? <GenreDetail name={view.id} /> : null}
            {view.name === 'section' ? <SectionPage id={view.id} /> : null}
  
            {view.name === 'ab-home' ? <AudiobookHome /> : null}
            {view.name === 'abs-books' ? <BooksView /> : null}
            {view.name === 'abs-authors' ? <AuthorsView /> : null}
            {view.name === 'abs-collections' ? <CollectionsView /> : null}
            {view.name === 'abs-book' ? <BookDetail id={view.id} /> : null}
            {view.name === 'abs-author' ? <AuthorDetail id={view.id} /> : null}
            {view.name === 'abs-collection' ? <CollectionDetail id={view.id} /> : null}
            {view.name === 'abs-series' ? <SeriesDetail id={view.id} /> : null}
  
            {view.name === 'pod-home' ? <PodcastHome /> : null}
            {view.name === 'podcasts' ? <PodcastsView /> : null}
            {view.name === 'pod-episodes' ? <EpisodesView /> : null}
            {view.name === 'pod-add' ? <PodcastAdd /> : null}
            {view.name === 'podcast' ? <PodcastDetail id={view.id} /> : null}
          </ViewBoundary>
        </div>
      </main>

      <PlayerBar />
      <QueuePanel />
      <NowPlaying />
    </div>
  )
}

function NavBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: ReactNode
  label: string
}) {
  return (
    <button type="button" className={`nav-btn ${active ? 'is-on' : ''}`} onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  )
}
