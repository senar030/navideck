import Foundation

/*
 * The Subsonic API is loose about types: some servers send numbers as strings,
 * and a handful of list fields may arrive either as one object or as an array.
 * These helpers keep the models forgiving without spreading `try?` everywhere.
 */
private func flexInt<K: CodingKey>(_ c: KeyedDecodingContainer<K>, _ key: K) -> Int? {
    if let value = try? c.decodeIfPresent(Int.self, forKey: key) { return value }
    if let value = try? c.decodeIfPresent(Double.self, forKey: key) { return Int(value) }
    if let value = try? c.decodeIfPresent(String.self, forKey: key) { return Int(value) }
    return nil
}

private func flexString<K: CodingKey>(_ c: KeyedDecodingContainer<K>, _ key: K) -> String? {
    if let value = try? c.decodeIfPresent(String.self, forKey: key) { return value }
    if let value = try? c.decodeIfPresent(Int.self, forKey: key) { return String(value) }
    return nil
}

private func flexBool<K: CodingKey>(_ c: KeyedDecodingContainer<K>, _ key: K) -> Bool? {
    if let value = try? c.decodeIfPresent(Bool.self, forKey: key) { return value }
    if let value = try? c.decodeIfPresent(String.self, forKey: key) {
        return value == "true" || value == "1"
    }
    if let value = try? c.decodeIfPresent(Int.self, forKey: key) { return value != 0 }
    return nil
}

private func flexList<T: Decodable, K: CodingKey>(
    _ c: KeyedDecodingContainer<K>,
    _ key: K
) -> [T] {
    if let list = try? c.decodeIfPresent([T].self, forKey: key) { return list }
    if let one = try? c.decodeIfPresent(T.self, forKey: key) { return [one] }
    return []
}

// MARK: - Songs

struct Song: Codable, Identifiable, Hashable, Sendable {
    var id: String
    var title: String
    var album: String?
    var albumId: String?
    var artist: String?
    var artistId: String?
    var duration: Int?
    var track: Int?
    var year: Int?
    var coverArt: String?
    var starred: String?
    var discNumber: Int?
    var genre: String?
    var playCount: Int?
    var played: String?
    var isDir: Bool?
    var suffix: String?
    var size: Int?

    enum CodingKeys: String, CodingKey {
        case id, title, album, albumId, artist, artistId, duration, track, year
        case coverArt, starred, discNumber, genre, playCount, played, isDir, suffix, size
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = (try? c.decodeIfPresent(String.self, forKey: .id)) ?? ""
        title = (try? c.decodeIfPresent(String.self, forKey: .title)) ?? ""
        album = try? c.decodeIfPresent(String.self, forKey: .album)
        albumId = try? c.decodeIfPresent(String.self, forKey: .albumId)
        artist = try? c.decodeIfPresent(String.self, forKey: .artist)
        artistId = try? c.decodeIfPresent(String.self, forKey: .artistId)
        duration = flexInt(c, .duration)
        track = flexInt(c, .track)
        year = flexInt(c, .year)
        coverArt = try? c.decodeIfPresent(String.self, forKey: .coverArt)
        starred = try? c.decodeIfPresent(String.self, forKey: .starred)
        discNumber = flexInt(c, .discNumber)
        genre = try? c.decodeIfPresent(String.self, forKey: .genre)
        playCount = flexInt(c, .playCount)
        played = try? c.decodeIfPresent(String.self, forKey: .played)
        isDir = flexBool(c, .isDir)
        suffix = try? c.decodeIfPresent(String.self, forKey: .suffix)
        size = flexInt(c, .size)
    }

