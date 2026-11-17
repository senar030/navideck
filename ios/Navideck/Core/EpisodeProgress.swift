import Foundation
import Observation

struct EpisodeProgress: Codable, Sendable, Equatable {
    var position: Double
    var duration: Double
    var updated: Date

    var isFinished: Bool {
        duration > 0 && position >= duration - 15
    }

    /// Fraction for the thin progress line, 0 when unknown.
    var fraction: Double {
        guard duration > 0 else { return 0 }
        return min(1, max(0, position / duration))
    }
}

/// Remembers how far each podcast episode was played, so a feed can be
/// continued after switching tabs or restarting the app.
@MainActor
@Observable
final class EpisodeProgressStore {
    private(set) var entries: [String: EpisodeProgress] = [:]

    @ObservationIgnored private static let key = "navideck.episode-progress"
    @ObservationIgnored private var lastSave = Date.distantPast

    init() {
        load()
    }

    func progress(for id: String) -> EpisodeProgress? {
        guard let progress = entries[id], !progress.isFinished else { return nil }
        return progress
    }

    /// The episode of a channel that was heard most recently.
    func latestEpisodeID(in channel: PodcastChannel) -> String? {
        channel.episodes
            .compactMap { episode -> (String, Date)? in
                guard let progress = entries[episode.playableID], !progress.isFinished else { return nil }
                return (episode.playableID, progress.updated)
            }
            .max { $0.1 < $1.1 }?
            .0
    }

    func record(id: String, position: Double, duration: Double) {
        guard !id.isEmpty else { return }
        let total = duration > 0 ? duration : entries[id]?.duration ?? 0
        guard position > 5, total <= 0 || position < total - 15 else {
            if entries[id] != nil {
                entries[id] = nil
                save(force: true)
            }
            return
        }
        entries[id] = EpisodeProgress(position: position, duration: total, updated: Date())
        save(force: false)
    }

    func clear(id: String) {
        guard entries[id] != nil else { return }
        entries[id] = nil
        save(force: true)
    }

    // MARK: - Persistence

    private func save(force: Bool) {
        guard force || Date().timeIntervalSince(lastSave) > 5 else { return }
        lastSave = Date()

        // Keep the store small; old entries are not interesting.
        if entries.count > 300 {
            let keep = entries
                .sorted { $0.value.updated > $1.value.updated }
                .prefix(200)
            entries = Dictionary(uniqueKeysWithValues: keep.map { ($0.key, $0.value) })
        }

        guard let data = try? JSONEncoder().encode(entries) else { return }
        UserDefaults.standard.set(data, forKey: Self.key)
    }

    private func load() {
        guard let data = UserDefaults.standard.data(forKey: Self.key),
              let stored = try? JSONDecoder().decode([String: EpisodeProgress].self, from: data) else { return }
        entries = stored
    }
}
