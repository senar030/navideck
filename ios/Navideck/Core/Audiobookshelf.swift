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

struct AbsMetadata: Decodable, Hashable, Sendable {
    var title: String
    var subtitle: String?
    var authorName: String?
    var narratorName: String?
    var seriesName: String?
    var seriesSequence: String?
    var genres: [String]?
    var description: String?
    var publishedYear: String?
    var language: String?

    enum CodingKeys: String, CodingKey {
        case title, subtitle, authorName, narratorName, seriesName
        case seriesSequence, genres, description, publishedYear, language
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        title = (try? c.decodeIfPresent(String.self, forKey: .title)) ?? ""
        subtitle = try? c.decodeIfPresent(String.self, forKey: .subtitle)
        authorName = try? c.decodeIfPresent(String.self, forKey: .authorName)
        narratorName = try? c.decodeIfPresent(String.self, forKey: .narratorName)
        seriesName = try? c.decodeIfPresent(String.self, forKey: .seriesName)
        seriesSequence = try? c.decodeIfPresent(String.self, forKey: .seriesSequence)
        genres = try? c.decodeIfPresent([String].self, forKey: .genres)
        description = try? c.decodeIfPresent(String.self, forKey: .description)
        publishedYear = try? c.decodeIfPresent(String.self, forKey: .publishedYear)
        language = try? c.decodeIfPresent(String.self, forKey: .language)
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
}

struct AbsMedia: Decodable, Hashable, Sendable {
    var metadata: AbsMetadata
    var duration: Double
    var chapters: [AbsChapter]
    var tracks: [AbsTrack]
    var numTracks: Int?

    enum CodingKeys: String, CodingKey {
        case metadata, duration, chapters, tracks, numTracks
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        metadata = (try? c.decodeIfPresent(AbsMetadata.self, forKey: .metadata)) ?? AbsMetadata.empty
        duration = (try? c.decodeIfPresent(Double.self, forKey: .duration)) ?? 0
        chapters = (try? c.decodeIfPresent([AbsChapter].self, forKey: .chapters)) ?? []
        tracks = (try? c.decodeIfPresent([AbsTrack].self, forKey: .tracks)) ?? []
        numTracks = try? c.decodeIfPresent(Int.self, forKey: .numTracks)
    }
}

extension AbsMetadata {
    static let empty = AbsMetadata(empty: ())
    private init(empty: Void) {
        title = ""
        subtitle = nil
        authorName = nil
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
    var currentTime: Double
    var duration: Double
    var progress: Double
    var isFinished: Bool?

    enum CodingKeys: String, CodingKey {
        case libraryItemId, currentTime, duration, progress, isFinished
    }
}

private struct AbsMeResponse: Decodable {
    var mediaProgress: [AbsProgress]?
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
        self.token = token
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
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await Self.session.data(for: request)
        } catch {
            throw AudiobookshelfFailure(message: "Audiobookshelf nicht erreichbar.")
        }
        if let http = response as? HTTPURLResponse {
            if http.statusCode == 401 || http.statusCode == 403 {
                throw AudiobookshelfFailure(message: "Audiobookshelf hat den API-Token abgelehnt.")
            }
            if !(200...299).contains(http.statusCode) {
                throw AudiobookshelfFailure(message: "Audiobookshelf antwortete mit HTTP \(http.statusCode).")
            }
        }
        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            throw AudiobookshelfFailure(message: "Unerwartete Antwort von Audiobookshelf.")
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

    func progress() async throws -> [AbsProgress] {
        let response: AbsMeResponse = try await request("api/me")
        return response.mediaProgress ?? []
    }

    func pushProgress(itemID: String, currentTime: Double, duration: Double, finished: Bool) async {
        guard let url = url("api/me/progress/\(itemID)") else { return }
        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let progress = duration > 0 ? min(1, max(0, currentTime / duration)) : 0
        let body: [String: Any] = [
            "currentTime": currentTime,
            "duration": duration,
            "progress": progress,
            "isFinished": finished,
        ]
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        _ = try? await Self.session.data(for: request)
    }

    // MARK: Media URLs

    func coverURL(itemID: String, width: Int = 400) -> URL? {
        url("api/items/\(itemID)/cover", query: [
            URLQueryItem(name: "width", value: String(width)),
            URLQueryItem(name: "token", value: token),
        ])
    }

    /// Stream URL for one audio file of a book. Audiobookshelf accepts the
    /// token as a query parameter, which AVPlayer can use directly.
    func streamURL(contentUrl: String) -> URL? {
        guard var components = URLComponents(
            url: baseURL.appendingPathComponent(contentUrl),
            resolvingAgainstBaseURL: false
        ) else { return nil }
        var items = components.queryItems ?? []
        items.append(URLQueryItem(name: "token", value: token))
        components.queryItems = items
        return components.url
    }
}
