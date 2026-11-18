import Foundation
import Observation

/// Settings that shape the instant mix. Kept on the device, like the web app
/// does with its mix preferences.
@MainActor
@Observable
final class Preferences {
    var mixSize: Int {
        didSet { save() }
    }

    /// Genres the instant mix must not pick from.
    var excludedGenres: Set<String> {
        didSet { save() }
    }

    /// Upper bound in kbit/s for streaming. 0 keeps the original file.
    var maxBitRate: Int {
        didSet { save() }
    }

    /// Shows only downloaded content while it is on.
    var offlineMode: Bool {
        didSet { save() }
    }

    /// Which backend feeds each category. Raw values of `CategorySource`.
    var musicSource: String {
        didSet { save() }
    }
    var podcastSource: String {
        didSet { save() }
    }
    var audiobookSource: String {
        didSet { save() }
    }

    private struct Snapshot: Codable {
        var mixSize: Int
        var excludedGenres: [String]
        var maxBitRate: Int
        var offlineMode: Bool?
        var musicSource: String?
        var podcastSource: String?
        var audiobookSource: String?
    }

    private static let key = "navideck.preferences"

    init() {
        let stored = UserDefaults.standard.data(forKey: Self.key)
            .flatMap { try? JSONDecoder().decode(Snapshot.self, from: $0) }
        mixSize = stored?.mixSize ?? 30
        excludedGenres = Set(stored?.excludedGenres ?? [])
        maxBitRate = stored?.maxBitRate ?? 0
        offlineMode = stored?.offlineMode ?? false
        musicSource = stored?.musicSource ?? CategorySource.auto.rawValue
        podcastSource = stored?.podcastSource ?? CategorySource.auto.rawValue
        audiobookSource = stored?.audiobookSource ?? CategorySource.auto.rawValue
    }

    private func save() {
        let snapshot = Snapshot(
            mixSize: mixSize,
            excludedGenres: Array(excludedGenres).sorted(),
            maxBitRate: maxBitRate,
            offlineMode: offlineMode,
            musicSource: musicSource,
            podcastSource: podcastSource,
            audiobookSource: audiobookSource
        )
        if let data = try? JSONEncoder().encode(snapshot) {
            UserDefaults.standard.set(data, forKey: Self.key)
        }
    }
}

/// Where a category gets its content from.
enum CategorySource: String, CaseIterable, Identifiable, Sendable {
    case auto
    case subsonic
    case audiobookshelf
    case off

    var id: String { rawValue }

    var label: String {
        switch self {
        case .auto: return "Automatisch"
        case .subsonic: return "Subsonic / Navidrome"
        case .audiobookshelf: return "Audiobookshelf"
        case .off: return "Aus"
        }
    }
}
