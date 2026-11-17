import CryptoKit
import SwiftUI
import UIKit

/// Cover art loader with a memory and a disk cache.
///
/// `AsyncImage` reloads on every screen and flashes a spinner, which is what
/// made swiping through albums feel slow. One shared store keeps the decoded
/// images around and downloads each artwork only once.
actor ImageStore {
    static let shared = ImageStore()

    private let memory = NSCache<NSString, UIImage>()
    private let directory: URL
    private let session: URLSession
    private var inFlight: [String: Task<UIImage?, Never>] = [:]

    init() {
        let caches = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        directory = caches.appendingPathComponent("navideck-covers", isDirectory: true)
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)

        memory.countLimit = 300
        memory.totalCostLimit = 140 * 1024 * 1024

        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = 25
        configuration.urlCache = URLCache(
            memoryCapacity: 32 * 1024 * 1024,
            diskCapacity: 256 * 1024 * 1024
        )
        session = URLSession(configuration: configuration)
    }

    func image(for url: URL) async -> UIImage? {
        let key = url.absoluteString
        if let cached = memory.object(forKey: key as NSString) { return cached }
        if let running = inFlight[key] { return await running.value }

        let task = Task<UIImage?, Never> { [session, directory] in
            if let data = try? Data(contentsOf: Self.diskURL(in: directory, key: key)),
               let cached = Self.decode(data) {
                return cached
            }
            do {
                let (data, response) = try await session.data(from: url)
                if let http = response as? HTTPURLResponse, !(200...399).contains(http.statusCode) {
                    return nil
                }
                guard let image = Self.decode(data) else { return nil }
                try? data.write(to: Self.diskURL(in: directory, key: key), options: .atomic)
                return image
            } catch {
                return nil
            }
        }

        inFlight[key] = task
        let image = await task.value
        inFlight[key] = nil
        if let image {
            let cost = Int(image.size.width * image.size.height * 4)
            memory.setObject(image, forKey: key as NSString, cost: cost)
        }
        return image
    }

    /// Warms the cache for covers that are about to scroll into view.
    func prefetch(_ urls: [URL], limit: Int = 8) async {
        for url in urls.prefix(limit) where memory.object(forKey: url.absoluteString as NSString) == nil {
            _ = await image(for: url)
        }
    }

    func cachedImage(for url: URL?) -> UIImage? {
        guard let url else { return nil }
        return memory.object(forKey: url.absoluteString as NSString)
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

/// Drop-in replacement for `AsyncImage` that keeps the last frame while a new
/// image loads and never shows a spinner per cell.
struct CachedImage: View {
    let url: URL?
    var contentMode: ContentMode = .fill

    @State private var image: UIImage?
    @State private var loadedKey: String?

    var body: some View {
        Group {
            if let image {
                Image(uiImage: image)
                    .resizable()
                    .aspectRatio(contentMode: contentMode)
            } else {
                Color.clear
            }
        }
        .task(id: url?.absoluteString) {
            guard let url else {
                image = nil
                loadedKey = nil
                return
            }
            if loadedKey != url.absoluteString {
                image = nil
                loadedKey = url.absoluteString
            }
            let loaded = await ImageStore.shared.image(for: url)
            guard !Task.isCancelled else { return }
            if loadedKey == url.absoluteString {
                image = loaded
            }
        }
    }
}
