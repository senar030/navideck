import CryptoKit
import Foundation

/// How a server wants to be told who is calling. Navidrome and most Subsonic
/// servers take a salted token; Nextcloud Music only accepts the password.
enum SubsonicAuth: String, Codable, CaseIterable, Sendable {
    case token
    case password

    var label: String {
        switch self {
        case .token: return "Token (Standard)"
        case .password: return "Passwort (Nextcloud Music)"
        }
    }
}

struct SubsonicFailure: LocalizedError, Sendable {
    let code: Int
    let message: String

    var errorDescription: String? { message }
}

enum AlbumListType: String, Sendable {
    case newest
    case recent
    case frequent
    case random
    case starred
    case alphabeticalByName
    case byGenre
}

/// A small, stateless Subsonic client. Caching belongs to the views (and the
/// URL cache for artwork), so every instance can be handed around freely.
struct SubsonicClient: Sendable {
    static let apiVersion = "1.16.1"
    static let clientName = "Navideck"
    static let pageSize = 48

    let baseURL: URL
    let username: String
    let auth: SubsonicAuth

    private let salt: String
    private let token: String
    private let password: String

    /// Restricts requests to one music folder when a library was assigned.
    var musicFolderId: String?

    private static let session: URLSession = {
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = 20
        configuration.timeoutIntervalForResource = 120
        configuration.requestCachePolicy = .useProtocolCachePolicy
        return URLSession(configuration: configuration)
    }()

    init(baseURL: URL, username: String, password: String, auth: SubsonicAuth) {
        self.baseURL = baseURL
        self.username = username
        self.password = password
        self.auth = auth
        let salt = Self.randomSalt()
        self.salt = salt
        self.token = Self.md5(password + salt)
    }

    // MARK: - URLs

    func coverURL(id: String?, size: Int = 300) -> URL? {
        guard let id, !id.isEmpty else { return nil }
        return url(for: "getCoverArt", extra: ["id": id, "size": String(size)])
    }

    func streamURL(id: String, maxBitRate: Int = 0) -> URL? {
        var extra = ["id": id]
        if maxBitRate > 0 { extra["maxBitRate"] = String(maxBitRate) }
        return url(for: "stream", extra: extra)
    }

    private func url(for method: String, extra: [String: String] = [:]) -> URL? {
        let endpoint = baseURL
            .appendingPathComponent("rest")
            .appendingPathComponent("\(method).view")

        guard var components = URLComponents(url: endpoint, resolvingAgainstBaseURL: false) else {
            return nil
        }

        var items: [URLQueryItem] = []
        switch auth {
        case .token:
            items.append(URLQueryItem(name: "u", value: username))
            items.append(URLQueryItem(name: "t", value: token))
            items.append(URLQueryItem(name: "s", value: salt))
        case .password:
            items.append(URLQueryItem(name: "u", value: username))
            items.append(URLQueryItem(name: "p", value: "enc:" + Self.hex(password)))
        }
        items.append(URLQueryItem(name: "v", value: Self.apiVersion))
        items.append(URLQueryItem(name: "c", value: Self.clientName))
        items.append(URLQueryItem(name: "f", value: "json"))
        for (key, value) in extra.sorted(by: { $0.key < $1.key }) {
            items.append(URLQueryItem(name: key, value: value))
        }

        components.queryItems = items
        return components.url
    }

    // MARK: - Core request

    private struct Envelope: Decodable {
        let response: SubsonicResponse
        enum CodingKeys: String, CodingKey {
            case response = "subsonic-response"
        }
    }

    private func request(_ method: String, _ extra: [String: String] = [:]) async throws -> SubsonicResponse {
        var parameters = extra
        if let musicFolderId, parameters["musicFolderId"] == nil {
            parameters["musicFolderId"] = musicFolderId
        }
        guard let url = url(for: method, extra: parameters) else {
            throw SubsonicFailure(code: -1, message: "Ungültige Server-Adresse.")
        }

        var request = URLRequest(url: url)
        request.timeoutInterval = 20
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await Self.session.data(for: request)
        } catch let error as URLError {
            if error.code == .cancelled { throw CancellationError() }
            throw SubsonicFailure(code: -1, message: Self.message(for: error))
        } catch {
            throw SubsonicFailure(code: -1, message: error.localizedDescription)
        }

