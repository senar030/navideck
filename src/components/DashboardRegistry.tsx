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
import {
  CollectionsSection,
  ContinueAllSection,
  ContinueBooksSection,
  ContinuePodcastsSection,
  LatestEpisodesSection,
  PodcastShowsSection,
  RandomAuthorsSection,
  RandomBooksSection,
} from './DashboardMedia'

/*
 * Which blocks a start page shows, in which order and under which name. Each
 * entry names a component and the area it belongs to: the music start page
 * takes the music blocks, the app start page takes all of them.
 */
export type { SectionId }

/** Where a block's data comes from; `mixed` needs books or podcasts. */
export type SectionScope = 'music' | 'books' | 'podcasts' | 'mixed'

export type SectionDef = {
  id: SectionId
  label: string
  /** Heading of the page behind the "Weitere laden…" tile. */
  pageTitle: string
  scope: SectionScope
  Section: (props: SectionProps) => ReactNode
  Page?: () => ReactNode
}

export const SECTIONS: SectionDef[] = [
  { id: 'recentAlbums', label: 'Zuletzt gehört', pageTitle: 'Zuletzt gehört', scope: 'music', Section: RecentAlbumsSection, Page: () => <AlbumFeed type="recent" /> },
  { id: 'newAlbums', label: 'Zuletzt hinzugefügt', pageTitle: 'Zuletzt hinzugefügt', scope: 'music', Section: NewAlbumsSection, Page: () => <AlbumFeed type="newest" /> },
  { id: 'recentSongs', label: 'Letzte Songs', pageTitle: 'Letzte Songs', scope: 'music', Section: RecentSongsSection, Page: RecentSongsFeed },
  { id: 'randomAlbums', label: 'Zufällige Alben', pageTitle: 'Zufällige Alben', scope: 'music', Section: RandomAlbumsSection },
  { id: 'randomArtists', label: 'Zufällige Künstler', pageTitle: 'Zufällige Künstler', scope: 'music', Section: RandomArtistsSection },
  { id: 'genrePlaylists', label: 'Genre Radio', pageTitle: 'Genre Radio', scope: 'music', Section: GenrePlaylistsSection },
  { id: 'frequentAlbums', label: 'Meist gespielte Alben', pageTitle: 'Meist gespielte Alben', scope: 'music', Section: FrequentAlbumsSection, Page: () => <AlbumFeed type="frequent" /> },
  { id: 'starredArtists', label: 'Favoriten Künstler', pageTitle: 'Favoriten Künstler', scope: 'music', Section: StarredArtistsSection, Page: StarredArtistsPage },
  { id: 'starredAlbums', label: 'Favoriten Alben', pageTitle: 'Favoriten Alben', scope: 'music', Section: StarredAlbumsSection, Page: StarredAlbumsPage },
  { id: 'starredSongs', label: 'Favoriten Songs', pageTitle: 'Favoriten Songs', scope: 'music', Section: StarredSongsSection, Page: StarredSongsPage },

  { id: 'continueAll', label: 'Weiterhören', pageTitle: 'Weiterhören', scope: 'mixed', Section: ContinueAllSection },
  { id: 'continueBooks', label: 'Weiterhören', pageTitle: 'Weiterhören', scope: 'books', Section: ContinueBooksSection },
  { id: 'continuePodcasts', label: 'Weiterhören', pageTitle: 'Weiterhören', scope: 'podcasts', Section: ContinuePodcastsSection },
  { id: 'randomBooks', label: 'Zufällige Bücher', pageTitle: 'Zufällige Bücher', scope: 'books', Section: RandomBooksSection },
  { id: 'randomAuthors', label: 'Zufällige Autoren', pageTitle: 'Zufällige Autoren', scope: 'books', Section: RandomAuthorsSection },
  { id: 'collections', label: 'Sammlungen', pageTitle: 'Sammlungen', scope: 'books', Section: CollectionsSection },
  { id: 'latestEpisodes', label: 'Neueste Episoden', pageTitle: 'Neueste Episoden', scope: 'podcasts', Section: LatestEpisodesSection },
  { id: 'podcastShows', label: 'Podcasts', pageTitle: 'Podcasts', scope: 'podcasts', Section: PodcastShowsSection },
]

/** The music start page out of the box. */
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

/** The audiobook start page out of the box. */
export const DEFAULT_BOOK_SECTIONS: SectionId[] = [
  'continueBooks',
  'randomBooks',
  'randomAuthors',
  'collections',
]

/** The podcast start page out of the box. */
export const DEFAULT_PODCAST_SECTIONS: SectionId[] = ['continuePodcasts', 'latestEpisodes']

/** The app start page: a little of everything, the rest can be added. */
export const DEFAULT_START_SECTIONS: SectionId[] = [
  'continueAll',
  'recentAlbums',
  'randomBooks',
  'latestEpisodes',
  'newAlbums',
  'randomArtists',
  'podcastShows',
  'randomAuthors',
  'collections',
  'recentSongs',
]

export function sectionById(id: string): SectionDef | undefined {
  return SECTIONS.find((section) => section.id === id)
}
