import CryptoKit
import SwiftUI
import UIKit

/// Cover art loader with a memory and a disk cache.
///
/// Subsonic cover URLs only differ in their `size` parameter, so the store
/// normalises them: every screen shares one download per cover instead of
/// fetching the same artwork again for the list, the mini player and the
/// full-screen player.
actor ImageStore {
    static let shared = ImageStore()

    private static let memory: NSCache<NSString, UIImage> = {
        let cache = NSCache<NSString, UIImage>()
        cache.countLimit = 400
        cache.totalCostLimit = 160 * 1024 * 1024
        return cache
    }()

    private let directory: URL
    private let session: URLSession
    private var inFlight: [String: Task<UIImage?, Never>] = [:]

    init() {
        let caches = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        directory = caches.appendingPathComponent("navideck-covers", isDirectory: true)
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)

        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = 20
        configuration.httpMaximumConnectionsPerHost = 6
        configuration.requestCachePolicy = .returnCacheDataElseLoad
        configuration.urlCache = URLCache(
            memoryCapacity: 32 * 1024 * 1024,
            diskCapacity: 256 * 1024 * 1024
        )
        session = URLSession(configuration: configuration)
    }

    // MARK: - Cache keys

    /// Requests one resolution for every cover; views scale it down.
    nonisolated static func canonical(_ url: URL) -> URL {
        guard var components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              components.queryItems?.contains(where: { $0.name == "size" }) == true else {
            return url
        }
        let items = components.queryItems ?? []
        components.queryItems = items.map { item in
            item.name == "size" ? URLQueryItem(name: "size", value: "900") : item
        }
        return components.url ?? url
    }

    /// Identity of a cover, independent of the requested size.
    nonisolated static func key(for url: URL?) -> String {
        guard let url else { return "" }
        var components = URLComponents(url: canonical(url), resolvingAgainstBaseURL: false)
        let items = components?.queryItems ?? []
        components?.queryItems = items.filter { $0.name != "size" }
        return components?.url?.absoluteString ?? url.absoluteString
    }

    /// Synchronous memory hit, so lists render without a blank frame.
    nonisolated static func cached(for url: URL?) -> UIImage? {
        guard let url else { return nil }
        return memory.object(forKey: key(for: url) as NSString)
    }

    // MARK: - Loading

    func image(for url: URL) async -> UIImage? {
        let canonicalURL = Self.canonical(url)
        let cacheKey = Self.key(for: url)
        if let cached = Self.memory.object(forKey: cacheKey as NSString) { return cached }
        if let running = inFlight[cacheKey] { return await running.value }

        let task = Task<UIImage?, Never> { [session, directory] in
            if let data = try? Data(contentsOf: Self.diskURL(in: directory, key: cacheKey)),
               let cached = Self.decode(data) {
                return cached
            }
            do {
                let (data, response) = try await session.data(from: canonicalURL)
                if let http = response as? HTTPURLResponse, !(200...399).contains(http.statusCode) {
                    return nil
                }
                guard let image = Self.decode(data) else { return nil }
                try? data.write(to: Self.diskURL(in: directory, key: cacheKey), options: .atomic)
                return image
            } catch {
                return nil
            }
        }

        inFlight[cacheKey] = task
        let image = await task.value
        inFlight[cacheKey] = nil
        if let image {
            let cost = Int(image.size.width * image.size.height * 4)
            Self.memory.setObject(image, forKey: cacheKey as NSString, cost: cost)
        }
        return image
    }

    /// Warms the cache for covers that are about to scroll into view. Runs a
    /// few downloads in parallel instead of one after the other.
    func prefetch(_ urls: [URL], limit: Int = 10) async {
        let pending = Array(urls.prefix(limit)).filter { Self.cached(for: $0) == nil }
        guard !pending.isEmpty else { return }

        await withTaskGroup(of: Void.self) { group in
            var iterator = pending.makeIterator()
            for _ in 0..<min(4, pending.count) {
                guard let url = iterator.next() else { break }
                group.addTask { _ = await ImageStore.shared.image(for: url) }
            }
            while await group.next() != nil {
                guard let url = iterator.next() else { continue }
                group.addTask { _ = await ImageStore.shared.image(for: url) }
            }
        }
    }

    // MARK: - Files

    private static func diskURL(in directory: URL, key: String) -> URL {
        let digest = SHA256.hash(data: Data(key.utf8))
            .map { String(format: "%02x", $0) }
            .joined()
        return directory.appendingPathComponent(digest)
    }

    private static func decode(_ data: Data) -> UIImage? {
        guard let image = UIImage(data: data) else { return nil }
        let maxSide: CGFloat = 1200
        let longest = max(image.size.width, image.size.height)
        guard longest > maxSide else { return image }
        let scale = maxSide / longest
        let size = CGSize(width: image.size.width * scale, height: image.size.height * scale)
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        return UIGraphicsImageRenderer(size: size, format: format).image { _ in
            image.draw(in: CGRect(origin: .zero, size: size))
        }
    }
}

/// Drop-in replacement for `AsyncImage` that shows the cached cover
/// immediately and keeps the previous frame while a new one loads.
struct CachedImage: View {
    let url: URL?
    var contentMode: ContentMode = .fill

    @State private var image: UIImage?
    @State private var loadedKey: String?

    private var cacheKey: String { ImageStore.key(for: url) }

    private var shown: UIImage? {
        if let image, loadedKey == cacheKey { return image }
        return ImageStore.cached(for: url)
    }

    var body: some View {
        Group {
            if let shown {
                Image(uiImage: shown)
                    .resizable()
                    .aspectRatio(contentMode: contentMode)
            } else {
                Color.clear
            }
        }
        .task(id: cacheKey) {
            guard let url else {
                image = nil
                loadedKey = nil
                return
            }
            if loadedKey != cacheKey {
                image = nil
                loadedKey = cacheKey
            }
            let loaded = await ImageStore.shared.image(for: url)
            guard !Task.isCancelled, loadedKey == cacheKey else { return }
            image = loaded
        }
    }
}
