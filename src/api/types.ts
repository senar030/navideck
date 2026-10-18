/**
 * An internet radio stream standing in for a song in the player queue: it has
 * no length, cannot be seeked, and must not be preloaded or scrobbled.
 */
export type RadioTrack = {
  /** The station's stream URL — played instead of a Navidrome stream. */
  url: string
  /** Station logo, when one is known. */
  logo?: string
  /** The station's website, when one is known. */
  homepage?: string
}

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
  genre?: string
  playCount?: number
  /** Set when this queue entry is a live radio stream rather than a file. */
  radio?: RadioTrack
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
  genre?: string
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

export type MusicFolder = {
  id: string
  name: string
}

export type ArtistInfo = {
  biography?: string
  musicBrainzId?: string
  lastFmUrl?: string
  smallImageUrl?: string
  mediumImageUrl?: string
  largeImageUrl?: string
  similarArtist?: Artist[]
}

/** An internet radio station as Navidrome stores it. */
export type RadioStation = {
  id: string
  name: string
  streamUrl: string
  /** Navidrome answers with `homePageUrl`, but the create call takes `homepageUrl`. */
  homePageUrl?: string
  /** Only set once somebody uploaded a logo for the station in Navidrome. */
  coverArt?: string
}

/** The part of Navidrome's user record the app has a use for. */
export type SubsonicUser = {
  username: string
  adminRole?: boolean
}
