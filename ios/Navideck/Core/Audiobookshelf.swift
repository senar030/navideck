import AVFoundation
import Foundation

// MARK: - Errors

struct AudiobookshelfFailure: LocalizedError, Sendable {
    let message: String
    var errorDescription: String? { message }
}

// MARK: - Models

struct AbsLibrary: Decodable, Identifiable, Hashable, Sendable {
    var id: String
    var name: String
    var mediaType: String

    enum CodingKeys: String, CodingKey {
        case id, name, mediaType
    }
}

private struct AbsLibrariesResponse: Decodable {
    var libraries: [AbsLibrary]
}

struct AbsAuthorRef: Decodable, Hashable, Sendable {
    var id: String
    var name: String

    enum CodingKeys: String, CodingKey { case id, name }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = (try? c.decodeIfPresent(String.self, forKey: .id)) ?? ""
        name = (try? c.decodeIfPresent(String.self, forKey: .name)) ?? ""
    }
}

struct AbsMetadata: Decodable, Hashable, Sendable {
    var title: String
    var subtitle: String?
    var authorName: String?
    var authors: [AbsAuthorRef]
    var narratorName: String?
    var seriesName: String?
    var seriesSequence: String?
    var genres: [String]?
    var description: String?
    var publishedYear: String?
    var language: String?

    enum CodingKeys: String, CodingKey {
        case title, subtitle, authorName, authors, narratorName, seriesName
        case seriesSequence, genres, description, publishedYear, language
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        title = (try? c.decodeIfPresent(String.self, forKey: .title)) ?? ""
        subtitle = try? c.decodeIfPresent(String.self, forKey: .subtitle)
        description = try? c.decodeIfPresent(String.self, forKey: .description)
        authorName = try? c.decodeIfPresent(String.self, forKey: .authorName)
        authors = (try? c.decodeIfPresent([AbsAuthorRef].self, forKey: .authors)) ?? []
        narratorName = try? c.decodeIfPresent(String.self, forKey: .narratorName)
        seriesName = try? c.decodeIfPresent(String.self, forKey: .seriesName)
        seriesSequence = try? c.decodeIfPresent(String.self, forKey: .seriesSequence)
        genres = try? c.decodeIfPresent([String].self, forKey: .genres)
        description = try? c.decodeIfPresent(String.self, forKey: .description)
        publishedYear = try? c.decodeIfPresent(String.self, forKey: .publishedYear)
        language = try? c.decodeIfPresent(String.self, forKey: .language)
    }

    /// Author name with fallback to the structured author list.
    var resolvedAuthor: String? {
        if let authorName, !authorName.isEmpty { return authorName }
        return authors.first?.name
    }

    var authorID: String? {
        authors.first(where: { !$0.id.isEmpty })?.id
    }
}

struct AbsChapter: Decodable, Hashable, Sendable, Identifiable {
    var start: Double
    var end: Double
    var title: String

    var id: Double { start }
}

struct AbsTrack: Decodable, Hashable, Sendable {
    var ino: String
    var index: Int?
    var startOffset: Double
    var duration: Double
    var contentUrl: String
    var title: String?

    enum CodingKeys: String, CodingKey {
        case ino, index, startOffset, duration, contentUrl, title
    }

    init(
        ino: String,
        index: Int? = nil,
        startOffset: Double = 0,
        duration: Double = 0,
        contentUrl: String = "",
        title: String? = nil
    ) {
        self.ino = ino
        self.index = index
        self.startOffset = startOffset
        self.duration = duration
        self.contentUrl = contentUrl
        self.title = title
    }

