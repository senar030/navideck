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

/**
 * A queue entry that comes from Audiobookshelf instead of Navidrome. A book can
 * be several files, so each file is its own entry and `startOffset` says where
 * it begins inside the book — that is what progress is reported against.
 */
export type AbsPlayback = {
  itemId: string
  /** Set for a podcast episode; a book has none. */
  episodeId?: string
  /** The file's own URL, token included. */
  url: string
  /** Seconds of the book that play before this file starts. */
  startOffset: number
  /** Length of the whole book or episode, for progress. */
  total: number
  track?: number
  tracks?: number
  /** Ready-made cover URL; Audiobookshelf covers need a token. */
  cover?: string
  /** What the player bar should call this: usually the book's title. */
  label?: string
  /** True when the episode comes from a Subsonic server rather than Audiobookshelf. */
  subsonic?: boolean
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
  /** The date the server last registered a play, if this song ever had one. */
  played?: string
  /** Set when this queue entry is a live radio stream rather than a file. */
  radio?: RadioTrack
  /** Set when the entry comes from Audiobookshelf rather than Navidrome. */
  abs?: AbsPlayback
  /** Seconds into the file to start at — used when resuming a book. */
  startAt?: number
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
