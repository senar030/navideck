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

    private(set) var client: SubsonicClient?

    /// Set by the player's menu so the active tab can push the destination.
    var pendingRoute: LibraryRoute?
    /// Cached home rows keep the start screen instant between visits.
    var homeSnapshot: HomeSnapshot?

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

        if let profile = servers.active, let client = servers.makeClient(for: profile) {
            self.client = client
            player.configure(client: client, profileID: profile.id)
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
            guard let albums = try? await client.albumList(.newest, size: 2),
                  let first = albums.first else { return }
            guard let full = try? await client.album(id: first.id), !full.songs.isEmpty else { return }
            player.play(full.songs)
            if openPlayer {
                player.showNowPlaying = true
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
        pendingRoute = nil
        player.configure(client: client, profileID: profile.id)
    }

    func disconnect() {
        player.stop()
        servers.deactivate()
        client = nil
        homeSnapshot = nil
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

    /// Plays a podcast episode (Nextcloud Music keeps the audio in the library).
    func playEpisodes(_ episodes: [PodcastEpisode], startingAt index: Int = 0) {
        let songs = episodes.map(\.song)
        player.play(songs, startingAt: index)
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

    // MARK: - Convenience

    func coverURL(_ id: String?, size: Int = 300) -> URL? {
        client?.coverURL(id: id, size: size)
    }

    /// Offline artwork wins over the server so downloaded collections keep
    /// their covers without a connection.
    func artworkURL(_ id: String?, size: Int = 300) -> URL? {
        if let local = downloads.localCoverURL(coverArt: id) { return local }
        return client?.coverURL(id: id, size: size)
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