    /// Audiobookshelf versions differ: numbers may be strings, `startOffset`
    /// or `contentUrl` may be missing. A single malformed track used to discard
    /// the whole list, which is why nothing played.
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)

        if let value = try? c.decodeIfPresent(String.self, forKey: .ino) {
            ino = value
        } else if let value = try? c.decodeIfPresent(Int.self, forKey: .ino) {
            ino = String(value)
        } else {
            ino = ""
        }

        index = try? c.decodeIfPresent(Int.self, forKey: .index)
        title = try? c.decodeIfPresent(String.self, forKey: .title)
        contentUrl = (try? c.decodeIfPresent(String.self, forKey: .contentUrl)) ?? ""

        if let value = try? c.decodeIfPresent(Double.self, forKey: .startOffset) {
            startOffset = value
        } else if let value = try? c.decodeIfPresent(String.self, forKey: .startOffset),
                  let number = Double(value) {
            startOffset = number
        } else {
            startOffset = 0
        }

        if let value = try? c.decodeIfPresent(Double.self, forKey: .duration) {
            duration = value
        } else if let value = try? c.decodeIfPresent(String.self, forKey: .duration),
                  let number = Double(value) {
            duration = number
        } else {
            duration = 0
        }
    }
}

/// Older servers expose `audioFiles` only; they are enough to stream a book.
struct AbsAudioFile: Decodable, Hashable, Sendable {
    var ino: String
    var duration: Double?
    var mimeType: String?

    enum CodingKeys: String, CodingKey {
        case ino, duration, mimeType
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        if let value = try? c.decodeIfPresent(String.self, forKey: .ino) {
            ino = value
        } else if let value = try? c.decodeIfPresent(Int.self, forKey: .ino) {
            ino = String(value)
        } else {
            ino = ""
        }
        duration = try? c.decodeIfPresent(Double.self, forKey: .duration)
        mimeType = try? c.decodeIfPresent(String.self, forKey: .mimeType)
    }
}

struct AbsEpisodeFile: Decodable, Hashable, Sendable {
    var ino: String
    var duration: Double?

    enum CodingKeys: String, CodingKey { case ino, duration }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        if let value = try? c.decodeIfPresent(String.self, forKey: .ino) {
            ino = value
        } else if let value = try? c.decodeIfPresent(Int.self, forKey: .ino) {
            ino = String(value)
        } else {
            ino = ""
        }
        duration = try? c.decodeIfPresent(Double.self, forKey: .duration)
    }
}

struct AbsEpisode: Decodable, Hashable, Sendable, Identifiable {
    var id: String
    var title: String
    var subtitle: String?
    var description: String?
    var publishedAt: Double?
    var duration: Double?
    var audioFile: AbsEpisodeFile?

    enum CodingKeys: String, CodingKey {
        case id, title, subtitle, description, publishedAt, duration, audioFile
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = (try? c.decodeIfPresent(String.self, forKey: .id)) ?? UUID().uuidString
        title = (try? c.decodeIfPresent(String.self, forKey: .title)) ?? ""
        subtitle = try? c.decodeIfPresent(String.self, forKey: .subtitle)
        description = try? c.decodeIfPresent(String.self, forKey: .description)
        publishedAt = try? c.decodeIfPresent(Double.self, forKey: .publishedAt)
        duration = try? c.decodeIfPresent(Double.self, forKey: .duration)
        audioFile = try? c.decodeIfPresent(AbsEpisodeFile.self, forKey: .audioFile)
    }

    /// Podcast episodes sometimes carry the runtime on the audio file only.
    var runtime: Double? {
        if let duration, duration > 0 { return duration }
        return audioFile?.duration
    }

    var publishedText: String? {
        guard let publishedAt, publishedAt > 0 else { return nil }
        let date = Date(timeIntervalSince1970: publishedAt > 10_000_000_000 ? publishedAt / 1000 : publishedAt)
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "de_DE")
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter.string(from: date)
    }
}

struct AbsMedia: Decodable, Hashable, Sendable {
    var metadata: AbsMetadata
    var duration: Double
    var chapters: [AbsChapter]
    var tracks: [AbsTrack]
    var audioFiles: [AbsAudioFile]
    var episodes: [AbsEpisode]
    var numTracks: Int?
    var numEpisodes: Int?

