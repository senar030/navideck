import Foundation
import Observation

enum DownloadKind: String, Codable, CaseIterable, Sendable {
    case album
    case playlist
    case artist
    case song
    case podcast
    case audiobook

    var label: String {
        switch self {
        case .album: return "Album"
        case .playlist: return "Playlist"
        case .artist: return "Interpret"
        case .song: return "Titel"
        case .podcast: return "Podcast"
        case .audiobook: return "Hörbuch"
        }
    }

    var symbol: String {
        switch self {
        case .album: return "square.stack"
        case .playlist: return "music.note.list"
        case .artist: return "music.mic"
        case .song: return "music.note"
        case .podcast: return "waveform"
        case .audiobook: return "books.vertical"
        }
    }
}

struct DownloadItem: Codable, Identifiable, Hashable, Sendable {
    var id: String
    var kind: DownloadKind
    var sourceID: String
    var title: String
    var subtitle: String?
    var coverArt: String?
    var songs: [Song]
    var createdAt: Date
    var bytes: Int

    var duration: Int { songs.compactMap(\.duration).reduce(0, +) }

    var metaText: String {
        var parts = ["\(songs.count) Titel"]
        if let duration = Format.longDuration(duration) { parts.append(duration) }
        parts.append(ByteCountFormatter.string(fromByteCount: Int64(bytes), countStyle: .file))
        return parts.joined(separator: " · ")
    }
}

/// Downloads songs to Application Support and keeps a manifest so the library
/// can be browsed and played without the server.
@MainActor
@Observable
final class DownloadStore {
    private(set) var items: [DownloadItem] = [] {
        didSet { rebuildIndex() }
    }
    private(set) var progress: [String: Double] = [:]
    /// Per-song byte progress of running downloads, keyed by song id.
    private(set) var songProgress: [String: Double] = [:]
    /// Per-album progress, so an artist download can show one bar per album.
    private(set) var albumProgress: [String: Double] = [:]
    private(set) var failures: [String: String] = [:]

    @ObservationIgnored private var files: [String: String] = [:]
    @ObservationIgnored private var covers: [String: String] = [:]
    /// Lookup table so list rows do not scan every download on each render.
    @ObservationIgnored private var itemIndex: [String: DownloadItem] = [:]
    /// Cover paths already checked on disk; avoids a stat per artwork lookup.
    @ObservationIgnored private var verifiedCovers: Set<String> = []
    @ObservationIgnored private var tasks: [String: Task<Void, Never>] = [:]

    @ObservationIgnored private let root: URL
    @ObservationIgnored private let manifestURL: URL
    @ObservationIgnored private let session: URLSession

    private struct Manifest: Codable {
        var items: [DownloadItem]
        var files: [String: String]
        var covers: [String: String]
    }

    init() {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        root = base.appendingPathComponent("navideck-downloads", isDirectory: true)
        manifestURL = root.appendingPathComponent("manifest.json")
        try? FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)

        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForResource = 600
        configuration.waitsForConnectivity = true
        session = URLSession(configuration: configuration)

