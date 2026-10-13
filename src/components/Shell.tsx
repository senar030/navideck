import { useState, type ReactNode } from 'react'
import { useAuth } from '../state/AuthContext'
import { useNav } from '../state/NavContext'
import { useTheme } from '../state/ThemeContext'
import { AlbumDetail } from './AlbumDetail'
import { AlbumGrid } from './AlbumGrid'
import { ArtistDetail, ArtistList } from './ArtistViews'
import { GenreDetail, GenreList } from './GenreViews'
import { HomeDashboard } from './HomeDashboard'
import {
  IconAlbums,
  IconArtists,
  IconBack,
  IconGenres,
  IconHome,
  IconLists,
  IconMoon,
  IconSearch,
  IconSettings,
  IconStar,
  IconSun,
} from './Icons'
import { NowPlaying } from './NowPlaying'
import { PlayerBar } from './PlayerBar'
import { PlaylistDetail, PlaylistList } from './PlaylistViews'
import { QueuePanel } from './QueuePanel'
import { SearchView } from './SearchView'
import { SettingsSheet } from './SettingsSheet'
import { StarredView } from './StarredView'

export function Shell() {
  const { client } = useAuth()
  const { view, go, back, canBack } = useNav()
  const { theme, toggleTheme } = useTheme()
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <div className="app">
      <nav className="nav">
        <div className="brand">
          <span className="logo-dot" />
          Navideck
        </div>
        <NavBtn active={view.name === 'home'} onClick={() => go({ name: 'home' })} icon={<IconHome />} label="Start" />
        <NavBtn active={view.name === 'albums'} onClick={() => go({ name: 'albums' })} icon={<IconAlbums />} label="Alben" />
        <NavBtn active={view.name === 'artists'} onClick={() => go({ name: 'artists' })} icon={<IconArtists />} label="Künstler" />
        <NavBtn active={view.name === 'genres' || view.name === 'genre'} onClick={() => go({ name: 'genres' })} icon={<IconGenres />} label="Genres" />
        <NavBtn
          active={view.name === 'playlists'}
          onClick={() => go({ name: 'playlists' })}
          icon={<IconLists />}
          label="Playlists"
        />
        <NavBtn active={view.name === 'starred'} onClick={() => go({ name: 'starred' })} icon={<IconStar />} label="Favoriten" />
        <NavBtn active={view.name === 'search'} onClick={() => go({ name: 'search' })} icon={<IconSearch />} label="Suche" />
        <div className="nav-spacer" />
        <p className="nav-user">{client?.username}</p>
        <NavBtn active={settingsOpen} onClick={() => setSettingsOpen(true)} icon={<IconSettings />} label="Einstell." />
        <button
          type="button"
          className="nav-btn theme-toggle"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Hellmodus' : 'Dunkelmodus'}
        >
          {theme === 'dark' ? <IconSun /> : <IconMoon />}
          <span>{theme === 'dark' ? 'Hell' : 'Dunkel'}</span>
        </button>
      </nav>
      <main className="main">
        {canBack ? (
          <button type="button" className="back-btn" onClick={back}>
            <IconBack /> Zurück
          </button>
        ) : null}
        {view.name === 'home' ? <HomeDashboard /> : null}
        {view.name === 'albums' ? <AlbumGrid /> : null}
        {view.name === 'artists' ? <ArtistList /> : null}
        {view.name === 'playlists' ? <PlaylistList /> : null}
        {view.name === 'starred' ? <StarredView /> : null}
        {view.name === 'search' ? <SearchView /> : null}
        {view.name === 'genres' ? <GenreList /> : null}
        {view.name === 'album' ? <AlbumDetail id={view.id} /> : null}
        {view.name === 'artist' ? <ArtistDetail id={view.id} /> : null}
        {view.name === 'playlist' ? <PlaylistDetail id={view.id} /> : null}
        {view.name === 'genre' ? <GenreDetail name={view.id} /> : null}
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
