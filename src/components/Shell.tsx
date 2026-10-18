import { useEffect, useState, type ReactNode } from 'react'
import { useNav } from '../state/NavContext'
import { AlbumDetail } from './AlbumDetail'
import { AlbumGrid } from './AlbumGrid'
import { AppChrome } from './AppChrome'
import { ArtistDetail, ArtistList } from './ArtistViews'
import { GenreDetail, GenreList } from './GenreViews'
import { HomeDashboard } from './HomeDashboard'
import { IconAlbums, IconArtists, IconGenres, IconHome, IconLists, IconLogo, IconRadio, IconStar } from './Icons'
import { NowPlaying } from './NowPlaying'
import { PlayerBar } from './PlayerBar'
import { SectionPage } from './SectionPage'
import { PlaylistDetail, PlaylistList } from './PlaylistViews'
import { QueuePanel } from './QueuePanel'
import { RadioView } from './RadioView'
import { SettingsSheet } from './SettingsSheet'
import { StarredView } from './StarredView'

export function Shell() {
  const { view, go } = useNav()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    if (view.name === 'search') go({ name: 'home' })
  }, [view.name, go])

  return (
    <div className="app">
      <nav className="nav" aria-label="Hauptnavigation">
        <div className="brand">
          <IconLogo size={30} />
          <span className="brand-name">Navideck</span>
        </div>
        <NavBtn active={view.name === 'home'} onClick={() => go({ name: 'home' })} icon={<IconHome />} label="Start" />
        <NavBtn active={view.name === 'albums'} onClick={() => go({ name: 'albums' })} icon={<IconAlbums />} label="Alben" />
        <NavBtn active={view.name === 'artists'} onClick={() => go({ name: 'artists' })} icon={<IconArtists />} label="Künstler" />
        <NavBtn active={view.name === 'genres' || view.name === 'genre'} onClick={() => go({ name: 'genres' })} icon={<IconGenres />} label="Genres" />
        <NavBtn active={view.name === 'radio'} onClick={() => go({ name: 'radio' })} icon={<IconRadio />} label="Radio" />
        <NavBtn
          active={view.name === 'playlists'}
          onClick={() => go({ name: 'playlists' })}
          icon={<IconLists />}
          label="Playlists"
        />
        <NavBtn active={view.name === 'starred'} onClick={() => go({ name: 'starred' })} icon={<IconStar />} label="Favoriten" />
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