    enum CodingKeys: String, CodingKey {
        case metadata, duration, chapters, tracks, audioFiles, episodes, numTracks, numEpisodes
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        metadata = (try? c.decodeIfPresent(AbsMetadata.self, forKey: .metadata)) ?? AbsMetadata.empty
        duration = (try? c.decodeIfPresent(Double.self, forKey: .duration)) ?? 0
        chapters = (try? c.decodeIfPresent([AbsChapter].self, forKey: .chapters)) ?? []
        tracks = (try? c.decodeIfPresent([AbsTrack].self, forKey: .tracks)) ?? []
        audioFiles = (try? c.decodeIfPresent([AbsAudioFile].self, forKey: .audioFiles)) ?? []
        episodes = (try? c.decodeIfPresent([AbsEpisode].self, forKey: .episodes)) ?? []
        numTracks = try? c.decodeIfPresent(Int.self, forKey: .numTracks)
        numEpisodes = try? c.decodeIfPresent(Int.self, forKey: .numEpisodes)
    }
}

extension AbsMetadata {
    static let empty = AbsMetadata(empty: ())
    private init(empty: Void) {
        title = ""
        subtitle = nil
        authorName = nil
        authors = []
        narratorName = nil
        seriesName = nil
        seriesSequence = nil
        genres = nil
        description = nil
        publishedYear = nil
        language = nil
    }
}

/// One library item (a book). `mediaProgress` is only present on some endpoints.
struct AbsBook: Decodable, Identifiable, Hashable, Sendable {
    var id: String
    var media: AbsMedia
    var addedAt: Double?
    var mediaProgress: AbsProgress?

    enum CodingKeys: String, CodingKey {
        case id, media, addedAt, mediaProgress
    }
}

private struct AbsItemsResponse: Decodable {
    var results: [AbsBook]
    var total: Int?
}

struct AbsProgress: Decodable, Hashable, Sendable {
    var libraryItemId: String
    var episodeId: String?
    var currentTime: Double
    var duration: Double
    var progress: Double
    var isFinished: Bool?

    enum CodingKeys: String, CodingKey {
        case libraryItemId, episodeId, currentTime, duration, progress, isFinished
    }
}

private struct AbsMeResponse: Decodable {
    var mediaProgress: [AbsProgress]?
}

private struct AbsLoginResponse: Decodable {
    struct User: Decodable {
        var token: String
        var username: String?
    }
    var user: User
}

private struct AbsErrorBody: Decodable {
    var error: String?
}

// MARK: - Client

/// Minimal Audiobookshelf client: libraries, books, covers, streams and
/// playback progress. Uses the API token, which the user creates in the
/// Audiobookshelf web UI.
struct AudiobookshelfClient: Sendable {
    let baseURL: URL
    let token: String

    private static let session: URLSession = {
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = 20
        configuration.timeoutIntervalForResource = 120
        return URLSession(configuration: configuration)
    }()

    init(baseURL: URL, token: String) {
        self.baseURL = baseURL
        // Copied tokens sometimes carry a prefix or surrounding whitespace.
        var cleaned = token.trimmingCharacters(in: .whitespacesAndNewlines)
        if cleaned.lowercased().hasPrefix("bearer ") {
            cleaned = String(cleaned.dropFirst(7)).trimmingCharacters(in: .whitespaces)
        }
        if cleaned.hasPrefix("\"") && cleaned.hasSuffix("\""), cleaned.count > 1 {
            cleaned = String(cleaned.dropFirst().dropLast())
        }
        self.token = cleaned
    }

    // MARK: Requests

    private func url(_ path: String, query: [URLQueryItem] = []) -> URL? {
        var components = URLComponents(
            url: baseURL.appendingPathComponent(path),
            resolvingAgainstBaseURL: false
        )
        if !query.isEmpty {
            components?.queryItems = query
        }
        return components?.url
    }

