import Foundation
import Observation
import SwiftUI

/// Everything the UI needs in one place: the saved servers, the currently
/// connected Subsonic client, the player, downloads and preferences.
@MainActor
@Observable
final class AppModel {
    let servers: ServerStore
    let player: PlayerService
    let prefs: Preferences
    let downloads: DownloadStore
    /// Shared resume positions for podcast episodes.
    let episodeProgress = EpisodeProgressStore()

    private(set) var client: SubsonicClient?
    /// Audiobookshelf connection, independent from the Subsonic server.
    private(set) var abs: AudiobookshelfClient?

    // Audiobook library cache
    private(set) var absBooks: [AbsBook] = []
    private(set) var absProgress: [String: AbsProgress] = [:]
    private(set) var absLoading = false
    var absError: String?
    @ObservationIgnored private var absLoadedAt: Date?
    @ObservationIgnored private var absTrackURLs: [String: URL] = [:]
    @ObservationIgnored private var absTrackBooks: [String: (bookID: String, offset: Double, duration: Double)] = [:]
    @ObservationIgnored private var lastABSSync = Date.distantPast

    /// Set by the player's menu so the active tab can push the destination.
    var pendingRoute: LibraryRoute?
    /// Cached home rows keep the start screen instant between visits.
    var homeSnapshot: HomeSnapshot?
    /// Podcast channels survive tab switches; without this every visit waited
    /// for the whole feed list again.
    private(set) var podcastSnapshot: PodcastSnapshot?
    private var podcastTask: Task<PodcastSnapshot, Error>?
    /// Only songs that belong to a podcast are written to the resume store.
    private var episodeIDs: Set<String> = []
    /// Cover URLs are built in every row body; building them once per size is
    /// much cheaper than parsing URL components during scrolling.
    @ObservationIgnored private var artworkCache: [String: URL] = [:]

    var mixLoading = false
    var mixError: String?

    var isConnected: Bool { client != nil }

    init() {
        let servers = ServerStore()
        let prefs = Preferences()
        let downloads = DownloadStore()
        let player = PlayerService()

        self.servers = servers
        self.prefs = prefs
        self.downloads = downloads
        self.player = player

        player.localURL = { [weak downloads] songID in
            downloads?.localURL(songID: songID)
        }
        player.streamBitRate = { [weak prefs] in
            prefs?.maxBitRate ?? 0
        }
        player.progressSink = { [weak self] song, position, duration in
            guard let self else { return }
            if self.episodeIDs.contains(song.id) {
                self.episodeProgress.record(id: song.id, position: position, duration: duration)
                return
            }
            self.handleAudiobookProgress(song: song, position: position)
        }

        if let profile = servers.active, let client = servers.makeClient(for: profile) {
            self.client = client
            player.configure(client: client, profileID: profile.id)
        }
        if let profile = servers.activeABS, let client = servers.makeAudiobookshelfClient(for: profile) {
            self.abs = client
            player.configureAudiobookshelf()
        }

        player.externalURLResolver = { [weak self] song in
            self?.absTrackURLs[song.id]
        }

        #if DEBUG
        // Simulator-only convenience: point the app at a local test server
        // without typing credentials, e.g.
        // SIMCTL_CHILD_NAVIDECK_DEMO_URL=http://127.0.0.1:4533
        if let demo = ProcessInfo.processInfo.environment["NAVIDECK_DEMO_URL"],
           let url = URL(string: demo) {
            let profile = servers.save(
                baseURL: url,
                username: "demo",
                password: "demo",
                auth: .token
            )
            if let client = servers.makeClient(for: profile) {
                self.client = client
                player.configure(client: client, profileID: profile.id)
            }
        }

        if ProcessInfo.processInfo.environment["NAVIDECK_DEMO_OFFLINE"] == "1" {
            prefs.offlineMode = true
        }

        if let absURL = ProcessInfo.processInfo.environment["NAVIDECK_DEMO_ABS_URL"],
           let login = ProcessInfo.processInfo.environment["NAVIDECK_DEMO_ABS_LOGIN"] {
            let parts = login.split(separator: ":", maxSplits: 1).map(String.init)
            Task { @MainActor in
                try? await connectAudiobookshelf(
                    urlText: absURL,
                    username: parts.first ?? "",
                    password: parts.count > 1 ? parts[1] : ""
                )
                await loadAudiobooks(force: true)
            }
        } else if let absURL = ProcessInfo.processInfo.environment["NAVIDECK_DEMO_ABS_URL"],
           let url = URL(string: absURL) {
            let profile = servers.saveAudiobookshelf(
                baseURL: url,
                token: ProcessInfo.processInfo.environment["NAVIDECK_DEMO_ABS_TOKEN"] ?? "demo-token"
            )
            if let client = servers.makeAudiobookshelfClient(for: profile) {
                self.abs = client
            }
        }

        if ProcessInfo.processInfo.environment["NAVIDECK_DEMO_PLAYABS"] == "1" {
            Task { @MainActor in
                await loadAudiobooks()
                if let first = absBooks.first {
                    playAudiobook(first)
                    player.showNowPlaying = true
                }
            }
        }

        if ProcessInfo.processInfo.environment["NAVIDECK_DEMO_SEED_DOWNLOADS"] == "1" {
            Task { @MainActor in
                guard let client else { return }
                if let albums = try? await client.albumList(.newest, size: 1),
                   let first = albums.first,
                   let full = try? await client.album(id: first.id) {
                    download(full)
                }
                if let playlists = try? await client.playlists(),
                   let first = playlists.first,
                   let full = try? await client.playlist(id: first.id) {
                    download(full)
                }
                if let songs = try? await client.randomSongs(size: 1),
                   let song = songs.first {
                    download(song, from: song.album, artist: song.artist)
                }
            }
        }

        let demoPlay = ProcessInfo.processInfo.environment["NAVIDECK_DEMO_PLAY"]
        if demoPlay == "1" || demoPlay == "2" {
            startDemoPlayback(openPlayer: demoPlay == "1")
        }
        #endif
    }