    /// Songs are created by the app only when a queue is restored or edited.
    init(
        id: String,
        title: String,
        album: String? = nil,
        albumId: String? = nil,
        artist: String? = nil,
        artistId: String? = nil,
        duration: Int? = nil,
        track: Int? = nil,
        year: Int? = nil,
        coverArt: String? = nil,
        starred: String? = nil,
        discNumber: Int? = nil,
        genre: String? = nil,
        playCount: Int? = nil,
        played: String? = nil,
        isDir: Bool? = nil,
        suffix: String? = nil,
        size: Int? = nil
    ) {
        self.id = id
        self.title = title
        self.album = album
        self.albumId = albumId
        self.artist = artist
        self.artistId = artistId
        self.duration = duration
        self.track = track
        self.year = year
        self.coverArt = coverArt
        self.starred = starred
        self.discNumber = discNumber
        self.genre = genre
        self.playCount = playCount
        self.played = played
        self.isDir = isDir
        self.suffix = suffix
        self.size = size
    }

    var isStarred: Bool { starred != nil }

    var durationText: String {
        guard let duration, duration > 0 else { return "--:--" }
        return Format.duration(Double(duration))
    }
}

// MARK: - Albums

struct Album: Codable, Identifiable, Hashable, Sendable {
    var id: String
    var name: String
    var artist: String?
    var artistId: String?
    var coverArt: String?
    var songCount: Int?
    var duration: Int?
    var year: Int?
    var starred: String?
    var genre: String?
    var songs: [Song]

    enum CodingKeys: String, CodingKey {
        case id, name, artist, artistId, coverArt, songCount, duration, year
        case starred, genre, songs = "song"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = (try? c.decodeIfPresent(String.self, forKey: .id)) ?? ""
        name = (try? c.decodeIfPresent(String.self, forKey: .name)) ?? ""
        artist = try? c.decodeIfPresent(String.self, forKey: .artist)
        artistId = try? c.decodeIfPresent(String.self, forKey: .artistId)
        coverArt = try? c.decodeIfPresent(String.self, forKey: .coverArt)
        songCount = flexInt(c, .songCount)
        duration = flexInt(c, .duration)
        year = flexInt(c, .year)
        starred = try? c.decodeIfPresent(String.self, forKey: .starred)
        genre = try? c.decodeIfPresent(String.self, forKey: .genre)
        songs = flexList(c, .songs)
    }

    init(
        id: String,
        name: String,
        artist: String? = nil,
        artistId: String? = nil,
        coverArt: String? = nil,
        songCount: Int? = nil,
        duration: Int? = nil,
        year: Int? = nil,
        starred: String? = nil,
        genre: String? = nil,
        songs: [Song] = []
    ) {
        self.id = id
        self.name = name
        self.artist = artist
        self.artistId = artistId
        self.coverArt = coverArt
        self.songCount = songCount
        self.duration = duration
        self.year = year
        self.starred = starred
        self.genre = genre
        self.songs = songs
    }

    var isStarred: Bool { starred != nil }

    var metaText: String {
        var parts: [String] = []
        if let year { parts.append(String(year)) }
        if let songCount { parts.append("\(songCount) Titel") }
        return parts.joined(separator: " · ")
    }
}

// MARK: - Artists

struct Artist: Codable, Identifiable, Hashable, Sendable {
    var id: String
    var name: String
    var albumCount: Int?
    var coverArt: String?
    var starred: String?
    var albums: [Album]

    enum CodingKeys: String, CodingKey {
        case id, name, albumCount, coverArt, starred, albums = "album"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = (try? c.decodeIfPresent(String.self, forKey: .id)) ?? ""
        name = (try? c.decodeIfPresent(String.self, forKey: .name)) ?? ""
        albumCount = flexInt(c, .albumCount)
        coverArt = try? c.decodeIfPresent(String.self, forKey: .coverArt)
        starred = try? c.decodeIfPresent(String.self, forKey: .starred)
        albums = flexList(c, .albums)
    }

    init(
        id: String,
        name: String,
        albumCount: Int? = nil,
        coverArt: String? = nil,
        starred: String? = nil,
        albums: [Album] = []
    ) {
        self.id = id
        self.name = name
        self.albumCount = albumCount
        self.coverArt = coverArt
        self.starred = starred
        self.albums = albums
    }

    var isStarred: Bool { starred != nil }
}

struct ArtistIndex: Decodable, Hashable, Sendable {
    var name: String?
    var artists: [Artist]

    enum CodingKeys: String, CodingKey {
        case name, artists = "artist"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        name = try? c.decodeIfPresent(String.self, forKey: .name)
        artists = flexList(c, .artists)
    }
}

