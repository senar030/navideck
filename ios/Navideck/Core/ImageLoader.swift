import CryptoKit
import ImageIO
import SwiftUI
import UIKit

/// Cover art loader with a memory and a disk cache.
///
/// Subsonic cover URLs only differ in their `size` parameter, so the store
/// normalises them: every screen shares one download per cover instead of
/// fetching the same artwork again for the list, the mini player and the
/// full-screen player. Decoding happens through ImageIO at the size the view
/// actually needs, which keeps scrolling cheap and the cache small.
actor ImageStore {
    static let shared = ImageStore()

    /// One entry per cover *and* pixel size. Thumbnails are a few hundred
    /// kilobytes, so many more of them fit into the budget than full covers.
    private static let memory: NSCache<NSString, UIImage> = {
        let cache = NSCache<NSString, UIImage>()
        cache.countLimit = 800
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

    /// URL parsing shows up in every row body during scrolling, so both
    /// lookups are memoised.
    private static let keyCache: NSCache<NSString, NSString> = {
        let cache = NSCache<NSString, NSString>()
        cache.countLimit = 2000
        return cache
    }()

    private static let sizeCache: NSCache<NSString, NSNumber> = {
        let cache = NSCache<NSString, NSNumber>()
        cache.countLimit = 2000
        return cache
    }()

    /// Identity of a cover, independent of the requested size.
    nonisolated static func key(for url: URL?) -> String {
        guard let url else { return "" }
        let raw = url.absoluteString as NSString
        if let hit = keyCache.object(forKey: raw) { return hit as String }

        var components = URLComponents(url: canonical(url), resolvingAgainstBaseURL: false)
        let items = components?.queryItems ?? []
        components?.queryItems = items.filter { $0.name != "size" }
        let value = components?.url?.absoluteString ?? url.absoluteString
        keyCache.setObject(value as NSString, forKey: raw)
        return value
    }

    /// Pixel size a cover is cached at. The URL's `size` parameter is the
    /// point size the view asked for, so it is multiplied by the screen scale.
    nonisolated static func pixelSize(for url: URL?, maxPixel: Int) -> Int {
        guard let url else { return maxPixel }
        let cacheKey = "\(url.absoluteString)#\(maxPixel)" as NSString
        if let hit = sizeCache.object(forKey: cacheKey) { return hit.intValue }

        let requested: Int
        if let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
           let size = components.queryItems?.first(where: { $0.name == "size" })?.value,
           let value = Int(size), value > 0 {
            requested = value
        } else {
            requested = 300
        }
        // Modern iPhones render at 3x; using that factor keeps covers sharp
        // without ever decoding more than the view can show.
        let value = min(maxPixel, max(120, requested * 3))
        sizeCache.setObject(NSNumber(value: value), forKey: cacheKey)
        return value
    }

    private nonisolated static func memoryKey(_ url: URL, maxPixel: Int) -> String {
        "\(key(for: url))@\(pixelSize(for: url, maxPixel: maxPixel))"
    }

    /// Synchronous memory hit, so lists render without a blank frame. Falls
    /// back to any other cached resolution of the same cover, which avoids a
    /// blank frame when the same artwork is shown at two sizes.
    nonisolated static func cached(for url: URL?, maxPixel: Int = 600) -> UIImage? {
        guard let url else { return nil }
        if let image = memory.object(forKey: memoryKey(url, maxPixel: maxPixel) as NSString) {
            return image
        }
        for fallback in [1200, 900, 600, 480, 360, 240, 160] where fallback != maxPixel {
            if let image = memory.object(forKey: memoryKey(url, maxPixel: fallback) as NSString) {
                return image
            }
        }
        return nil
    }

    // MARK: - Loading

    func image(for url: URL, maxPixel: Int = 600) async -> UIImage? {
        let cacheKey = Self.memoryKey(url, maxPixel: maxPixel)
        if let cached = Self.memory.object(forKey: cacheKey as NSString) { return cached }
        if let running = inFlight[cacheKey] { return await running.value }

        let canonicalURL = Self.canonical(url)
        let coverKey = Self.key(for: url)
        let target = Self.pixelSize(for: url, maxPixel: maxPixel)

        let task = Task.detached(priority: .userInitiated) { [session, directory] () -> UIImage? in
            let file = Self.diskURL(in: directory, key: coverKey)

            // Reading and thumbnailing off the main thread; ImageIO never
            // decodes the full bitmap, it scales while decoding.
            if let data = try? Data(contentsOf: file, options: .mappedIfSafe),
               let cached = Self.thumbnail(data, maxPixel: target) {
                return cached
            }

            do {
                let (data, response) = try await session.data(from: canonicalURL)
                if let http = response as? HTTPURLResponse, !(200...399).contains(http.statusCode) {
                    return nil
                }
                guard let image = Self.thumbnail(data, maxPixel: target) else { return nil }
                try? data.write(to: file, options: .atomic)
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
    func prefetch(_ urls: [URL], limit: Int = 10, maxPixel: Int = 600) async {
        let pending = Array(urls.prefix(limit)).filter {
            Self.cached(for: $0, maxPixel: maxPixel) == nil
        }
        guard !pending.isEmpty else { return }

        await withTaskGroup(of: Void.self) { group in
            var iterator = pending.makeIterator()
            for _ in 0..<min(4, pending.count) {
                guard let url = iterator.next() else { break }
                group.addTask { _ = await ImageStore.shared.image(for: url, maxPixel: maxPixel) }
            }
            while await group.next() != nil {
                guard let url = iterator.next() else { continue }
                group.addTask { _ = await ImageStore.shared.image(for: url, maxPixel: maxPixel) }
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

    /// Smallest possible decode: ImageIO reads only as much of the JPEG as the
    /// requested thumbnail needs.
    private static func thumbnail(_ data: Data, maxPixel: Int) -> UIImage? {
        guard let source = CGImageSourceCreateWithData(data as CFData, [kCGImageSourceShouldCache: false] as CFDictionary) else {
            return nil
        }
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceShouldCacheImmediately: true,
            kCGImageSourceThumbnailMaxPixelSize: maxPixel,
        ]
        guard let cgImage = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) else {
            return nil
        }
        return UIImage(cgImage: cgImage)
    }
}

/// Drop-in replacement for `AsyncImage` that shows the cached cover
/// immediately and keeps the previous frame while a new one loads.
struct CachedImage: View {
    let url: URL?
    var contentMode: ContentMode = .fill
    /// Upper bound for the decoded bitmap. 600 is plenty for lists and cards,
    /// large headers pass something bigger.
    var maxPixel: Int = 600

    @State private var image: UIImage?
    @State private var loadedKey: String?

    private var cacheKey: String {
        "\(ImageStore.key(for: url))@\(maxPixel)"
    }

    private var shown: UIImage? {
        if let image, loadedKey == cacheKey { return image }
        return ImageStore.cached(for: url, maxPixel: maxPixel)
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
            let loaded = await ImageStore.shared.image(for: url, maxPixel: maxPixel)
            guard !Task.isCancelled, loadedKey == cacheKey else { return }
            image = loaded
        }
    }
}