    #if DEBUG
    /// Starts the first album, optionally opening Now Playing, so the player can
    /// be checked in the simulator without tapping through the UI.
    private func startDemoPlayback(openPlayer: Bool) {
        Task { @MainActor in
            guard let client else { return }
            let demoPlaylist = ProcessInfo.processInfo.environment["NAVIDECK_DEMO_PLAYLIST"] == "1"
            let songs: [Song]
            if demoPlaylist {
                guard let playlists = try? await client.playlists(),
                      let first = playlists.first,
                      let full = try? await client.playlist(id: first.id),
                      !full.entries.isEmpty else { return }
                songs = full.entries
            } else {
                guard let albums = try? await client.albumList(.newest, size: 2),
                      let first = albums.first,
                      let full = try? await client.album(id: first.id),
                      !full.songs.isEmpty else { return }
                songs = full.songs
            }
            player.play(songs)
            if openPlayer {
                player.showNowPlaying = true
            }
            if ProcessInfo.processInfo.environment["NAVIDECK_DEMO_SKIP"] == "1" {
                for _ in 0..<5 {
                    try? await Task.sleep(nanoseconds: 4_000_000_000)
                    player.demoTickToEnd()
                }
            }
        }
    }
    #endif

    // MARK: - Connecting

    func connect(
        urlText: String,
        username: String,
        password: String,
        auth: SubsonicAuth
    ) async throws {
        guard let url = Format.serverURL(urlText) else {
            throw SubsonicFailure(code: -1, message: "Bitte eine gültige Server-Adresse eingeben.")
        }
        let user = username.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !user.isEmpty else {
            throw SubsonicFailure(code: -1, message: "Bitte einen Benutzernamen eingeben.")
        }
        guard !password.isEmpty else {
            throw SubsonicFailure(code: -1, message: "Bitte das Passwort eingeben.")
        }

        let candidate = SubsonicClient(baseURL: url, username: user, password: password, auth: auth)
        try await candidate.ping()

        let profile = servers.save(baseURL: url, username: user, password: password, auth: auth)
        activate(profile, client: candidate)
    }

    func activate(_ profile: ServerProfile) {
        guard let client = servers.makeClient(for: profile) else { return }
        activate(profile, client: client)
    }

    private func activate(_ profile: ServerProfile, client: SubsonicClient) {
        servers.setActive(profile)
        player.stop()
        self.client = client
        homeSnapshot = nil
        podcastSnapshot = nil
        episodeIDs = []
        artworkCache = [:]
        pendingRoute = nil
        player.configure(client: client, profileID: profile.id)
    }

