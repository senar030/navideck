import type { ReactNode } from 'react'
import type { SectionId, SectionProps } from './DashboardParts'
import {
  AlbumFeed,
  FrequentAlbumsSection,
  GenrePlaylistsSection,
  NewAlbumsSection,
  RandomAlbumsSection,
  RandomArtistsSection,
  RecentAlbumsSection,
  RecentSongsFeed,
  RecentSongsSection,
  StarredAlbumsPage,
  StarredAlbumsSection,
  StarredArtistsPage,
  StarredArtistsSection,
  StarredSongsPage,
  StarredSongsSection,
} from './DashboardSections'

/*
 * Which blocks the start page shows, in which order and under which name. Each
 * entry names a component from `DashboardSections.tsx` and optionally a `Page`
 * for the "Weitere laden…" tile. Adding a new category means writing one
 * component there and adding one entry here.
 */
export type { SectionId }

export type SectionDef = {
  id: SectionId
  label: string
  /** Heading of the page behind the "Weitere laden…" tile. */
  pageTitle: string
  Section: (props: SectionProps) => ReactNode
  Page?: () => ReactNode
}

export const SECTIONS: SectionDef[] = [
  { id: 'recentAlbums', label: 'Zuletzt gehört', pageTitle: 'Zuletzt gehört', Section: RecentAlbumsSection, Page: () => <AlbumFeed type="recent" /> },
  { id: 'newAlbums', label: 'Zuletzt hinzugefügt', pageTitle: 'Zuletzt hinzugefügt', Section: NewAlbumsSection, Page: () => <AlbumFeed type="newest" /> },
  { id: 'recentSongs', label: 'Letzte Songs', pageTitle: 'Letzte Songs', Section: RecentSongsSection, Page: RecentSongsFeed },
  { id: 'randomAlbums', label: 'Zufällige Alben', pageTitle: 'Zufällige Alben', Section: RandomAlbumsSection },
  { id: 'randomArtists', label: 'Zufällige Künstler', pageTitle: 'Zufällige Künstler', Section: RandomArtistsSection },
  { id: 'genrePlaylists', label: 'Genre Radio', pageTitle: 'Genre Radio', Section: GenrePlaylistsSection },
  { id: 'frequentAlbums', label: 'Meist gespielte Alben', pageTitle: 'Meist gespielte Alben', Section: FrequentAlbumsSection, Page: () => <AlbumFeed type="frequent" /> },
  { id: 'starredArtists', label: 'Favoriten Künstler', pageTitle: 'Favoriten Künstler', Section: StarredArtistsSection, Page: StarredArtistsPage },
  { id: 'starredAlbums', label: 'Favoriten Alben', pageTitle: 'Favoriten Alben', Section: StarredAlbumsSection, Page: StarredAlbumsPage },
  { id: 'starredSongs', label: 'Favoriten Songs', pageTitle: 'Favoriten Songs', Section: StarredSongsSection, Page: StarredSongsPage },
]

/** Start page order out of the box. */
export const DEFAULT_SECTIONS: SectionId[] = [
  'recentAlbums',
  'newAlbums',
  'recentSongs',
  'randomAlbums',
  'randomArtists',
  'genrePlaylists',
  'frequentAlbums',
  'starredArtists',
  'starredAlbums',
  'starredSongs',
]

export function sectionById(id: string): SectionDef | undefined {
  return SECTIONS.find((section) => section.id === id)
}
