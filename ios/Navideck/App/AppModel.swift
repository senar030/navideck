import AVFoundation
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
    private(set) var absAuthors: [AudiobookshelfClient.Author] = []
    private(set) var absProgress: [String: AbsProgress] = [:]
    private(set) var absLoading = false
    var absError: String?
    @ObservationIgnored private var absLoadedAt: Date?
    @ObservationIgnored private var absTrackURLs: [String: URL] = [:]
    @ObservationIgnored private var absTrackAssets: [String: AVURLAsset] = [:]
    @ObservationIgnored private var absTrackBooks: [String: (bookID: String, offset: Double, duration: Double)] = [:]
    @ObservationIgnored private var lastABSSync = Date.distantPast
    /// Saved position that is currently being restored; early progress reports
    /// before the seek lands are ignored so they cannot overwrite it.
    @ObservationIgnored private var absResumeTargets: [String: (target: Double, since: Date)] = [:]
    /// Books whose progress changed on this device recently. A server refresh
    /// must not replace these with an older value.
    @ObservationIgnored private var absProgressTouched: [String: Date] = [:]

    /// Set by the player's menu so the active tab can push the destination.
    var pendingRoute: LibraryRoute?
    /// Switches the visible tab, e.g. from a quick-access link on Start.
    var pendingTab: Int?
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
    /// Bumped whenever a favourite changed, so lists can refresh themselves.
    var favoritesRevision = 0
    /// Episodes played from Audiobookshelf, newest first.
    private(set) var playedEpisodes: [PlayedEpisode] = []
    @ObservationIgnored private var absEpisodeIDs: Set<String> = []
    @ObservationIgnored private var lastEpisodeSync = Date.distantPast
    private static let playedEpisodesKey = "navideck.played-episodes.v1"

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

        player.onFavoriteChange = { [weak self] in
            self?.favoritesRevision += 1
        }

        player.localURL = { [weak downloads] songID in
            downloads?.localURL(songID: songID)
        }
        player.streamBitRate = { [weak prefs] in
            prefs?.maxBitRate ?? 0
        }
        player.progressSink = { [weak self] song, position, duration, force in
            guard let self else { return }
            if self.episodeIDs.contains(song.id) {
                self.episodeProgress.record(id: song.id, position: position, duration: duration)
                return
            }
            if self.absEpisodeIDs.contains(song.id) {
                self.updatePlayedEpisode(song: song, position: position, duration: duration, force: force)
                return
            }
            self.handleAudiobookProgress(song: song, position: position, force: force)
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
        player.externalAssetResolver = { [weak self] song in
            self?.absAsset(for: song)
        }

        loadStoredLibraries()
        applySelection()
        loadPlayedEpisodes()

        if libraries.isEmpty, !servers.profiles.isEmpty {
            Task { @MainActor in
                await refreshLibraries()
            }
        }

        if ProcessInfo.processInfo.environment["NAVIDECK_DEMO_PICK_LIBS"] == "1" {
            Task { @MainActor in
                await refreshLibraries()
                if let music = libraries(for: .music).first {
                    setSourceValue(music.key, for: .music)
                }
                if let books = libraries(for: .audiobooks).first {
                    setSourceValue(books.key, for: .audiobooks)
                }
                if let pods = libraries(for: .podcasts).first {
                    setSourceValue(pods.key, for: .podcasts)
                }
            }
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
                applySelection()
            }
        }

        if let section = ProcessInfo.processInfo.environment["NAVIDECK_DEMO_MUSIK_SECTION"] {
            UserDefaults.standard.set(Int(section) ?? 0, forKey: "navideck.musik-section")
        }

        if let offline = ProcessInfo.processInfo.environment["NAVIDECK_DEMO_OFFLINE"] {
            prefs.offlineMode = offline == "1"
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
            Task { @MainActor in await refreshLibraries() }
            if ProcessInfo.processInfo.environment["NAVIDECK_DEMO_PODCAST_ABS"] == "1" {
                prefs.podcastSource = profile.id.uuidString
            }
        }

        if ProcessInfo.processInfo.environment["NAVIDECK_DEMO_PLAYEP"] == "1" {
            Task { @MainActor in
                await loadPodcasts(force: true)
                if let show = absPodcasts.first, let episode = show.media.episodes.first {
                    playAbsEpisode(episode, from: show)
                }
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

        if ProcessInfo.processInfo.environment["NAVIDECK_DEMO_DL_ABS"] == "1" {
            Task { @MainActor in
                await loadAudiobooks()
                if let first = absBooks.first {
                    downloadAudiobook(first)
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
        auth: SubsonicAuth,
        name: String = ""
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

        let profile = servers.save(
            baseURL: url,
            username: user,
            password: password,
            auth: auth,
            name: name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : name,
            flavor: .subsonic
        )
        activate(profile, client: candidate)
        await refreshLibraries()
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
        applySelection()
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
        if profile.kind == .audiobookshelf {
            removeAudiobookshelf(profile)
            return
        }
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

            var channels: [PodcastChannel]
            do {
                channels = try await channelsTask
            } catch let failure as SubsonicFailure where failure.code == 30 || failure.code == 0 {
                channels = []
            }

            // Fill in episodes the list response left out.
            for index in channels.indices where channels[index].episodes.isEmpty {
                if let full = try? await client.podcastChannel(id: channels[index].id) {
                    channels[index] = full
                }
            }

            var newest = (try? await newestTask) ?? []
            if newest.isEmpty {
                newest = channels
                    .flatMap(\.episodes)
                    .sorted { ($0.publishDate ?? "") > ($1.publishDate ?? "") }
            }
            return PodcastSnapshot(channels: channels, newest: Array(newest.prefix(24)))
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

    /// Audiobook that owns a player song, if any.
    func audiobook(for song: Song) -> AbsBook? {
        guard let meta = absTrackBooks[song.id] else { return nil }
        return absBooks.first { $0.id == meta.bookID }
    }

    func openAudiobookDetail(_ book: AbsBook) {
        player.showNowPlaying = false
        pendingRoute = .audiobook(book)
    }

    func openAudiobookAuthor(_ book: AbsBook) {
        guard let name = book.media.metadata.resolvedAuthor else { return }
        player.showNowPlaying = false
        pendingRoute = .audioAuthor(name)
    }

    func openAudiobookSeries(_ book: AbsBook) {
        guard let series = book.media.metadata.seriesTitle, !series.isEmpty else { return }
        player.showNowPlaying = false
        pendingRoute = .audioSeries(series)
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

    /// Raw selection per category: "" (automatic), "off" or a MediaLibrary.key.
    func sourceValue(for category: Category) -> String {
        switch category {
        case .music: return prefs.musicSource
        case .podcasts: return prefs.podcastSource
        case .audiobooks: return prefs.audiobookSource
        }
    }

    func setSourceValue(_ value: String, for category: Category) {
        switch category {
        case .music: prefs.musicSource = value
        case .podcasts: prefs.podcastSource = value
        case .audiobooks: prefs.audiobookSource = value
        }
        applySelection()
    }

    /// Libraries discovered on the connected servers, persisted so the picker
    /// works before the next refresh.
    private(set) var libraries: [MediaLibrary] = []
    @ObservationIgnored private var librariesLoaded = false

    private static let librariesKey = "navideck.libraries.v1"

    func libraries(for category: Category) -> [MediaLibrary] {
        let type: String
        switch category {
        case .music: type = "music"
        case .podcasts: type = "podcast"
        case .audiobooks: type = "book"
        }
        return libraries
            .filter { $0.mediaType == type }
            .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }

    /// Reads music folders and Audiobookshelf libraries from every connection.
    func refreshLibraries() async {
        var found: [MediaLibrary] = []

        for profile in servers.profiles {
            switch profile.kind {
            case .subsonic:
                guard let client = servers.makeClient(for: profile) else { continue }
                let folders = (try? await client.musicFolders()) ?? []
                for folder in folders where !folder.id.isEmpty {
                    found.append(MediaLibrary(
                        serverID: profile.id,
                        id: folder.id,
                        name: folder.name.isEmpty ? profile.displayName : folder.name,
                        mediaType: "music"
                    ))
                }
                // Only offer a podcast source if the server really has one.
                if await client.hasPodcasts() {
                    found.append(MediaLibrary(
                        serverID: profile.id,
                        id: "__server__",
                        name: "Podcasts",
                        mediaType: "podcast"
                    ))
                }
            case .audiobookshelf:
                guard let client = servers.makeAudiobookshelfClient(for: profile) else { continue }
                let libs = (try? await client.libraries()) ?? []
                for library in libs {
                    guard library.mediaType == "book" || library.mediaType == "podcast" else { continue }
                    found.append(MediaLibrary(
                        serverID: profile.id,
                        id: library.id,
                        name: library.name,
                        mediaType: library.mediaType == "book" ? "book" : "podcast"
                    ))
                }
            }
        }

        libraries = found
        librariesLoaded = true
        persistLibraries()
        applySelection()
    }

    private func persistLibraries() {
        guard let data = try? JSONEncoder().encode(libraries) else { return }
        UserDefaults.standard.set(data, forKey: Self.librariesKey)
    }

    private func loadStoredLibraries() {
        guard let data = UserDefaults.standard.data(forKey: Self.librariesKey),
              let stored = try? JSONDecoder().decode([MediaLibrary].self, from: data) else { return }
        libraries = stored
        librariesLoaded = true
    }

    // MARK: Category resolution

    struct CategorySelection {
        var off: Bool = false
        var library: MediaLibrary?
        var profile: ServerProfile?
    }

    func selection(for category: Category) -> CategorySelection {
        let raw = sourceValue(for: category)
        if raw == "off" { return CategorySelection(off: true) }

        if let library = libraries.first(where: { $0.key == raw }),
           let profile = servers.profiles.first(where: { $0.id == library.serverID }) {
            return CategorySelection(library: library, profile: profile)
        }

        // Automatic: first matching library on a connected server.
        if let library = libraries(for: category).first(where: { candidate in
            guard let profile = servers.profiles.first(where: { $0.id == candidate.serverID }) else { return false }
            return profile.kind == .audiobookshelf ? abs != nil : client != nil
        }), let profile = servers.profiles.first(where: { $0.id == library.serverID }) {
            return CategorySelection(library: library, profile: profile)
        }

        return CategorySelection()
    }

    var musicAvailable: Bool {
        let selection = selection(for: .music)
        return !selection.off && selection.profile?.kind == .subsonic && client != nil
    }

    var audiobooksAvailable: Bool {
        let selection = selection(for: .audiobooks)
        return !selection.off && selection.profile?.kind == .audiobookshelf && abs != nil
    }

    enum PodcastBackend: Equatable { case subsonic, audiobookshelf, none }

    var podcastBackend: PodcastBackend {
        let selection = selection(for: .podcasts)
        if selection.off { return .none }
        switch selection.profile?.kind {
        case .audiobookshelf: return abs != nil ? .audiobookshelf : .none
        case .subsonic: return client != nil ? .subsonic : .none
        case nil: return .none
        }
    }

    var podcastsAvailable: Bool { podcastBackend != .none }

    /// Music folder the active Subsonic client has to restrict itself to.
    var selectedMusicFolderID: String? {
        let selection = selection(for: .music)
        guard let library = selection.library,
              library.mediaType == "music",
              library.id != "__server__",
              selection.profile?.id == servers.activeID else { return nil }
        return library.id
    }

    /// Audiobookshelf libraries assigned to a category (all matching on auto).
    func absLibraryIDs(for category: Category) -> [String] {
        let selection = selection(for: category)
        if let library = selection.library, selection.profile?.kind == .audiobookshelf {
            return [library.id]
        }
        if selection.off { return [] }
        return libraries(for: category)
            .filter { library in
                servers.profiles.first(where: { $0.id == library.serverID })?.kind == .audiobookshelf
            }
            .map(\.id)
    }

    /// Applies the music-library choice to the connected Subsonic client.
    func applySelection() {
        guard let profile = servers.active, let base = servers.makeClient(for: profile) else { return }
        var updated = base
        updated.musicFolderId = selectedMusicFolderID
        if client?.musicFolderId != updated.musicFolderId || client == nil {
            client = updated
            player.configure(client: updated, profileID: profile.id)
        }
    }

    // MARK: - Audiobookshelf

    /// One entry point for the guided "add connection" flow.
    func addConnection(
        flavor: ServerFlavor,
        name: String,
        urlText: String,
        username: String,
        secret: String
    ) async throws {
        guard let url = Format.serverURL(urlText) else {
            throw SubsonicFailure(code: -1, message: "Bitte eine gültige Server-Adresse eingeben.")
        }
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)

        switch flavor {
        case .navidrome, .subsonic, .subsonicLegacy:
            let user = username.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !user.isEmpty, !secret.isEmpty else {
                throw SubsonicFailure(code: -1, message: "Bitte Benutzername und Passwort eingeben.")
            }
            let candidate = SubsonicClient(
                baseURL: url,
                username: user,
                password: secret,
                auth: flavor.auth
            )
            try await candidate.ping()
            let profile = servers.save(
                baseURL: url,
                username: user,
                password: secret,
                auth: flavor.auth,
                name: trimmedName,
                flavor: flavor
            )
            activate(profile, client: candidate)

        case .audiobookshelf:
            let token = secret.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !token.isEmpty else {
                throw AudiobookshelfFailure(message: "Bitte den API-Token eingeben.")
            }
            let candidate = AudiobookshelfClient(baseURL: url, token: token)
            _ = try await candidate.libraries()
            let profile = servers.saveAudiobookshelf(baseURL: url, token: token, name: trimmedName)
            activateAudiobookshelf(profile, client: candidate)
        }
    }

    /// Audiobookshelf with account login instead of a token.
    func addAudiobookshelfLogin(
        name: String,
        urlText: String,
        username: String,
        password: String
    ) async throws {
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
        let profile = servers.saveAudiobookshelf(
            baseURL: url,
            token: token,
            name: name.trimmingCharacters(in: .whitespacesAndNewlines)
        )
        activateAudiobookshelf(profile, client: client)
    }

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
        guard abs != nil else { return }
        if libraries.isEmpty {
            await refreshLibraries()
        }
        guard let abs else { return }
        if !force, let loaded = absLoadedAt,
           Date().timeIntervalSince(loaded) < 300, !absBooks.isEmpty {
            return
        }
        absLoading = true
        absError = nil
        do {
            let libraries = try await abs.libraries()
            let selected = Set(absLibraryIDs(for: .audiobooks))
            var items: [AbsBook] = []
            var authors: [AudiobookshelfClient.Author] = []
            for library in libraries where library.mediaType == "book"
                && (selected.isEmpty || selected.contains(library.id)) {
                if let page = try? await abs.books(libraryID: library.id, page: 0, limit: 150) {
                    items.append(contentsOf: page)
                }
                if let page = try? await abs.authors(libraryID: library.id) {
                    authors.append(contentsOf: page)
                }
            }
            var seen = Set<String>()
            absBooks = items
                .filter { seen.insert($0.id).inserted }
                .sorted { ($0.addedAt ?? 0) > ($1.addedAt ?? 0) }

            var seenAuthors = Set<String>()
            absAuthors = authors
                .filter { seenAuthors.insert($0.id).inserted }
                .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }

            let progress = (try? await abs.progress()) ?? []
            var merged = Dictionary(
                progress.map { ($0.libraryItemId, $0) },
                uniquingKeysWith: { first, _ in first }
            )
            // Keep this device's recent positions; a slow server response must
            // not make an audiobook jump backwards in "Weiterhören".
            for (id, touched) in absProgressTouched
            where Date().timeIntervalSince(touched) < 300 {
                if let local = absProgress[id] { merged[id] = local }
            }
            absProgress = merged
            absLoadedAt = Date()
        } catch is CancellationError {
        } catch let error as URLError where error.code == .cancelled {
        } catch {
            absError = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
        absLoading = false
    }

    // MARK: Audiobookshelf podcasts

    private(set) var absPodcasts: [AbsBook] = []
    @ObservationIgnored private var absPodcastsLoadedAt: Date?

    func loadPodcasts(force: Bool = false) async {
        guard abs != nil else { return }
        if libraries.isEmpty {
            await refreshLibraries()
        }
        guard let abs else { return }
        if !force, let loaded = absPodcastsLoadedAt,
           Date().timeIntervalSince(loaded) < 300, !absPodcasts.isEmpty {
            return
        }
        do {
            let libraries = try await abs.libraries()
            let selected = Set(absLibraryIDs(for: .podcasts))
            var shows: [AbsBook] = []
            for library in libraries where library.mediaType == "podcast"
                && (selected.isEmpty || selected.contains(library.id)) {
                if let page = try? await abs.books(libraryID: library.id, page: 0, limit: 100) {
                    shows.append(contentsOf: page)
                }
            }
            var seen = Set<String>()
            let unique = shows.filter { seen.insert($0.id).inserted }
            absPodcasts = unique.sorted { ($0.addedAt ?? 0) > ($1.addedAt ?? 0) }
            absPodcastsLoadedAt = Date()
            if let progress = try? await abs.progress() {
                seedPlayedEpisodes(from: progress)
            }
        } catch is CancellationError {
        } catch let error as URLError where error.code == .cancelled {
        } catch {
            absError = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }

    /// Episode count for list rows, even when the list omitted the episodes.
    func episodeCount(_ show: AbsBook) -> Int {
        show.media.episodes.isEmpty ? (show.media.numEpisodes ?? 0) : show.media.episodes.count
    }

    /// Loads missing episode lists with limited concurrency instead of one
    /// request after another. `limit` caps how many shows are fetched.
    func loadPodcastEpisodes(limit: Int? = nil) async {
        guard let abs else { return }
        var pending = absPodcasts.indices.filter { absPodcasts[$0].media.episodes.isEmpty }
        if let limit { pending = Array(pending.prefix(limit)) }
        guard !pending.isEmpty else { return }

        await withTaskGroup(of: (Int, AbsBook?).self) { group in
            var iterator = pending.makeIterator()
            let width = min(4, pending.count)
            for _ in 0..<width {
                guard let index = iterator.next() else { break }
                let showID = absPodcasts[index].id
                group.addTask {
                    (index, try? await abs.item(id: showID))
                }
            }
            while let (index, full) = await group.next() {
                if let full, !full.media.episodes.isEmpty,
                   absPodcasts.indices.contains(index) {
                    absPodcasts[index] = full
                }
                if let next = iterator.next() {
                    let showID = absPodcasts[next].id
                    group.addTask {
                        (next, try? await abs.item(id: showID))
                    }
                }
            }
        }

        if let progress = try? await abs.progress() {
            seedPlayedEpisodes(from: progress)
        }
    }

    /// Full show with episodes; list responses often omit them.
    func fullShow(_ show: AbsBook) async -> AbsBook? {
        guard let abs else { return nil }
        if !show.media.episodes.isEmpty { return show }
        guard let full = try? await abs.item(id: show.id), !full.media.episodes.isEmpty else {
            return show
        }
        if let index = absPodcasts.firstIndex(where: { $0.id == full.id }) {
            absPodcasts[index] = full
        }
        return full
    }

    /// Seeds "Weiterhören" from the server progress so episodes heard on other
    /// devices show up too.
    private func seedPlayedEpisodes(from progress: [AbsProgress]) {
        var changed = false
        for entry in progress {
            guard let episodeID = entry.episodeId,
                  entry.isFinished != true,
                  entry.currentTime > 3,
                  let show = absPodcasts.first(where: { $0.id == entry.libraryItemId }),
                  let episode = show.media.episodes.first(where: { $0.id == episodeID }),
                  let ino = episode.audioFile?.ino, !ino.isEmpty else { continue }

            let songID = "abs:\(show.id):\(ino)"
            if let index = playedEpisodes.firstIndex(where: { $0.id == songID }) {
                if playedEpisodes[index].position < entry.currentTime {
                    playedEpisodes[index].position = entry.currentTime
                    changed = true
                }
            } else {
                playedEpisodes.append(
                    PlayedEpisode(
                        id: songID,
                        episodeID: episode.id,
                        showID: show.id,
                        title: episode.title,
                        showTitle: show.media.metadata.title,
                        coverArt: "abs:\(show.id)",
                        duration: entry.duration > 0 ? entry.duration : (episode.runtime ?? 0),
                        position: entry.currentTime,
                        updated: Date()
                    )
                )
                absEpisodeIDs.insert(songID)
                changed = true
            }
        }
        if changed {
            playedEpisodes.sort { $0.updated > $1.updated }
            persistPlayedEpisodes()
        }
    }

    // MARK: Played episodes

    private func loadPlayedEpisodes() {
        guard let data = UserDefaults.standard.data(forKey: Self.playedEpisodesKey),
              let stored = try? JSONDecoder().decode([PlayedEpisode].self, from: data) else { return }
        playedEpisodes = stored
        absEpisodeIDs = Set(stored.map(\.id))
    }

    private func persistPlayedEpisodes() {
        guard let data = try? JSONEncoder().encode(playedEpisodes) else { return }
        UserDefaults.standard.set(data, forKey: Self.playedEpisodesKey)
    }

    private func markEpisodePlayed(_ episode: AbsEpisode, show: AbsBook, songID: String) {
        absEpisodeIDs.insert(songID)
        if let index = playedEpisodes.firstIndex(where: { $0.id == songID }) {
            playedEpisodes[index].updated = Date()
        } else {
            playedEpisodes.insert(
                PlayedEpisode(
                    id: songID,
                    episodeID: episode.id,
                    showID: show.id,
                    title: episode.title,
                    showTitle: show.media.metadata.title,
                    coverArt: "abs:\(show.id)",
                    duration: episode.duration ?? 0,
                    position: 0,
                    updated: Date()
                ),
                at: 0
            )
        }
        playedEpisodes.sort { $0.updated > $1.updated }
        persistPlayedEpisodes()
    }

    private func updatePlayedEpisode(song: Song, position: Double, duration: Double, force: Bool) {
        guard let index = playedEpisodes.firstIndex(where: { $0.id == song.id }) else { return }
        playedEpisodes[index].position = position
        playedEpisodes[index].duration = max(playedEpisodes[index].duration, duration)
        playedEpisodes[index].updated = Date()
        persistPlayedEpisodes()

        let now = Date()
        guard force || now.timeIntervalSince(lastEpisodeSync) > 10 else { return }
        lastEpisodeSync = now
        guard let abs else { return }
        let entry = playedEpisodes[index]
        Task {
            await abs.pushProgress(
                itemID: entry.showID,
                currentTime: position,
                duration: entry.duration,
                finished: entry.isFinished,
                episodeID: entry.episodeID
            )
        }
    }

    /// Episodes that were started but not finished, most recent first.
    var podcastContinue: [PlayedEpisode] {
        playedEpisodes.filter { !$0.isFinished && $0.position > 3 }
    }

    /// All Audiobookshelf episodes, newest first.
    var podcastLatest: [(show: AbsBook, episode: AbsEpisode)] {
        absPodcasts
            .flatMap { show in show.media.episodes.map { (show, $0) } }
            .sorted { ($0.1.publishedAt ?? 0) > ($1.1.publishedAt ?? 0) }
    }

    /// Resumes an episode from the local continue list.
    func resumePodcastEpisode(_ entry: PlayedEpisode) {
        guard let show = absPodcasts.first(where: { $0.id == entry.showID }),
              let episode = show.media.episodes.first(where: { $0.id == entry.episodeID }) else {
            return
        }
        playAbsEpisode(episode, from: show)
        if entry.position > 3 {
            player.seek(to: entry.position)
        }
    }

    /// Plays one Audiobookshelf podcast episode.
    func playAbsEpisode(_ episode: AbsEpisode, from show: AbsBook) {
        guard let abs, let ino = episode.audioFile?.ino, !ino.isEmpty else {
            player.errorMessage = "Für diese Folge ist keine Audiodatei hinterlegt."
            return
        }
        let songID = "abs:\(show.id):\(ino)"
        let contentUrl = "/api/items/\(show.id)/file/\(ino)"
        guard let asset = abs.playerAsset(contentUrl: contentUrl) else {
            player.errorMessage = "Die Folge konnte nicht geladen werden."
            return
        }
        absTrackAssets[songID] = asset
        absTrackURLs[songID] = abs.streamURL(contentUrl: contentUrl)
        absTrackBooks[songID] = (show.id, 0, episode.duration ?? 0)

        let song = Song(
            id: songID,
            title: episode.title,
            album: show.media.metadata.title,
            artist: show.media.metadata.resolvedAuthor,
            duration: episode.duration.map { Int($0.rounded()) },
            coverArt: absHasCover(show) ? "abs:\(show.id)" : nil
        )
        markEpisodePlayed(episode, show: show, songID: songID)
        player.play([song])
    }

    var audiobooksInProgress: [AbsBook] {
        absBooks
            .filter { book in
                if isPlayingAudiobook(book) { return true }
                guard let progress = absProgress[book.id] else { return false }
                return progress.isFinished != true && progress.currentTime > 5
            }
            .sorted { left, right in
                let leftPlaying = isPlayingAudiobook(left)
                let rightPlaying = isPlayingAudiobook(right)
                if leftPlaying != rightPlaying { return leftPlaying }
                return (absProgress[left.id]?.currentTime ?? 0) > (absProgress[right.id]?.currentTime ?? 0)
            }
    }

    private func isPlayingAudiobook(_ book: AbsBook) -> Bool {
        player.current?.id.hasPrefix("abs:\(book.id):") == true
    }

    /// Biography for an author, fetched once from Audiobookshelf.
    func authorBio(name: String) async -> String? {
        if let local = absAuthorDescription(name) { return local }
        guard let abs else { return nil }
        let id = absBooks.first { $0.media.metadata.resolvedAuthor == name }?.media.metadata.authorID
            ?? absAuthors.first { $0.name == name }?.id
        guard let id, !id.isEmpty, let author = try? await abs.author(id: id) else { return nil }
        return Format.plainText(author.description)
    }

    /// Description that came with the author list, without another request.
    func absAuthorDescription(_ name: String) -> String? {
        Format.plainText(absAuthors.first { $0.name == name }?.description)
    }

    func authorImageURL(_ author: AudiobookshelfClient.Author) -> URL? {
        abs?.authorImageURL(id: author.id)
    }

    /// Only books that actually have artwork on the server get a cover URL;
    /// otherwise nil so the generated title cover is used.
    func absCoverURL(_ book: AbsBook, width: Int = 300) -> URL? {
        guard let path = book.media.coverPath, !path.isEmpty else { return nil }
        return abs?.coverURL(itemID: book.id, width: width)
    }

    func absHasCover(_ book: AbsBook) -> Bool {
        guard let path = book.media.coverPath else { return false }
        return !path.isEmpty
    }

    func audiobookProgress(_ book: AbsBook) -> Double {
        guard let progress = absProgress[book.id], progress.duration > 0 else { return 0 }
        return min(1, max(0, progress.currentTime / progress.duration))
    }

    /// Plays a book from the saved position, or from the given time. Library
    /// list items often ship without tracks, so the full item is fetched first
    /// when needed.
    func playAudiobook(_ book: AbsBook, from time: Double? = nil) {
        guard abs != nil else { return }
        if tracks(of: book).isEmpty {
            Task { @MainActor in
                if let full = await fullBook(book) {
                    startAudiobook(full, from: time)
                } else {
                    player.errorMessage = absError ?? "Das Hörbuch konnte nicht geladen werden."
                }
            }
            return
        }
        startAudiobook(book, from: time)
    }

    /// Loads tracks/chapters that the library list omitted and updates the cache.
    @discardableResult
    func fullBook(_ book: AbsBook) async -> AbsBook? {
        guard let abs else { return nil }
        // Only `tracks` carry the book-wide `startOffset` needed for correct
        // progress and resume; `audioFiles` alone is not enough.
        if !book.media.tracks.isEmpty { return book }

        do {
            let full = try await abs.item(id: book.id)
            guard !tracks(of: full).isEmpty else {
                absError = "Audiobookshelf liefert für dieses Buch keine Audiodateien."
                return nil
            }
            if let index = absBooks.firstIndex(where: { $0.id == full.id }) {
                absBooks[index] = full
            }
            return full
        } catch {
            absError = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
            return nil
        }
    }

    /// Track list for playback, falling back to `audioFiles` and to the
    /// conventional file URL when the server omits `contentUrl`.
    func tracks(of book: AbsBook) -> [AbsTrack] {
        if !book.media.tracks.isEmpty { return book.media.tracks }
        // Older servers only expose `audioFiles`; build cumulative offsets so
        // progress and resume still work across the whole book.
        var offset = 0.0
        return book.media.audioFiles.compactMap { file in
            guard !file.ino.isEmpty else { return nil }
            let duration = file.duration ?? 0
            let track = AbsTrack(
                ino: file.ino,
                startOffset: offset,
                duration: duration,
                contentUrl: "/api/items/\(book.id)/file/\(file.ino)"
            )
            offset += duration
            return track
        }
    }

    private func startAudiobook(_ book: AbsBook, from time: Double?) {
        guard let abs else { return }
        let tracks = tracks(of: book)
        guard !tracks.isEmpty else {
            player.errorMessage = "Für dieses Hörbuch sind keine Audiodateien hinterlegt."
            return
        }

        let saved = absProgress[book.id]
        var startTime = time ?? saved?.currentTime ?? 0
        if time == nil, saved?.isFinished == true { startTime = 0 }
        var songs: [Song] = []
        for (index, track) in tracks.enumerated() {
            let contentUrl = track.contentUrl.isEmpty
                ? "/api/items/\(book.id)/file/\(track.ino)"
                : track.contentUrl
            guard let url = abs.streamURL(contentUrl: contentUrl) else { continue }
            let title = tracks.count > 1
                ? "\(book.media.metadata.title) · Teil \(index + 1)"
                : book.media.metadata.title
            let song = Song(
                id: "abs:\(book.id):\(track.ino)",
                title: title,
                album: book.media.metadata.title,
                artist: book.media.metadata.resolvedAuthor,
                duration: Int(track.duration.rounded()),
                track: index + 1,
                coverArt: absHasCover(book) ? "abs:\(book.id)" : nil
            )
            absTrackURLs[song.id] = url
            absTrackAssets[song.id] = abs.playerAsset(contentUrl: contentUrl)
            absTrackBooks[song.id] = (book.id, track.startOffset, track.duration)
            songs.append(song)
        }
        guard !songs.isEmpty else { return }

        // Remember the position we are about to restore. The player reports a
        // few seconds from the start before the seek has landed; those reports
        // must not overwrite the saved progress.
        if startTime > 5 {
            absResumeTargets[book.id] = (startTime, Date())
        } else {
            absResumeTargets[book.id] = nil
        }

        var index = songs.count - 1
        var offset = 0.0
        for (position, song) in songs.enumerated() {
            guard let meta = absTrackBooks[song.id] else { continue }
            let end = meta.offset + meta.duration
            if startTime < end || position == songs.count - 1 {
                index = position
                offset = max(0, startTime - meta.offset)
                if meta.duration > 0 {
                    offset = min(offset, max(0, meta.duration - 1))
                }
                break
            }
        }
        player.play(songs, startingAt: index, resumeAt: offset)
    }

    /// Asset for a book track, prepared when playback starts so the derived
    /// stream URL and the auth header are known to match.
    func absAsset(for song: Song) -> AVURLAsset? {
        absTrackAssets[song.id]
    }

    private func handleAudiobookProgress(song: Song, position: Double, force: Bool) {
        guard let meta = absTrackBooks[song.id], let abs else { return }

        // While a saved position is being restored the player may report 0 for
        // a moment. Ignore those reports instead of losing the position.
        if let resume = absResumeTargets[meta.bookID] {
            let absolute = meta.offset + position
            if absolute >= resume.target - 3 || Date().timeIntervalSince(resume.since) > 20 {
                absResumeTargets[meta.bookID] = nil
            } else {
                return
            }
        }

        let book = absBooks.first(where: { $0.id == meta.bookID })
        let trackTotal = absTrackBooks.values
            .filter { $0.bookID == meta.bookID }
            .reduce(0) { $0 + $1.duration }
        let total: Double
        if let duration = book?.media.duration, duration > 0 {
            total = duration
        } else {
            total = trackTotal
        }

        var absolute = max(0, meta.offset + position)
        if total > 0 { absolute = min(absolute, total) }
        let finished = total > 0 && absolute >= total - 5

        // Local progress updates on every report (also when pausing), so
        // "Weiterhören" is right immediately; the server is synced less often.
        absProgress[meta.bookID] = AbsProgress(
            libraryItemId: meta.bookID,
            episodeId: nil,
            currentTime: absolute,
            duration: total,
            progress: total > 0 ? min(1, absolute / total) : 0,
            isFinished: finished
        )
        absProgressTouched[meta.bookID] = Date()

        let now = Date()
        guard force || now.timeIntervalSince(lastABSSync) > 10 else { return }
        lastABSSync = now
        Task {
            await abs.pushProgress(
                itemID: meta.bookID,
                currentTime: absolute,
                duration: total,
                finished: finished
            )
        }
    }

    // MARK: - Audiobook downloads

    var downloadedAudiobooks: [DownloadItem] {
        downloads.items.filter { $0.kind == .audiobook }
    }

    var downloadedPodcastEpisodes: [DownloadItem] {
        downloads.items.filter { $0.kind == .podcast }
    }

    func isAudiobookDownloaded(_ book: AbsBook) -> Bool {
        downloads.item(kind: .audiobook, sourceID: book.id) != nil
    }

    func audiobookDownloadProgress(_ book: AbsBook) -> Double? {
        downloads.progressValue(kind: .audiobook, sourceID: book.id)
    }

    func downloadAudiobook(_ book: AbsBook) {
        guard let abs else { return }
        Task { @MainActor in
            let full = await fullBook(book) ?? book
            let tracks = tracks(of: full)
            guard !tracks.isEmpty else {
                player.errorMessage = "Für dieses Hörbuch sind keine Audiodateien hinterlegt."
                return
            }
            var songs: [Song] = []
            var requests: [(song: Song, request: URLRequest)] = []
            for (index, track) in tracks.enumerated() {
                let contentUrl = track.contentUrl.isEmpty
                    ? "/api/items/\(full.id)/file/\(track.ino)"
                    : track.contentUrl
                guard let url = abs.streamURL(contentUrl: contentUrl) else { continue }
                let title = tracks.count > 1
                    ? "\(full.media.metadata.title) · Teil \(index + 1)"
                    : full.media.metadata.title
                let song = Song(
                    id: "abs:\(full.id):\(track.ino)",
                    title: title,
                    album: full.media.metadata.title,
                    artist: full.media.metadata.resolvedAuthor,
                    duration: Int(track.duration.rounded()),
                    track: index + 1,
                    coverArt: absHasCover(full) ? "abs:\(full.id)" : nil
                )
                songs.append(song)
                requests.append((song, abs.authorizedRequest(url)))
            }
            guard !songs.isEmpty else { return }

            var coverRequest: URLRequest?
            if let cover = abs.coverURL(itemID: full.id, width: 700) {
                coverRequest = abs.authorizedRequest(cover)
            }

            downloads.downloadExternal(
                kind: .audiobook,
                sourceID: full.id,
                title: full.media.metadata.title,
                subtitle: full.media.metadata.resolvedAuthor,
                coverArt: "abs:\(full.id)",
                songs: songs,
                requests: requests,
                coverRequest: coverRequest
            )
        }
    }

    func removeAudiobookDownload(_ book: AbsBook) {
        if let item = downloads.item(kind: .audiobook, sourceID: book.id) {
            downloads.delete(item)
        }
    }

    func downloadAbsEpisode(_ episode: AbsEpisode, from show: AbsBook) {
        guard let abs, let ino = episode.audioFile?.ino, !ino.isEmpty else { return }
        let contentUrl = "/api/items/\(show.id)/file/\(ino)"
        guard let url = abs.streamURL(contentUrl: contentUrl) else { return }
        let song = Song(
            id: "abs:\(show.id):\(ino)",
            title: episode.title,
            album: show.media.metadata.title,
            artist: show.media.metadata.resolvedAuthor,
            duration: episode.duration.map { Int($0.rounded()) },
            coverArt: absHasCover(show) ? "abs:\(show.id)" : nil
        )
        var coverRequest: URLRequest?
        if let cover = abs.coverURL(itemID: show.id, width: 700) {
            coverRequest = abs.authorizedRequest(cover)
        }
        downloads.downloadExternal(
            kind: .podcast,
            sourceID: episode.id,
            title: episode.title,
            subtitle: show.media.metadata.title,
            coverArt: "abs:\(show.id)",
            songs: [song],
            requests: [(song, abs.authorizedRequest(url))],
            coverRequest: coverRequest
        )
    }

    func removeAbsEpisodeDownload(_ episode: AbsEpisode) {
        if let item = downloads.item(kind: .podcast, sourceID: episode.id) {
            downloads.delete(item)
        }
    }

    func absEpisodeDownloaded(_ episode: AbsEpisode) -> Bool {
        downloads.item(kind: .podcast, sourceID: episode.id) != nil
    }

    func absEpisodeDownloadProgress(_ episode: AbsEpisode) -> Double? {
        downloads.progressValue(kind: .podcast, sourceID: episode.id)
    }

    /// Plays a downloaded book from the device.
    func playDownloadedAudiobook(_ item: DownloadItem) {
        guard !item.songs.isEmpty else { return }
        player.play(item.songs)
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

    /// Artists the device can play offline: downloaded artist collections plus
    /// everyone who appears on a downloaded album, playlist or song.
    var downloadedArtists: [Artist] {
        var order: [String] = []
        var artists: [String: Artist] = [:]
        var albumIDs: [String: Set<String>] = [:]

        func add(id: String, name: String, coverArt: String?, albumID: String?) {
            guard !name.isEmpty else { return }
            let key = id.isEmpty ? name.lowercased() : id
            if artists[key] == nil {
                artists[key] = Artist(id: key, name: name, coverArt: coverArt)
                order.append(key)
                albumIDs[key] = []
            }
            if artists[key]?.coverArt == nil, let coverArt {
                artists[key]?.coverArt = coverArt
            }
            if let albumID { albumIDs[key]?.insert(albumID) }
        }

        for item in downloads.items {
            if item.kind == .artist {
                add(id: item.sourceID, name: item.title, coverArt: item.coverArt, albumID: nil)
            }
            for song in item.songs {
                add(
                    id: song.artistId ?? "",
                    name: song.artist ?? "",
                    coverArt: song.coverArt ?? item.coverArt,
                    albumID: song.albumId
                )
            }
        }

        return order.compactMap { key in
            guard var artist = artists[key] else { return nil }
            artist.albumCount = albumIDs[key]?.count ?? 0
            return artist
        }
        .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
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

/// A podcast episode that was played on this device, used for "Weiterhören".
struct PlayedEpisode: Codable, Hashable, Identifiable {
    var id: String          // player song id
    var episodeID: String
    var showID: String
    var title: String
    var showTitle: String
    var coverArt: String?
    var duration: Double
    var position: Double
    var updated: Date

    var isFinished: Bool { duration > 0 && position >= duration - 5 }
    var progress: Double { duration > 0 ? min(1, position / duration) : 0 }
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