    func disconnect() {
        player.stop()
        servers.deactivate()
        client = nil
        homeSnapshot = nil
        podcastSnapshot = nil
        episodeIDs = []
        artworkCache = [:]
    }

    func remove(profile: ServerProfile) {
        let removingActive = servers.activeID == profile.id
        servers.remove(profile)
        if removingActive {
            player.stop()
            client = nil
            homeSnapshot = nil
            if let next = servers.active, let client = servers.makeClient(for: next) {
                self.client = client
                player.configure(client: client, profileID: next.id)
            }
        }
    }

    // MARK: - Instant mix

    /// Builds a random mix from the library, skipping the genres the user
    /// excluded in the settings.
    func startInstantMix(size: Int? = nil, genre: String? = nil) async {
        guard let client, !mixLoading else { return }
        mixLoading = true
        mixError = nil
        defer { mixLoading = false }

        let wanted = max(1, size ?? prefs.mixSize)
        let excluded = Set(prefs.excludedGenres.map { $0.lowercased() })

        if offlineMode {
            let pool = downloadedSongs.filter { !excluded.contains(($0.genre ?? "").lowercased()) }
            guard !pool.isEmpty else {
                mixError = "Keine heruntergeladenen Titel für den Mix."
                return
            }
            player.play(Array(pool.shuffled().prefix(wanted)))
            return
        }

        do {
            if let genre, !genre.isEmpty {
                let songs = try await client.songs(byGenre: genre, count: max(wanted, 50))
                guard !songs.isEmpty else {
                    mixError = "Keine Titel in diesem Genre."
                    return
                }
                player.play(Array(songs.shuffled().prefix(wanted)))
                return
            }

            var pool: [Song] = []
            var seen = Set<String>()
            var attempts = 0

            while pool.count < wanted && attempts < 5 {
                attempts += 1
                let batch = try await client.randomSongs(size: max(wanted * 2, 100))
                for song in batch where !excluded.contains((song.genre ?? "").lowercased()) {
                    if seen.insert(song.id).inserted {
                        pool.append(song)
                    }
                }
                if batch.isEmpty { break }
            }

            if pool.count < wanted, attempts >= 5 {
                // Not enough random titles: fill up with the newest albums.
                let albums = try await client.albumList(.newest, size: 12)
                for album in albums.prefix(6) {
                    guard let full = try? await client.album(id: album.id) else { continue }
                    for song in full.songs where !excluded.contains((song.genre ?? "").lowercased()) {
                        if seen.insert(song.id).inserted { pool.append(song) }
                    }
                    if pool.count >= wanted { break }
                }
            }

            guard !pool.isEmpty else {
                mixError = "Keine Titel für den Mix gefunden."
                return
            }
            player.play(Array(pool.prefix(wanted)))
        } catch {
            mixError = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }

    // MARK: - Podcasts

    /// Channels plus the newest episodes, kept for a few minutes so switching
    /// tabs does not refetch every feed.
    func podcasts(force: Bool = false) async throws -> PodcastSnapshot {
        guard let client else {
            throw SubsonicFailure(code: -1, message: "Kein Server verbunden.")
        }
        if !force, let snapshot = podcastSnapshot, snapshot.isFresh {
            return snapshot
        }
        if let running = podcastTask {
            return try await running.value
        }

        let task = Task<PodcastSnapshot, Error> {
            async let channelsTask = client.podcasts()
            async let newestTask = client.newestPodcasts(count: 12)

            let channels: [PodcastChannel]
            do {
                channels = try await channelsTask
            } catch let failure as SubsonicFailure where failure.code == 30 || failure.code == 0 {
                channels = []
            }
            let newest = (try? await newestTask) ?? []
            return PodcastSnapshot(channels: channels, newest: newest)
        }
        podcastTask = task

        do {
            let snapshot = try await task.value
            podcastTask = nil
            podcastSnapshot = snapshot
            registerEpisodes(in: snapshot)
            return snapshot
        } catch {
            podcastTask = nil
            throw error
        }
    }

    /// Drops the cached feeds, e.g. after the server added a channel.
    func invalidatePodcasts() {
        podcastSnapshot = nil
    }

    private func registerEpisodes(in snapshot: PodcastSnapshot) {
        for channel in snapshot.channels {
            for episode in channel.episodes {
                episodeIDs.insert(episode.playableID)
            }
        }
        for episode in snapshot.newest {
            episodeIDs.insert(episode.playableID)
        }
    }

    /// Plays a podcast episode (Nextcloud Music keeps the audio in the library).
    func playEpisodes(_ episodes: [PodcastEpisode], startingAt index: Int = 0) {
        guard !episodes.isEmpty, episodes.indices.contains(index) else { return }
        for episode in episodes {
            episodeIDs.insert(episode.playableID)
        }
        let start = episodes[index]
        let resume = episodeProgress.progress(for: start.playableID)?.position ?? 0
        player.play(episodes.map(\.song), startingAt: index, resumeAt: resume)
    }

    /// Continues the episode of a channel that was heard most recently.
    func resumeLatestEpisode(in channel: PodcastChannel) {
        guard let id = episodeProgress.latestEpisodeID(in: channel),
              let index = channel.episodes.firstIndex(where: { $0.playableID == id }) else {
            playEpisodes(channel.episodes)
            return
        }
        playEpisodes(channel.episodes, startingAt: index)
    }

    func download(_ episode: PodcastEpisode, from channel: PodcastChannel) {
        guard let client else { return }
        downloads.download(
            kind: .podcast,
            sourceID: episode.playableID,
            title: episode.title,
            subtitle: channel.title,
            coverArt: episode.coverArt ?? channel.coverArt,
            songs: [episode.song],
            client: client,
            maxBitRate: prefs.maxBitRate
        )
    }

    func isDownloaded(_ episode: PodcastEpisode) -> Bool {
        downloads.contains(songID: episode.playableID)
    }

    func isDownloading(_ episode: PodcastEpisode) -> Bool {
        downloads.isDownloading(kind: .podcast, sourceID: episode.playableID)
    }

    func cancelDownload(_ episode: PodcastEpisode) {
        downloads.cancel(kind: .podcast, sourceID: episode.playableID)
    }

    func removeDownload(_ episode: PodcastEpisode) {
        if let item = downloads.items.first(where: { $0.songs.contains { $0.id == episode.playableID } }) {
            downloads.delete(item)
        }
    }

    func playRadio(_ station: RadioStation) {
        guard let url = URL(string: station.streamUrl) else { return }
        let song = Song(
            id: "",
            title: station.name,
            album: "Radio",
            artist: "Radio",
            coverArt: station.coverArt
        )
        player.playExternal(url: url, song: song)
        player.showNowPlaying = true
    }

    // MARK: - Navigation from the player

    func openAlbum(id: String?, name: String?, artist: String?) {
        guard let id, !id.isEmpty else { return }
        player.showNowPlaying = false
        pendingRoute = .album(Album(id: id, name: name ?? "Album", artist: artist))
    }

    func openArtist(id: String?, name: String?) {
        guard let id, !id.isEmpty else { return }
        player.showNowPlaying = false
        pendingRoute = .artist(Artist(id: id, name: name ?? "Interpret"))
    }

    func openDownloads() {
        pendingRoute = .downloads
    }

    // MARK: - Downloads

    func download(_ album: Album) {
        guard let client else { return }
        let songs = album.songs
        guard !songs.isEmpty else { return }
        downloads.download(
            kind: .album,
            sourceID: album.id,
            title: album.name,
            subtitle: album.artist,
            coverArt: album.coverArt,
            songs: songs,
            client: client,
            maxBitRate: prefs.maxBitRate
        )
    }

    func download(_ playlist: Playlist) {
        guard let client else { return }
        downloads.download(
            kind: .playlist,
            sourceID: playlist.id,
            title: playlist.name,
            subtitle: playlist.comment,
            coverArt: playlist.coverArt,
            songs: playlist.entries,
            client: client,
            maxBitRate: prefs.maxBitRate
        )
    }

    func download(_ song: Song, from album: String?, artist: String?) {
        guard let client else { return }
        downloads.download(
            kind: .song,
            sourceID: song.id,
            title: song.title,
            subtitle: [artist, album].compactMap { $0 }.joined(separator: " · "),
            coverArt: song.coverArt,
            songs: [song],
            client: client,
            maxBitRate: prefs.maxBitRate
        )
    }

    func download(_ artist: Artist) {
        guard let client else { return }
        let albums = artist.albums
        guard !albums.isEmpty else { return }
        Task {
            var songs: [Song] = []
            for album in albums {
                if let full = try? await client.album(id: album.id) {
                    songs.append(contentsOf: full.songs)
                }
            }
            guard !songs.isEmpty else { return }
            downloads.download(
                kind: .artist,
                sourceID: artist.id,
                title: artist.name,
                subtitle: "\(albums.count) Alben",
                coverArt: artist.coverArt,
                songs: songs,
                client: client,
                maxBitRate: prefs.maxBitRate
            )
        }
    }

    // MARK: - Sources

    enum Category: String, CaseIterable, Sendable {
        case music
        case podcasts
        case audiobooks

        var title: String {
            switch self {
            case .music: return "Musik"
            case .podcasts: return "Podcasts"
            case .audiobooks: return "Hörbücher"
            }
        }
    }

    func preference(for category: Category) -> CategorySource {
        switch category {
        case .music: return CategorySource(rawValue: prefs.musicSource) ?? .auto
        case .podcasts: return CategorySource(rawValue: prefs.podcastSource) ?? .auto
        case .audiobooks: return CategorySource(rawValue: prefs.audiobookSource) ?? .auto
        }
    }

    func setPreference(_ source: CategorySource, for category: Category) {
        switch category {
        case .music: prefs.musicSource = source.rawValue
        case .podcasts: prefs.podcastSource = source.rawValue
        case .audiobooks: prefs.audiobookSource = source.rawValue
        }
    }

    /// Resolves the configured preference against what is actually connected.
    func resolvedSource(for category: Category) -> CategorySource {
        let wants = preference(for: category)
        switch wants {
        case .off:
            return .off
        case .subsonic:
            return client != nil ? .subsonic : .off
        case .audiobookshelf:
            return abs != nil ? .audiobookshelf : .off
        case .auto:
            switch category {
            case .music, .podcasts:
                return client != nil ? .subsonic : .off
            case .audiobooks:
                return abs != nil ? .audiobookshelf : .off
            }
        }
    }

    var musicAvailable: Bool { resolvedSource(for: .music) != .off }
    var podcastsAvailable: Bool { resolvedSource(for: .podcasts) != .off }
    var audiobooksAvailable: Bool { resolvedSource(for: .audiobooks) != .off }

    // MARK: - Audiobookshelf

    func connectAudiobookshelf(urlText: String, token: String) async throws {
        guard let url = Format.serverURL(urlText) else {
            throw AudiobookshelfFailure(message: "Bitte eine gültige Server-Adresse eingeben.")
        }
        let trimmed = token.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            throw AudiobookshelfFailure(message: "Bitte den API-Token eingeben.")
        }
        let candidate = AudiobookshelfClient(baseURL: url, token: trimmed)
        _ = try await candidate.libraries()

        let profile = servers.saveAudiobookshelf(baseURL: url, token: trimmed)
        activateAudiobookshelf(profile, client: candidate)
    }