    private func request<T: Decodable>(_ path: String, query: [URLQueryItem] = []) async throws -> T {
        guard let url = url(path, query: query) else {
            throw AudiobookshelfFailure(message: "Ungültige Audiobookshelf-Adresse.")
        }
        var request = URLRequest(url: url)
        request.cachePolicy = .reloadIgnoringLocalCacheData
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await Self.session.data(for: request)
        } catch let error as URLError {
            if error.code == .cancelled { throw CancellationError() }
            throw AudiobookshelfFailure(message: Self.message(for: error, url: baseURL))
        } catch {
            throw AudiobookshelfFailure(message: error.localizedDescription)
        }
        if let http = response as? HTTPURLResponse {
            if http.statusCode == 401 || http.statusCode == 403 {
                throw AudiobookshelfFailure(
                    message: "Der API-Token wurde abgelehnt. Erzeuge in Audiobookshelf unter Einstellungen → Benutzer einen neuen Token."
                )
            }
            if http.statusCode == 404 {
                throw AudiobookshelfFailure(
                    message: "Unter dieser Adresse antwortet keine Audiobookshelf-API. Prüfe die URL (inklusive Unterpfad, falls die App dort läuft)."
                )
            }
            if !(200...299).contains(http.statusCode) {
                let detail = (try? JSONDecoder().decode(AbsErrorBody.self, from: data))?.error
                throw AudiobookshelfFailure(
                    message: "Audiobookshelf antwortete mit HTTP \(http.statusCode)\(detail.map { ": \($0)" } ?? "")."
                )
            }
        }
        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            throw AudiobookshelfFailure(
                message: "Unerwartete Antwort von Audiobookshelf. Zeigt die URL wirklich auf den Server?"
            )
        }
    }

    private static func message(for error: URLError, url: URL) -> String {
        switch error.code {
        case .notConnectedToInternet:
            return "Keine Internetverbindung."
        case .cannotFindHost, .dnsLookupFailed:
            return "Server nicht gefunden. Prüfe die Adresse."
        case .cannotConnectToHost:
            return "Server nicht erreichbar. Läuft Audiobookshelf unter \(Format.host(url))?"
        case .timedOut:
            return "Zeitüberschreitung beim Verbinden mit Audiobookshelf."
        case .secureConnectionFailed, .serverCertificateUntrusted, .serverCertificateHasBadDate,
             .serverCertificateHasUnknownRoot, .serverCertificateNotYetValid:
            return "Die TLS-Verbindung zu Audiobookshelf ist nicht vertrauenswürdig."
        case .appTransportSecurityRequiresSecureConnection:
            return "iOS blockiert die unverschlüsselte Verbindung."
        default:
            return "Audiobookshelf nicht erreichbar (\(error.localizedDescription))."
        }
    }

    // MARK: Endpoints

    func libraries() async throws -> [AbsLibrary] {
        let response: AbsLibrariesResponse = try await request("api/libraries")
        return response.libraries
    }

    /// Books of one library, newest first.
    func books(libraryID: String, page: Int = 0, limit: Int = 60) async throws -> [AbsBook] {
        let response: AbsItemsResponse = try await request(
            "api/libraries/\(libraryID)/items",
            query: [
                URLQueryItem(name: "limit", value: String(limit)),
                URLQueryItem(name: "page", value: String(page)),
                URLQueryItem(name: "sort", value: "addedAt"),
                URLQueryItem(name: "desc", value: "1"),
                URLQueryItem(name: "minified", value: "0"),
            ]
        )
        return response.results
    }

    /// Logs in with a normal Audiobookshelf account and returns its token.
    func login(username: String, password: String) async throws -> String {
        guard let url = url("login") else {
            throw AudiobookshelfFailure(message: "Ungültige Audiobookshelf-Adresse.")
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: [
            "username": username,
            "password": password,
        ])

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await Self.session.data(for: request)
        } catch let error as URLError {
            if error.code == .cancelled { throw CancellationError() }
            throw AudiobookshelfFailure(message: Self.message(for: error, url: baseURL))
        } catch {
            throw AudiobookshelfFailure(message: error.localizedDescription)
        }
        if let http = response as? HTTPURLResponse {
            if http.statusCode == 401 {
                throw AudiobookshelfFailure(message: "Benutzername oder Passwort stimmen nicht.")
            }
            if !(200...299).contains(http.statusCode) {
                throw AudiobookshelfFailure(message: "Anmeldung fehlgeschlagen (HTTP \(http.statusCode)).")
            }
        }
        guard let login = try? JSONDecoder().decode(AbsLoginResponse.self, from: data) else {
            throw AudiobookshelfFailure(message: "Unerwartete Antwort bei der Anmeldung.")
        }
        return login.user.token
    }

    /// Full item, including tracks and chapters. Libraries list items often
    /// arrive without them.
    func item(id: String) async throws -> AbsBook {
        try await request("api/items/\(id)")
    }

    struct Author: Decodable, Sendable {
        var id: String
        var name: String
        var description: String?
        var imagePath: String?
    }

    private struct AuthorsResponse: Decodable {
        var authors: [Author]
    }

    func authors(libraryID: String) async throws -> [Author] {
        let response: AuthorsResponse = try await request("api/libraries/\(libraryID)/authors")
        return response.authors
    }

    func authorImageURL(id: String) -> URL? {
        url("api/authors/\(id)/image", query: [URLQueryItem(name: "token", value: token)])
    }

    private struct AuthorResponse: Decodable {
        var author: Author?
    }

    func author(id: String) async throws -> Author {
        let response: AuthorResponse = try await request("api/authors/\(id)")
        if let author = response.author { return author }
        return Author(id: id, name: "", description: nil)
    }

    func progress() async throws -> [AbsProgress] {
        let response: AbsMeResponse = try await request("api/me")
        return response.mediaProgress ?? []
    }

    func pushProgress(
        itemID: String,
        currentTime: Double,
        duration: Double,
        finished: Bool,
        episodeID: String? = nil
    ) async {
        guard let url = url("api/me/progress/\(itemID)") else { return }
        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let progress = duration > 0 ? min(1, max(0, currentTime / duration)) : 0
        var body: [String: Any] = [
            "currentTime": currentTime,
            "duration": duration,
            "progress": progress,
            "isFinished": finished,
        ]
        if let episodeID { body["episodeId"] = episodeID }
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        _ = try? await Self.session.data(for: request)
    }

    // MARK: Media URLs

    /// URLRequest with the auth header, for downloads and covers.
    func authorizedRequest(_ url: URL) -> URLRequest {
        var request = URLRequest(url: url)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        return request
    }

    func coverURL(itemID: String, width: Int = 400) -> URL? {
        url("api/items/\(itemID)/cover", query: [
            URLQueryItem(name: "width", value: String(width)),
            URLQueryItem(name: "token", value: token),
        ])
    }

    /// AVPlayer asset for one audio file. The token is sent both as a header
    /// (what Audiobookshelf actually checks) and as a query parameter, because
    /// AVPlayer cannot set headers on a plain URL.
    func playerAsset(contentUrl: String) -> AVURLAsset? {
        guard let url = streamURL(contentUrl: contentUrl) else { return nil }
        return AVURLAsset(
            url: url,
            options: ["AVURLAssetHTTPHeaderFieldsKey": ["Authorization": "Bearer \(token)"]]
        )
    }

    /// Stream URL for one audio file of a book. Audiobookshelf accepts the
    /// token as a query parameter, which AVPlayer can use directly.
    func streamURL(contentUrl: String) -> URL? {
        let absolute: URL
        if contentUrl.lowercased().hasPrefix("http"), let direct = URL(string: contentUrl) {
            absolute = direct
        } else if contentUrl.hasPrefix("/") {
            // Keep the base path (e.g. behind a reverse proxy) but not a
            // doubled slash.
            var base = baseURL.absoluteString
            while base.hasSuffix("/") { base.removeLast() }
            guard let joined = URL(string: base + contentUrl) else { return nil }
            absolute = joined
        } else {
            absolute = baseURL.appendingPathComponent(contentUrl)
        }

        guard var components = URLComponents(url: absolute, resolvingAgainstBaseURL: false) else {
            return nil
        }
        var items = components.queryItems ?? []
        if !items.contains(where: { $0.name == "token" }) {
            items.append(URLQueryItem(name: "token", value: token))
        }
        components.queryItems = items
        return components.url
    }
}
