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

    private struct Snapshot: Codable {
        var mixSize: Int
        var excludedGenres: [String]
        var maxBitRate: Int
    }

    private static let key = "navideck.preferences"

    init() {
        let stored = UserDefaults.standard.data(forKey: Self.key)
            .flatMap { try? JSONDecoder().decode(Snapshot.self, from: $0) }
        mixSize = stored?.mixSize ?? 30
        excludedGenres = Set(stored?.excludedGenres ?? [])
        maxBitRate = stored?.maxBitRate ?? 0
    }

    private func save() {
        let snapshot = Snapshot(
            mixSize: mixSize,
            excludedGenres: Array(excludedGenres).sorted(),
            maxBitRate: maxBitRate
        )
        if let data = try? JSONEncoder().encode(snapshot) {
            UserDefaults.standard.set(data, forKey: Self.key)
        }
    }
}