    /// Alternative to the API token: log in with a normal account and keep the
    /// returned token.
    func connectAudiobookshelf(urlText: String, username: String, password: String) async throws {
        guard let url = Format.serverURL(urlText) else {
            throw AudiobookshelfFailure(message: "Bitte eine gültige Server-Adresse eingeben.")
        }
        let user = username.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !user.isEmpty, !password.isEmpty else {
            throw AudiobookshelfFailure(message: "Bitte Benutzername und Passwort eingeben.")
        }
        let token = try await AudiobookshelfClient(baseURL: url, token: "").login(
            username: user,
            password: password
        )
        let client = AudiobookshelfClient(baseURL: url, token: token)
        _ = try await client.libraries()
        let profile = servers.saveAudiobookshelf(baseURL: url, token: token)
        activateAudiobookshelf(profile, client: client)
    }

    func activateAudiobookshelf(_ profile: ServerProfile) {
        guard let client = servers.makeAudiobookshelfClient(for: profile) else { return }
        activateAudiobookshelf(profile, client: client)
    }

    private func activateAudiobookshelf(_ profile: ServerProfile, client: AudiobookshelfClient) {
        servers.setActiveABS(profile)
        abs = client
        absBooks = []
        absProgress = [:]
        absLoadedAt = nil
        player.configureAudiobookshelf()
    }

