import { useEffect, useState, type ReactNode } from 'react'
import { useAccount } from '../state/AccountContext'
import { spaceOf, useNav } from '../state/NavContext'
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
  IconLogo,
  IconPlus,
  IconPodcast,
  IconRadio,
  IconStar,
  IconUser,
} from './Icons'
import { NowPlaying } from './NowPlaying'
import { PlayerBar } from './PlayerBar'
import { PodcastAdd, PodcastHome, PodcastsView, EpisodesView } from './PodcastViews'
import { PodcastDetail } from './PodcastDetail'
import { SectionPage } from './SectionPage'
import { PlaylistDetail, PlaylistList } from './PlaylistViews'
import { QueuePanel } from './QueuePanel'
import { RadioView } from './RadioView'
import { AccountView } from './AccountView'
import { SettingsSheet } from './SettingsSheet'
import { StarredView } from './StarredView'
import { StartHub } from './StartHub'
import { ViewBoundary } from './ViewBoundary'

export function Shell() {
  const { view, go } = useNav()
  const { abs } = useAccount()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const space = spaceOf(view)

  useEffect(() => {
    if (view.name === 'search') go({ name: 'home' })
  }, [view.name, go])

  /* A known empty library hides its area; an unknown one still offers it. */
  const showBooks = Boolean(abs && (abs.books || !abs.libraries.length))
  const showPodcasts = Boolean(abs && (abs.podcasts || !abs.libraries.length))

  return (
    <div className="app">
      <nav className="nav" aria-label="Hauptnavigation">
        <div className="brand">
          <IconLogo size={30} />
          <span className="brand-name">Navideck</span>
        </div>

        {space === 'music' ? (
          <>
            <NavBtn active={view.name === 'home'} onClick={() => go({ name: 'home' })} icon={<IconHome />} label="Start" />
            <NavBtn active={view.name === 'albums'} onClick={() => go({ name: 'albums' })} icon={<IconAlbums />} label="Alben" />
            <NavBtn active={view.name === 'artists'} onClick={() => go({ name: 'artists' })} icon={<IconArtists />} label="Künstler" />
            <NavBtn active={view.name === 'genres' || view.name === 'genre'} onClick={() => go({ name: 'genres' })} icon={<IconGenres />} label="Genres" />
            <NavBtn active={view.name === 'radio'} onClick={() => go({ name: 'radio' })} icon={<IconRadio />} label="Radio" />
            <NavBtn active={view.name === 'playlists'} onClick={() => go({ name: 'playlists' })} icon={<IconLists />} label="Playlists" />
            <NavBtn active={view.name === 'starred'} onClick={() => go({ name: 'starred' })} icon={<IconStar />} label="Favoriten" />
          </>
        ) : null}

        {space === 'audiobooks' ? (
          <>
            <NavBtn active={view.name === 'ab-home'} onClick={() => go({ name: 'ab-home' })} icon={<IconHome />} label="Start" />
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

        {space === 'podcasts' ? (
          <>
            <NavBtn active={view.name === 'pod-home'} onClick={() => go({ name: 'pod-home' })} icon={<IconHome />} label="Start" />
            <NavBtn active={view.name === 'podcasts' || view.name === 'podcast'} onClick={() => go({ name: 'podcasts' })} icon={<IconPodcast />} label="Podcasts" />
            <NavBtn active={view.name === 'pod-episodes'} onClick={() => go({ name: 'pod-episodes' })} icon={<IconLists />} label="Episoden" />
            <NavBtn active={view.name === 'pod-add'} onClick={() => go({ name: 'pod-add' })} icon={<IconPlus />} label="Hinzufügen" />
          </>
        ) : null}

        {space === 'start' || space === 'account' ? (
          <>
            <NavBtn active={view.name === 'start'} onClick={() => go({ name: 'start' })} icon={<IconHome />} label="Start" />
            {showBooks ? (
              <NavBtn active={false} onClick={() => go({ name: 'ab-home' })} icon={<IconBook />} label="Hörbücher" />
            ) : null}
            {showPodcasts ? (
              <NavBtn active={false} onClick={() => go({ name: 'pod-home' })} icon={<IconPodcast />} label="Podcasts" />
            ) : null}
            <NavBtn active={view.name === 'account'} onClick={() => go({ name: 'account' })} icon={<IconUser />} label="Konto" />
          </>
        ) : null}

        <div className="nav-spacer" />
      </nav>

      <main className="main">
        <AppChrome onOpenSettings={() => setSettingsOpen(true)} scrolled={scrolled} />
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
            {view.name === 'account' ? <AccountView /> : null}
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
      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
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