struct ArtistInfo: Decodable, Sendable {
    var biography: String?
    var largeImageUrl: String?
    var similarArtists: [Artist]

    enum CodingKeys: String, CodingKey {
        case biography, largeImageUrl, similarArtists = "similarArtist"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        biography = try? c.decodeIfPresent(String.self, forKey: .biography)
        largeImageUrl = try? c.decodeIfPresent(String.self, forKey: .largeImageUrl)
        similarArtists = flexList(c, .similarArtists)
    }
}

// MARK: - Playlists, genres, search

struct Playlist: Codable, Identifiable, Hashable, Sendable {
    var id: String
    var name: String
    var songCount: Int?
    var duration: Int?
    var coverArt: String?
    var comment: String?
    var entries: [Song]

    enum CodingKeys: String, CodingKey {
        case id, name, songCount, duration, coverArt, comment, entries = "entry"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = (try? c.decodeIfPresent(String.self, forKey: .id)) ?? ""
        name = (try? c.decodeIfPresent(String.self, forKey: .name)) ?? ""
        songCount = flexInt(c, .songCount)
        duration = flexInt(c, .duration)
        coverArt = try? c.decodeIfPresent(String.self, forKey: .coverArt)
        comment = try? c.decodeIfPresent(String.self, forKey: .comment)
        entries = flexList(c, .entries)
    }

    init(
        id: String,
        name: String,
        songCount: Int? = nil,
        duration: Int? = nil,
        coverArt: String? = nil,
        comment: String? = nil,
        entries: [Song] = []
    ) {
        self.id = id
        self.name = name
        self.songCount = songCount
        self.duration = duration
        self.coverArt = coverArt
        self.comment = comment
        self.entries = entries
    }
}

struct Genre: Decodable, Identifiable, Hashable, Sendable {
    var value: String
    var songCount: Int?
    var albumCount: Int?

    var id: String { value }

    enum CodingKeys: String, CodingKey {
        case value, songCount, albumCount
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        value = (try? c.decodeIfPresent(String.self, forKey: .value)) ?? ""
        songCount = flexInt(c, .songCount)
        albumCount = flexInt(c, .albumCount)
    }
}

struct SearchResult: Sendable {
    var artists: [Artist] = []
    var albums: [Album] = []
    var songs: [Song] = []

    var isEmpty: Bool { artists.isEmpty && albums.isEmpty && songs.isEmpty }
}

// MARK: - Response envelope

struct SubsonicResponse: Decodable, Sendable {
    var status: String
    var error: SubsonicErrorPayload?

    var artists: ArtistsBlock?
    var artist: Artist?
    var artistInfo2: ArtistInfo?
    var albumList2: AlbumListBlock?
    var albums: AlbumListBlock?
    var album: Album?
    var songsByGenre: SongsBlock?
    var randomSongs: SongsBlock?
    var topSongs: SongsBlock?
    var playlists: PlaylistsBlock?
    var playlist: Playlist?
    var searchResult3: SearchBlock?
    var starred2: StarredBlock?
    var genres: GenresBlock?
}

struct SubsonicErrorPayload: Decodable, Sendable {
    var code: Int?
    var message: String?
}

struct ArtistsBlock: Decodable, Sendable {
    var index: [ArtistIndex]?
}

struct AlbumListBlock: Decodable, Sendable {
    var album: [Album]?
}

struct SongsBlock: Decodable, Sendable {
    var song: [Song]?
}

struct PlaylistsBlock: Decodable, Sendable {
    var playlist: [Playlist]?
}

struct SearchBlock: Decodable, Sendable {
    var artist: [Artist]?
    var album: [Album]?
    var song: [Song]?
}

struct StarredBlock: Decodable, Sendable {
    var artist: [Artist]?
    var album: [Album]?
    var song: [Song]?
}

struct GenresBlock: Decodable, Sendable {
    var genre: [Genre]

    enum CodingKeys: String, CodingKey {
        case genre
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        genre = flexList(c, .genre)
    }
}