        if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
            switch http.statusCode {
            case 401, 403:
                throw SubsonicFailure(code: http.statusCode, message: "Der Server hat die Anmeldung abgelehnt.")
            case 404:
                throw SubsonicFailure(
                    code: 404,
                    message: "Keine Subsonic-API unter dieser Adresse. Prüfe die Server-URL."
                )
            default:
                throw SubsonicFailure(code: http.statusCode, message: "Server antwortete mit HTTP \(http.statusCode).")
            }
        }

        let envelope: Envelope
        do {
            envelope = try JSONDecoder().decode(Envelope.self, from: data)
        } catch {
            throw SubsonicFailure(
                code: -2,
                message: "Unerwartete Antwort des Servers. Stimmen URL und Subsonic-API?"
            )
        }

        let payload = envelope.response
        if payload.status == "failed" {
            let code = payload.error?.code ?? 0
            let message = payload.error?.message ?? "Anmeldung oder Anfrage fehlgeschlagen."
            throw SubsonicFailure(code: code, message: message)
        }
        return payload
    }

    private static func message(for error: URLError) -> String {
        switch error.code {
        case .notConnectedToInternet:
            return "Keine Internetverbindung."
        case .cannotFindHost, .dnsLookupFailed:
            return "Server nicht gefunden. Prüfe die Adresse."
        case .cannotConnectToHost:
            return "Server nicht erreichbar. Läuft Navidrome und ist er im Netzwerk sichtbar?"
        case .timedOut:
            return "Zeitüberschreitung beim Server. Prüfe Adresse und Netzwerk."
        case .secureConnectionFailed, .serverCertificateUntrusted:
            return "Die TLS-Verbindung ist fehlgeschlagen. Prüfe das Zertifikat des Servers."
        case .cancelled:
            return "Anfrage abgebrochen."
        default:
            return "Server nicht erreichbar: \(error.localizedDescription)"
        }
    }

    // MARK: - Connection

    func ping() async throws {
        _ = try await request("ping")
    }

    // MARK: - Albums

    func albumList(_ type: AlbumListType, offset: Int = 0, size: Int = pageSize) async throws -> [Album] {
        var params: [String: String] = [
            "type": type.rawValue,
            "size": String(size),
            "offset": String(offset),
        ]
        if type == .random {
            params.removeValue(forKey: "offset")
        }
        let response = try await request("getAlbumList2", params)
        return response.albumList2?.album ?? []
    }

    func albums(byGenre genre: String, offset: Int = 0, size: Int = pageSize) async throws -> [Album] {
        let response = try await request("getAlbumList2", [
            "type": AlbumListType.byGenre.rawValue,
            "genre": genre,
            "size": String(size),
            "offset": String(offset),
        ])
        return response.albumList2?.album ?? []
    }

    func album(id: String) async throws -> Album {
        let response = try await request("getAlbum", ["id": id])
        guard let album = response.album else {
            throw SubsonicFailure(code: -1, message: "Album nicht gefunden.")
        }
        return album
    }

    // MARK: - Artists

    func artistIndexes() async throws -> [ArtistIndex] {
        let response = try await request("getArtists")
        return response.artists?.index ?? []
    }

    func artist(id: String) async throws -> Artist {
        let response = try await request("getArtist", ["id": id])
        guard let artist = response.artist else {
            throw SubsonicFailure(code: -1, message: "Interpret nicht gefunden.")
        }
        return artist
    }

    func artistInfo(id: String) async throws -> ArtistInfo? {
        let response = try await request("getArtistInfo2", ["id": id])
        return response.artistInfo2
    }

    func topSongs(artist: String, count: Int = 20) async throws -> [Song] {
        let response = try await request("getTopSongs", [
            "artist": artist,
            "count": String(count),
        ])
        return response.topSongs?.song ?? []
    }

    // MARK: - Songs and genres

    func songs(byGenre genre: String, offset: Int = 0, count: Int = pageSize) async throws -> [Song] {
        let response = try await request("getSongsByGenre", [
            "genre": genre,
            "offset": String(offset),
            "count": String(count),
        ])
        return response.songsByGenre?.song ?? []
    }

    func randomSongs(size: Int = 50, genre: String? = nil) async throws -> [Song] {
        var params = ["size": String(size)]
        if let genre, !genre.isEmpty { params["genre"] = genre }
        let response = try await request("getRandomSongs", params)
        return response.randomSongs?.song ?? []
    }

    func genres() async throws -> [Genre] {
        let response = try await request("getGenres")
        return response.genres?.genre ?? []
    }

    // MARK: - Radio and podcasts

    func radioStations() async throws -> [RadioStation] {
        let response = try await request("getInternetRadioStations")
        return response.internetRadioStations?.station ?? []
    }

    func podcasts() async throws -> [PodcastChannel] {
        let response = try await request("getPodcasts")
        return response.podcasts?.channel ?? []
    }

    func newestPodcasts(count: Int = 24) async throws -> [PodcastEpisode] {
        let response = try await request("getNewestPodcasts", ["count": String(count)])
        return response.newestPodcasts?.episode ?? []
    }

    // MARK: - Playlists

    func musicFolders() async throws -> [MusicFolder] {
        let response = try await request("getMusicFolders")
        return response.musicFolders?.musicFolder ?? []
    }

    /// Whether the server actually offers podcasts. Navidrome, for example,
    /// returns an empty list or an error here.
    func hasPodcasts() async -> Bool {
        do {
            let channels = try await podcasts()
            return !channels.isEmpty
        } catch let failure as SubsonicFailure where failure.code == 30 || failure.code == 0 {
            return false
        } catch {
            return false
        }
    }

    func playlists() async throws -> [Playlist] {
        let response = try await request("getPlaylists")
        return response.playlists?.playlist ?? []
    }

    func playlist(id: String) async throws -> Playlist {
        let response = try await request("getPlaylist", ["id": id])
        guard let playlist = response.playlist else {
            throw SubsonicFailure(code: -1, message: "Playlist nicht gefunden.")
        }
        return playlist
    }

    // MARK: - Search and favorites

    func search(_ query: String) async throws -> SearchResult {
        let response = try await request("search3", [
            "query": query,
            "artistCount": "20",
            "albumCount": "40",
            "songCount": "100",
        ])
        let block = response.searchResult3
        return SearchResult(
            artists: unique(block?.artist ?? [], by: { $0.id }),
            albums: unique(block?.album ?? [], by: { $0.id }),
            songs: unique(block?.song ?? [], by: { $0.id })
        )
    }

    func starred() async throws -> SearchResult {
        let response = try await request("getStarred2")
        let block = response.starred2
        return SearchResult(
            artists: block?.artist ?? [],
            albums: block?.album ?? [],
            songs: block?.song ?? []
        )
    }

    func star(id: String, kind: String = "id") async throws {
        _ = try await request("star", [kind: id])
    }

    func unstar(id: String, kind: String = "id") async throws {
        _ = try await request("unstar", [kind: id])
    }

    // MARK: - Playback bookkeeping

    func scrobble(id: String, submission: Bool) async {
        _ = try? await request("scrobble", [
            "id": id,
            "submission": submission ? "true" : "false",
        ])
    }

    // MARK: - Helpers

    private func unique<T>(_ items: [T], by key: (T) -> String) -> [T] {
        var seen = Set<String>()
        var result: [T] = []
        for item in items where seen.insert(key(item)).inserted {
            result.append(item)
        }
        return result
    }

    private static func md5(_ value: String) -> String {
        Insecure.MD5.hash(data: Data(value.utf8))
            .map { String(format: "%02x", $0) }
            .joined()
    }

    private static func hex(_ value: String) -> String {
        Data(value.utf8).map { String(format: "%02x", $0) }.joined()
    }

    private static func randomSalt() -> String {
        var bytes = [UInt8](repeating: 0, count: 8)
        for index in bytes.indices {
            bytes[index] = UInt8.random(in: 0...255)
        }
        return bytes.map { String(format: "%02x", $0) }.joined()
    }
}
