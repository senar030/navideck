export type Song = {
  id: string
  title: string
  album?: string
  albumId?: string
  artist?: string
  artistId?: string
  duration?: number
  track?: number
  year?: number
  coverArt?: string
  starred?: string
  discNumber?: number
}

export type Album = {
  id: string
  name: string
  artist?: string
  artistId?: string
  coverArt?: string
  songCount?: number
  duration?: number
  year?: number
  starred?: string
  song?: Song[]
}

export type Artist = {
  id: string
  name: string
  albumCount?: number
  coverArt?: string
  starred?: string
  album?: Album[]
}

export type ArtistIndex = {
  name: string
  artist?: Artist[]
}

export type Playlist = {
  id: string
  name: string
  songCount?: number
  duration?: number
  coverArt?: string
  comment?: string
  entry?: Song[]
}

export type AlbumListType =
  | 'newest'
  | 'recent'
  | 'frequent'
  | 'random'
  | 'starred'
  | 'alphabeticalByName'

export type SearchResult = {
  artist?: Artist[]
  album?: Album[]
  song?: Song[]
}

export type Genre = {
  value: string
  songCount?: number
  albumCount?: number
}