        loadInBackground()
    }

    // MARK: - Queries

    func item(kind: DownloadKind, sourceID: String) -> DownloadItem? {
        // Reading `items` keeps the download badge observed; the lookup table
        // itself is not part of the observation graph.
        _ = items.count
        return itemIndex[key(kind, sourceID)]
    }

    private func rebuildIndex() {
        itemIndex = Dictionary(items.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
    }

    func contains(songID: String) -> Bool {
        files[songID] != nil
    }

    func localURL(songID: String) -> URL? {
        guard let path = files[songID] else { return nil }
        let url = root.appendingPathComponent(path)
        return FileManager.default.fileExists(atPath: url.path) ? url : nil
    }

    /// Offline artwork for a collection, keyed by the Subsonic cover art id.
    func localCoverURL(coverArt: String?) -> URL? {
        guard let coverArt, let path = covers[coverArt] else { return nil }
        let url = root.appendingPathComponent(path)
        if verifiedCovers.contains(path) { return url }
        guard FileManager.default.fileExists(atPath: url.path) else { return nil }
        verifiedCovers.insert(path)
        return url
    }

    func isDownloading(kind: DownloadKind, sourceID: String) -> Bool {
        progress[key(kind, sourceID)] != nil
    }

    func progressValue(kind: DownloadKind, sourceID: String) -> Double? {
        progress[key(kind, sourceID)]
    }

    func failure(kind: DownloadKind, sourceID: String) -> String? {
        failures[key(kind, sourceID)]
    }

    var totalBytes: Int64 {
        items.reduce(0) { $0 + Int64($1.bytes) }
    }

    var totalText: String {
        ByteCountFormatter.string(fromByteCount: totalBytes, countStyle: .file)
    }

    // MARK: - Downloading

    func download(
        kind: DownloadKind,
        sourceID: String,
        title: String,
        subtitle: String?,
        coverArt: String?,
        songs: [Song],
        client: SubsonicClient,
        maxBitRate: Int
    ) {
        let id = key(kind, sourceID)
        guard !songs.isEmpty, tasks[id] == nil, !items.contains(where: { $0.id == id }) else { return }

        failures[id] = nil
        progress[id] = 0

        tasks[id] = Task { [weak self] in
            guard let self else { return }
            await self.run(
                id: id,
                kind: kind,
                sourceID: sourceID,
                title: title,
                subtitle: subtitle,
                coverArt: coverArt,
                songs: songs,
                client: client,
                maxBitRate: maxBitRate
            )
        }
    }

    private func run(
        id: String,
        kind: DownloadKind,
        sourceID: String,
        title: String,
        subtitle: String?,
        coverArt: String?,
        songs: [Song],
        client: SubsonicClient,
        maxBitRate: Int
    ) async {
        let folder = id.replacingOccurrences(of: ":", with: "-")
        let directory = root.appendingPathComponent(folder, isDirectory: true)
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)

        var written: [String: String] = [:]
        var bytes = 0

        // Album bookkeeping: total songs per album, finished ones, and the
        // album key each song belongs to.
        let totals = Dictionary(grouping: songs, by: { $0.albumId ?? $0.id }).mapValues(\.count)
        var finished: [String: Int] = [:]
        func albumKey(_ song: Song) -> String { song.albumId ?? song.id }

        func clearTrackProgress() {
            for song in songs {
                songProgress[song.id] = nil
                albumProgress[albumKey(song)] = nil
            }
        }

        defer {
            tasks[id] = nil
            clearTrackProgress()
        }

        for (offset, song) in songs.enumerated() {
            if Task.isCancelled {
                cleanUp(directory: directory)
                progress[id] = nil
                return
            }
            guard let url = client.streamURL(id: song.id, maxBitRate: maxBitRate) else { continue }

            let key = albumKey(song)
            let total = max(1, totals[key] ?? 1)
            songProgress[song.id] = 0

            let tracker = DownloadProgressTracker { [weak self] fraction in
                Task { @MainActor in
                    guard let self else { return }
                    let previous = self.songProgress[song.id] ?? 0
                    if fraction >= 1 || fraction - previous > 0.01 {
                        self.songProgress[song.id] = fraction
                        let done = Double(finished[key] ?? 0)
                        self.albumProgress[key] = (done + fraction) / Double(total)
                    }
                }
            }

            do {
                let request = URLRequest(url: url)
                let (temporary, response) = try await session.download(for: request, delegate: tracker)
                if let http = response as? HTTPURLResponse, !(200...399).contains(http.statusCode) {
                    throw SubsonicFailure(code: http.statusCode, message: "HTTP \(http.statusCode)")
                }
                let suffix = Self.fileSuffix(for: song, response: response)
                let name = "\(Self.safeName(song.id)).\(suffix)"
                let destination = directory.appendingPathComponent(name)
                if FileManager.default.fileExists(atPath: destination.path) {
                    try? FileManager.default.removeItem(at: destination)
                }
                try FileManager.default.moveItem(at: temporary, to: destination)
                let attributes = try? FileManager.default.attributesOfItem(atPath: destination.path)
                let size = (attributes?[.size] as? NSNumber)?.intValue ?? 0
                bytes += size
                written[song.id] = "\(folder)/\(name)"
                finished[key] = (finished[key] ?? 0) + 1
                songProgress[song.id] = 1
                albumProgress[key] = Double(finished[key] ?? 1) / Double(total)
            } catch {
                cleanUp(directory: directory)
                for path in written.values {
                    try? FileManager.default.removeItem(at: root.appendingPathComponent(path))
                }
                failures[id] = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
                progress[id] = nil
                return
            }
            progress[id] = Double(offset + 1) / Double(songs.count)
        }

        var coverPath: String?
        if let coverURL = client.coverURL(id: coverArt, size: 700) {
            if let (data, _) = try? await session.data(from: coverURL), !data.isEmpty {
                let name = "cover-\(Self.safeName(coverArt ?? sourceID)).jpg"
                let destination = directory.appendingPathComponent(name)
                try? data.write(to: destination, options: .atomic)
                coverPath = "\(folder)/\(name)"
            }
        }

        for (songID, path) in written { files[songID] = path }
        if let coverArt, let coverPath { covers[coverArt] = coverPath }

        items.removeAll { $0.id == id }
        items.append(
            DownloadItem(
                id: id,
                kind: kind,
                sourceID: sourceID,
                title: title,
                subtitle: subtitle,
                coverArt: coverArt,
                songs: songs,
                createdAt: Date(),
                bytes: bytes
            )
        )
        items.sort { $0.createdAt > $1.createdAt }
        progress[id] = nil
        persist()
    }

    func cancel(kind: DownloadKind, sourceID: String) {
        let id = key(kind, sourceID)
        tasks[id]?.cancel()
        tasks[id] = nil
        progress[id] = nil
    }

    func delete(_ item: DownloadItem) {
        tasks[item.id]?.cancel()
        tasks[item.id] = nil
        progress[item.id] = nil
        for song in item.songs {
            songProgress[song.id] = nil
            albumProgress[song.albumId ?? song.id] = nil
        }

        let folder = item.id.replacingOccurrences(of: ":", with: "-")
        try? FileManager.default.removeItem(at: root.appendingPathComponent(folder, isDirectory: true))
        for song in item.songs { files[song.id] = nil }
        // Keep the cover if another collection still points at it.
        if let coverArt = item.coverArt,
           !items.contains(where: { $0.id != item.id && $0.coverArt == coverArt }) {
            covers[coverArt] = nil
        }
        items.removeAll { $0.id == item.id }
        persist()
    }

    func deleteEverything() {
        for task in tasks.values { task.cancel() }
        tasks.removeAll()
        progress.removeAll()
        songProgress.removeAll()
        albumProgress.removeAll()
        for item in items { delete(item) }
        try? FileManager.default.removeItem(at: root)
        try? FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        items = []
        files = [:]
        covers = [:]
        verifiedCovers = []
        persist()
    }

    /// Downloads prepared requests (e.g. with auth headers) and stores them
    /// like any other collection.
    func downloadExternal(
        kind: DownloadKind,
        sourceID: String,
        title: String,
        subtitle: String?,
        coverArt: String?,
        songs: [Song],
        requests: [(song: Song, request: URLRequest)],
        coverRequest: URLRequest?
    ) {
        let id = key(kind, sourceID)
        guard !requests.isEmpty, tasks[id] == nil, !items.contains(where: { $0.id == id }) else { return }

        failures[id] = nil
        progress[id] = 0

        tasks[id] = Task { [weak self] in
            guard let self else { return }
            await self.runExternal(
                id: id,
                kind: kind,
                sourceID: sourceID,
                title: title,
                subtitle: subtitle,
                coverArt: coverArt,
                songs: songs,
                requests: requests,
                coverRequest: coverRequest
            )
        }
    }

    private func runExternal(
        id: String,
        kind: DownloadKind,
        sourceID: String,
        title: String,
        subtitle: String?,
        coverArt: String?,
        songs: [Song],
        requests: [(song: Song, request: URLRequest)],
        coverRequest: URLRequest?
    ) async {
        let folder = id.replacingOccurrences(of: ":", with: "-")
        let directory = root.appendingPathComponent(folder, isDirectory: true)
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)

        var written: [String: String] = [:]
        var bytes = 0

        func clearTrackProgress() {
            for song in songs { songProgress[song.id] = nil }
        }

        defer {
            tasks[id] = nil
            clearTrackProgress()
        }

        for (offset, entry) in requests.enumerated() {
            if Task.isCancelled {
                cleanUp(directory: directory)
                progress[id] = nil
                return
            }
            songProgress[entry.song.id] = 0
            do {
                let (temporary, response) = try await session.download(for: entry.request)
                if let http = response as? HTTPURLResponse, !(200...399).contains(http.statusCode) {
                    throw SubsonicFailure(code: http.statusCode, message: "HTTP \(http.statusCode)")
                }
                let suffix = Self.fileSuffix(for: entry.song, response: response)
                let name = "\(Self.safeName(entry.song.id)).\(suffix)"
                let destination = directory.appendingPathComponent(name)
                if FileManager.default.fileExists(atPath: destination.path) {
                    try? FileManager.default.removeItem(at: destination)
                }
                try FileManager.default.moveItem(at: temporary, to: destination)
                let attributes = try? FileManager.default.attributesOfItem(atPath: destination.path)
                bytes += (attributes?[.size] as? NSNumber)?.intValue ?? 0
                written[entry.song.id] = "\(folder)/\(name)"
                songProgress[entry.song.id] = 1
            } catch {
                cleanUp(directory: directory)
                for path in written.values {
                    try? FileManager.default.removeItem(at: root.appendingPathComponent(path))
                }
                failures[id] = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
                progress[id] = nil
                return
            }
            progress[id] = Double(offset + 1) / Double(requests.count)
        }

        var coverPath: String?
        if let coverRequest, let coverArt {
            if let (data, _) = try? await session.data(for: coverRequest), !data.isEmpty {
                let name = "cover-\(Self.safeName(coverArt)).jpg"
                let destination = directory.appendingPathComponent(name)
                try? data.write(to: destination, options: .atomic)
                coverPath = "\(folder)/\(name)"
            }
        }

        for (songID, path) in written { files[songID] = path }
        if let coverArt, let coverPath { covers[coverArt] = coverPath }

        items.removeAll { $0.id == id }
        items.append(
            DownloadItem(
                id: id,
                kind: kind,
                sourceID: sourceID,
                title: title,
                subtitle: subtitle,
                coverArt: coverArt,
                songs: songs,
                createdAt: Date(),
                bytes: bytes
            )
        )
        items.sort { $0.createdAt > $1.createdAt }
        progress[id] = nil
        persist()
    }

    // MARK: - Helpers

    private func key(_ kind: DownloadKind, _ sourceID: String) -> String {
        "\(kind.rawValue):\(sourceID)"
    }

    private func cleanUp(directory: URL) {
        try? FileManager.default.removeItem(at: directory)
    }

    private func persist() {
        let manifest = Manifest(items: items, files: files, covers: covers)
        guard let data = try? JSONEncoder().encode(manifest) else { return }
        try? data.write(to: manifestURL, options: .atomic)
    }

    /// Decodes the manifest off the main thread; on large libraries this used
    /// to block the first frame.
    private func loadInBackground() {
        let url = manifestURL
        Task { [weak self] in
            let manifest = await Task.detached(priority: .utility) { () -> Manifest? in
                guard let data = try? Data(contentsOf: url) else { return nil }
                return try? JSONDecoder().decode(Manifest.self, from: data)
            }.value
            guard let self, let manifest else { return }
            self.items = manifest.items.sorted { $0.createdAt > $1.createdAt }
            self.files = manifest.files
            self.covers = manifest.covers
            self.verifiedCovers = []
            self.rebuildIndex()
        }
    }

    private static func fileSuffix(for song: Song, response: URLResponse) -> String {
        if let suffix = song.suffix, !suffix.isEmpty { return suffix }
        switch response.mimeType {
        case "audio/mpeg": return "mp3"
        case "audio/mp4", "audio/x-m4a": return "m4a"
        case "audio/flac", "audio/x-flac": return "flac"
        case "audio/ogg": return "ogg"
        default: return "mp3"
        }
    }

    private static func safeName(_ value: String) -> String {
        value.replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: ":", with: "_")
    }
}

/// Reports byte progress of a single download task without a shared delegate.
private final class DownloadProgressTracker: NSObject, URLSessionTaskDelegate, URLSessionDownloadDelegate {
    private let onProgress: @Sendable (Double) -> Void

    init(onProgress: @escaping @Sendable (Double) -> Void) {
        self.onProgress = onProgress
    }

    func urlSession(
        _ session: URLSession,
        downloadTask: URLSessionDownloadTask,
        didFinishDownloadingTo location: URL
    ) {
        // The async download call delivers the file; nothing to do here.
    }

    func urlSession(
        _ session: URLSession,
        downloadTask: URLSessionDownloadTask,
        didWriteData bytesWritten: Int64,
        totalBytesWritten: Int64,
        totalBytesExpectedToWrite: Int64
    ) {
        guard totalBytesExpectedToWrite > 0 else { return }
        onProgress(min(1, Double(totalBytesWritten) / Double(totalBytesExpectedToWrite)))
    }
}