    func disconnectAudiobookshelf() {
        servers.deactivateABS()
        abs = nil
        absBooks = []
        absProgress = [:]
        absLoadedAt = nil
    }

    func removeAudiobookshelf(_ profile: ServerProfile) {
        servers.remove(profile)
        if servers.activeABS == nil {
            abs = nil
            absBooks = []
            absProgress = [:]
        }
    }

    /// Loads all book libraries, their items and the listening progress.
    func loadAudiobooks(force: Bool = false) async {
        guard let abs else { return }
        if !force, let loaded = absLoadedAt,
           Date().timeIntervalSince(loaded) < 300, !absBooks.isEmpty {
            return
        }
        absLoading = true
        absError = nil
        do {
            let libraries = try await abs.libraries()
            var items: [AbsBook] = []
            for library in libraries where library.mediaType == "book" {
                if let page = try? await abs.books(libraryID: library.id, page: 0, limit: 150) {
                    items.append(contentsOf: page)
                }
            }
            var seen = Set<String>()
            absBooks = items
                .filter { seen.insert($0.id).inserted }
                .sorted { ($0.addedAt ?? 0) > ($1.addedAt ?? 0) }

            let progress = (try? await abs.progress()) ?? []
            absProgress = Dictionary(
                progress.map { ($0.libraryItemId, $0) },
                uniquingKeysWith: { first, _ in first }
            )
            absLoadedAt = Date()
        } catch {
            absError = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
        absLoading = false
    }

    var audiobooksInProgress: [AbsBook] {
        absBooks
            .filter {
                guard let progress = absProgress[$0.id] else { return false }
                return progress.isFinished != true && progress.currentTime > 5
            }
            .sorted {
                (absProgress[$0.id]?.currentTime ?? 0) > (absProgress[$1.id]?.currentTime ?? 0)
            }
    }

    func absCoverURL(_ book: AbsBook, width: Int = 300) -> URL? {
        abs?.coverURL(itemID: book.id, width: width)
    }

    func audiobookProgress(_ book: AbsBook) -> Double {
        guard let progress = absProgress[book.id], progress.duration > 0 else { return 0 }
        return min(1, max(0, progress.currentTime / progress.duration))
    }

    /// Plays a book from the saved position, or from the given time.
    func playAudiobook(_ book: AbsBook, from time: Double? = nil) {
        guard let abs else { return }
        let tracks = book.media.tracks
        guard !tracks.isEmpty else { return }

        let startTime = time ?? absProgress[book.id]?.currentTime ?? 0
        var songs: [Song] = []
        for (index, track) in tracks.enumerated() {
            guard let url = abs.streamURL(contentUrl: track.contentUrl) else { continue }
            let title = tracks.count > 1
                ? "\(book.media.metadata.title) · Teil \(index + 1)"
                : book.media.metadata.title
            let song = Song(
                id: "abs:\(book.id):\(track.ino)",
                title: title,
                album: book.media.metadata.title,
                artist: book.media.metadata.authorName,
                duration: Int(track.duration.rounded()),
                track: index + 1,
                coverArt: "abs:\(book.id)"
            )
            absTrackURLs[song.id] = url
            absTrackBooks[song.id] = (book.id, track.startOffset, track.duration)
            songs.append(song)
        }
        guard !songs.isEmpty else { return }

        var index = 0
        var offset = 0.0
        for (position, song) in songs.enumerated() {
            guard let meta = absTrackBooks[song.id] else { continue }
            if startTime >= meta.offset, startTime < meta.offset + meta.duration {
                index = position
                offset = startTime - meta.offset
                break
            }
            if startTime >= meta.offset + meta.duration {
                index = min(position + 1, songs.count - 1)
            }
        }
        player.play(songs, startingAt: index, resumeAt: offset)
    }

    private func handleAudiobookProgress(song: Song, position: Double) {
        guard let meta = absTrackBooks[song.id], let abs else { return }
        let absolute = meta.offset + position
        let total = absBooks.first(where: { $0.id == meta.bookID })?.media.duration ?? 0

        let now = Date()
        guard now.timeIntervalSince(lastABSSync) > 10 else { return }
        lastABSSync = now

        let finished = total > 0 && absolute >= total - 5
        absProgress[meta.bookID] = AbsProgress(
            libraryItemId: meta.bookID,
            currentTime: absolute,
            duration: total,
            progress: total > 0 ? min(1, absolute / total) : 0,
            isFinished: finished
        )
        Task {
            await abs.pushProgress(
                itemID: meta.bookID,
                currentTime: absolute,
                duration: total,
                finished: finished
            )
        }
    }

    // MARK: - Offline library

    /// Global offline switch: only downloaded content is shown while it is on.
    var offlineMode: Bool {
        get { prefs.offlineMode }
        set { prefs.offlineMode = newValue }
    }

    /// Albums that exist on the device, rebuilt from the downloaded songs so
    /// they can be opened without a server.
    var downloadedAlbums: [Album] {
        print("NAVIDECK-DEBUG albums items=\(downloads.items.count)")
        var order: [String] = []
        var albums: [String: Album] = [:]

        for item in downloads.items {
            for song in item.songs {
                let id = song.albumId ?? song.album ?? item.sourceID
                if albums[id] == nil {
                    order.append(id)
                    albums[id] = Album(
                        id: id,
                        name: song.album ?? item.title,
                        artist: song.artist ?? item.subtitle,
                        coverArt: song.coverArt ?? item.coverArt,
                        songs: []
                    )
                }
                albums[id]?.songs.append(song)
            }
        }

        print("NAVIDECK-DEBUG albums result=\(order.count)")
        return order.compactMap { id in
            guard var album = albums[id] else { return nil }
            album.songCount = album.songs.count
            album.duration = album.songs.compactMap(\.duration).reduce(0, +)
            return album
        }
    }

    /// Artists that were downloaded as a whole.
    var downloadedArtists: [Artist] {
        downloads.items.compactMap { item in
            guard item.kind == .artist else { return nil }
            return Artist(
                id: item.sourceID,
                name: item.title,
                albumCount: Set(item.songs.compactMap(\.albumId)).count,
                coverArt: item.coverArt
            )
        }
    }

    var downloadedPlaylists: [Playlist] {
        downloads.items.compactMap { item in
            guard item.kind == .playlist else { return nil }
            return Playlist(
                id: item.sourceID,
                name: item.title,
                songCount: item.songs.count,
                coverArt: item.coverArt,
                entries: item.songs
            )
        }
    }

    var hasDownloads: Bool { !downloads.items.isEmpty }

    /// Genres that exist among the downloaded songs.
    var downloadedGenres: [Genre] {
        var counts: [String: Int] = [:]
        for song in downloadedSongs {
            guard let genre = song.genre, !genre.isEmpty else { continue }
            counts[genre, default: 0] += 1
        }
        return counts
            .map { Genre(value: $0.key, songCount: $0.value) }
            .sorted { $0.value.localizedCaseInsensitiveCompare($1.value) == .orderedAscending }
    }

    /// Every song that exists on the device, without duplicates.
    var downloadedSongs: [Song] {
        var seen = Set<String>()
        var result: [Song] = []
        for item in downloads.items {
            for song in item.songs where seen.insert(song.id).inserted {
                result.append(song)
            }
        }
        return result
    }

    // MARK: - Convenience

    func coverURL(_ id: String?, size: Int = 300) -> URL? {
        client?.coverURL(id: id, size: size)
    }

    /// Offline artwork wins over the server so downloaded collections keep
    /// their covers without a connection.
    func artworkURL(_ id: String?, size: Int = 300) -> URL? {
        guard let id, !id.isEmpty else { return nil }
        if id.hasPrefix("abs:") {
            let bookID = id.split(separator: ":").dropFirst().first.map(String.init)
            return bookID.flatMap { abs?.coverURL(itemID: $0, width: size) }
        }
        // Offline covers are checked first (cheap) so a finished download wins
        // over a previously cached server URL.
        if let local = downloads.localCoverURL(coverArt: id) { return local }
        let key = "\(id)#\(size)"
        if let hit = artworkCache[key] { return hit }
        let url = client?.coverURL(id: id, size: size)
        if let url { artworkCache[key] = url }
        return url
    }

    var appVersion: String {
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String
        let build = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String
        return "\(version ?? "1.0") (\(build ?? "1"))"
    }
}

/// The start screen rows, kept so returning to it does not reload everything.
struct HomeSnapshot {
    var newest: [Album]
    var recent: [Album]
    var frequent: [Album]
    var random: [Album]
    var loadedAt: Date = Date()

    var isFresh: Bool { Date().timeIntervalSince(loadedAt) < 60 }
}

/// Podcast channels and the newest episodes, cached between tab switches.
struct PodcastSnapshot {
    var channels: [PodcastChannel]
    var newest: [PodcastEpisode]
    var loadedAt: Date = Date()

    var isFresh: Bool { Date().timeIntervalSince(loadedAt) < 15 * 60 }
}
