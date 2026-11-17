import AVFoundation
import Foundation
import MediaPlayer
import Observation
import UIKit

enum RepeatMode: String, Codable, Sendable {
    case off
    case all
    case one

    var label: String {
        switch self {
        case .off: return "Wiederholung aus"
        case .all: return "Alles wiederholen"
        case .one: return "Titel wiederholen"
        }
    }

    var symbol: String {
        switch self {
        case .off, .all: return "repeat"
        case .one: return "repeat.1"
        }
    }
}

/// Owns the AVPlayer and the queue. The queue survives app restarts per server,
/// and the lock screen gets correct metadata and working controls.
@MainActor
@Observable
final class PlayerService {
    @ObservationIgnored private let player = AVPlayer()
    @ObservationIgnored private var client: SubsonicClient?
    @ObservationIgnored private var profileID: UUID?

    /// Lokale Dateien aus dem Download-Speicher; gesetzt vom AppModel.
    @ObservationIgnored var localURL: ((String) -> URL?)?
    /// Obergrenze fürs Streaming in kbit/s (0 = Originaldatei).
    @ObservationIgnored var streamBitRate: () -> Int = { 0 }
    @ObservationIgnored private var timeObserver: Any?
    @ObservationIgnored private var endObserver: NSObjectProtocol?
    @ObservationIgnored private var itemStatusObserver: NSKeyValueObservation?
    @ObservationIgnored private var artworkTask: Task<Void, Never>?
    @ObservationIgnored private var scrobbled = false
    @ObservationIgnored private var pendingResume: Double = 0
    @ObservationIgnored private var isSeeking = false
    @ObservationIgnored private var sessionConfigured = false
    @ObservationIgnored private var lastSaved = Date.distantPast

    private(set) var queue: [Song] = []
    private(set) var index = 0
    private(set) var isPlaying = false
    private(set) var isLoading = false
    private(set) var currentTime: Double = 0
    private(set) var duration: Double = 0
    private(set) var shuffleEnabled = false
    private(set) var repeatMode: RepeatMode = .off

    var errorMessage: String?
    var showNowPlaying = false
    var showQueue = false

    var current: Song? {
        queue.indices.contains(index) ? queue[index] : nil
    }

    var hasQueue: Bool { !queue.isEmpty }

    var canGoPrevious: Bool { index > 0 || repeatMode == .all }

    // MARK: - Lifecycle

    init() {
        // Ohne dieses Warten startet ein Titel, sobald die ersten Daten da
        // sind – der Wechsel zwischen Titeln fühlt sich dadurch kürzer an.
        player.automaticallyWaitsToMinimizeStalling = false
        player.actionAtItemEnd = .pause

        timeObserver = player.addPeriodicTimeObserver(
            forInterval: CMTime(seconds: 0.5, preferredTimescale: 600),
            queue: .main
        ) { [weak self] time in
            MainActor.assumeIsolated {
                self?.tick(time)
            }
        }

        endObserver = NotificationCenter.default.addObserver(
            forName: AVPlayerItem.didPlayToEndTimeNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            MainActor.assumeIsolated {
                self?.handleTrackEnd()
            }
        }

        NotificationCenter.default.addObserver(
            forName: AVAudioSession.interruptionNotification,
            object: nil,
            queue: .main
        ) { [weak self] note in
            MainActor.assumeIsolated {
                self?.handleInterruption(note)
            }
        }

        NotificationCenter.default.addObserver(
            forName: AVAudioSession.routeChangeNotification,
            object: nil,
            queue: .main
        ) { [weak self] note in
            MainActor.assumeIsolated {
                self?.handleRouteChange(note)
            }
        }

        configureRemoteCommands()
    }

    func configure(client: SubsonicClient, profileID: UUID) {
        self.client = client
        self.profileID = profileID
        player.pause()
        player.replaceCurrentItem(with: nil)
        queue = []
        index = 0
        currentTime = 0
        duration = 0
        isPlaying = false
        isLoading = false
        scrobbled = false
        errorMessage = nil
        pendingResume = 0
        restoreState(profileID: profileID)
    }

    func stop() {
        player.pause()
        player.replaceCurrentItem(with: nil)
        client = nil
        profileID = nil
        queue = []
        index = 0
        currentTime = 0
        duration = 0
        isPlaying = false
        isLoading = false
        pendingResume = 0
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
        MPNowPlayingInfoCenter.default().playbackState = .stopped
    }

    // MARK: - Playback

    func play(_ songs: [Song], startingAt startIndex: Int = 0) {
        guard !songs.isEmpty else { return }
        var list = songs
        var start = min(max(0, startIndex), list.count - 1)

        if shuffleEnabled && list.count > 1 {
            let started = list[start]
            list.shuffle()
            start = list.firstIndex(where: { $0.id == started.id }) ?? 0
        }

        queue = list
        index = start
        scrobbled = false
        pendingResume = 0
        loadCurrent(autoplay: true, resume: 0)
    }

    func play(song: Song, within songs: [Song]) {
        let start = songs.firstIndex(where: { $0.id == song.id }) ?? 0
        play(songs, startingAt: start)
    }

    func toggle() {
        if player.currentItem == nil {
            guard current != nil else { return }
            loadCurrent(autoplay: true, resume: pendingResume)
            return
        }
        if isPlaying {
            pause()
        } else {
            resume()
        }
    }

    func resume() {
        guard current != nil else { return }
        if player.currentItem == nil {
            loadCurrent(autoplay: true, resume: pendingResume)
            return
        }
        activateAudioSession()
        player.play()
        isPlaying = true
        updateNowPlaying()
    }

    func pause() {
        player.pause()
        isPlaying = false
        updateNowPlaying()
        saveState()
    }

    func next() {
        advance(automatic: false)
    }

    func previous() {
        if currentTime > 3 {
            seek(to: 0)
            return
        }
        guard !queue.isEmpty else { return }
        if index > 0 {
            index -= 1
        } else if repeatMode == .all {
            index = queue.count - 1
        } else {
            seek(to: 0)
            return
        }
        scrobbled = false
        pendingResume = 0
        loadCurrent(autoplay: isPlaying, resume: 0)
    }

    func seek(to seconds: Double) {
        let target = max(0, min(seconds, duration > 0 ? duration : seconds))
        currentTime = target
        isSeeking = true
        player.seek(
            to: CMTime(seconds: target, preferredTimescale: 600),
            toleranceBefore: .zero,
            toleranceAfter: .zero
        ) { [weak self] _ in
            Task { @MainActor in
                self?.isSeeking = false
                self?.updateNowPlaying()
            }
        }
    }

    func skip(by seconds: Double) {
        seek(to: currentTime + seconds)
    }

    func playNext(_ songs: [Song]) {
        guard !songs.isEmpty else { return }
        let insertAt = min(index + 1, queue.count)
        queue.insert(contentsOf: songs, at: insertAt)
        saveState()
    }

    func addToQueue(_ songs: [Song]) {
        guard !songs.isEmpty else { return }
        queue.append(contentsOf: songs)
        saveState()
    }

    func jump(to queueIndex: Int) {
        guard queue.indices.contains(queueIndex) else { return }
        index = queueIndex
        scrobbled = false
        pendingResume = 0
        loadCurrent(autoplay: true, resume: 0)
    }

    func removeFromQueue(at offsets: IndexSet) {
        let playing = current
        let adjusted = offsets.filter { $0 < queue.count }
        for offset in adjusted.sorted(by: >) {
            queue.remove(at: offset)
            if offset < index { index -= 1 }
        }
        if queue.isEmpty {
            stopPlaybackKeepingClient()
            return
        }
        index = min(index, queue.count - 1)
        if let playing, current?.id != playing.id {
            scrobbled = false
            loadCurrent(autoplay: isPlaying, resume: 0)
        }
        saveState()
    }

    func clearQueue() {
        stopPlaybackKeepingClient()
    }

    func toggleShuffle() {
        shuffleEnabled.toggle()
        if shuffleEnabled {
            var rest = queue
            if let playing = current {
                rest.removeAll { $0.id == playing.id }
                rest.shuffle()
                queue = [playing] + rest
                index = 0
            }
        }
        saveState()
    }

    func cycleRepeat() {
        switch repeatMode {
        case .off: repeatMode = .all
        case .all: repeatMode = .one
        case .one: repeatMode = .off
        }
        saveState()
    }

    func toggleStarCurrent() {
        guard let song = current, let client else { return }
        let willStar = song.starred == nil
        if queue.indices.contains(index) {
            queue[index].starred = willStar ? ISO8601DateFormatter().string(from: Date()) : nil
        }
        Task {
            if willStar {
                try? await client.star(id: song.id)
            } else {
                try? await client.unstar(id: song.id)
            }
        }
    }

    // MARK: - Item loading

    /// Plays a stream that does not belong to the library (radio stations).
    func playExternal(url: URL, song: Song) {
        queue = [song]
        index = 0
        scrobbled = true
        pendingResume = 0
        loadItem(url: url, song: song, autoplay: true, resume: 0)
    }

    private func loadCurrent(autoplay: Bool, resume: Double) {
        guard let song = current, let client else { return }
        if let local = localURL?(song.id) {
            loadItem(url: local, song: song, autoplay: autoplay, resume: resume)
            return
        }
        guard let url = client.streamURL(id: song.id, maxBitRate: streamBitRate()) else {
            errorMessage = "Für diesen Titel gibt es keine Stream-Adresse."
            return
        }
        loadItem(url: url, song: song, autoplay: autoplay, resume: resume)
    }

    private func loadItem(url: URL, song: Song, autoplay: Bool, resume: Double) {
        let asset = AVURLAsset(url: url)
        let item = AVPlayerItem(asset: asset)
        item.preferredForwardBufferDuration = 8
        itemStatusObserver = item.observe(\.status, options: [.new]) { [weak self] item, _ in
            Task { @MainActor in
                self?.handleItemStatus(item)
            }
        }

        player.replaceCurrentItem(with: item)
        duration = Double(song.duration ?? 0)
        currentTime = max(0, resume)
        isLoading = true
        errorMessage = nil
        pendingResume = max(0, resume)

        if resume > 0 {
            player.seek(
                to: CMTime(seconds: resume, preferredTimescale: 600),
                toleranceBefore: .zero,
                toleranceAfter: .zero
            )
        }

        if autoplay {
            activateAudioSession()
            player.play()
            isPlaying = true
        } else {
            isPlaying = false
        }

        if !scrobbled {
            announceStart(to: client, song: song)
        }
        updateNowPlaying()
        saveState()
    }

    private func handleItemStatus(_ item: AVPlayerItem) {
        guard item === player.currentItem else { return }
        switch item.status {
        case .readyToPlay:
            isLoading = false
            if let song = current, let songDuration = song.duration, songDuration > 0 {
                let itemDuration = item.duration.seconds
                if !itemDuration.isFinite || itemDuration <= 0 {
                    duration = Double(songDuration)
                }
            }
        case .failed:
            isLoading = false
            isPlaying = false
            errorMessage = item.error?.localizedDescription ?? "Der Titel konnte nicht geladen werden."
        default:
            break
        }
    }

    private func announceStart(to client: SubsonicClient?, song: Song) {
        guard let client, !song.id.isEmpty else { return }
        Task {
            await client.scrobble(id: song.id, submission: false)
        }
    }

    private func advance(automatic: Bool) {
        guard !queue.isEmpty else { return }

        if automatic && repeatMode == .one {
            seek(to: 0)
            resume()
            return
        }

        if index + 1 < queue.count {
            index += 1
            scrobbled = false
            pendingResume = 0
            loadCurrent(autoplay: true, resume: 0)
            return
        }

        if repeatMode == .all {
            index = 0
            scrobbled = false
            pendingResume = 0
            loadCurrent(autoplay: true, resume: 0)
            return
        }

        // End of the queue: stay on the last track, paused at its start.
        isPlaying = false
        player.pause()
        saveState()
    }

    private func handleTrackEnd() {
        advance(automatic: true)
    }

    private func stopPlaybackKeepingClient() {
        player.pause()
        player.replaceCurrentItem(with: nil)
        queue = []
        index = 0
        currentTime = 0
        duration = 0
        isPlaying = false
        isLoading = false
        pendingResume = 0
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
        saveState()
    }

    // MARK: - Ticks

    private func tick(_ time: CMTime) {
        let seconds = time.seconds
        if !isSeeking, seconds.isFinite, seconds >= 0 {
            currentTime = seconds
        }

        if let itemDuration = player.currentItem?.duration.seconds,
           itemDuration.isFinite, itemDuration > 0 {
            duration = itemDuration
        } else if duration <= 0, let songDuration = current?.duration {
            duration = Double(songDuration)
        }

        let playing = player.timeControlStatus == .playing
        if playing != isPlaying {
            isPlaying = playing
        }
        if playing && isLoading {
            isLoading = false
        }

        maybeSubmitScrobble()
        refreshNowPlayingProgress()
        saveStateIfNeeded()
    }

    private func maybeSubmitScrobble() {
        guard !scrobbled, let song = current, let client else { return }
        let threshold = min(240, max(30, duration * 0.5))
        guard duration > 0, currentTime >= threshold else { return }
        scrobbled = true
        Task {
            await client.scrobble(id: song.id, submission: true)
        }
    }

    // MARK: - Audio session

    private func activateAudioSession() {
        let session = AVAudioSession.sharedInstance()
        if !sessionConfigured {
            try? session.setCategory(.playback, mode: .default, options: [])
            sessionConfigured = true
        }
        try? session.setActive(true)
    }

    private func handleInterruption(_ note: Notification) {
        guard let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
              let type = AVAudioSession.InterruptionType(rawValue: raw) else { return }
        switch type {
        case .began:
            isPlaying = false
            updateNowPlaying()
        case .ended:
            if let optionsRaw = note.userInfo?[AVAudioSessionInterruptionOptionKey] as? UInt {
                let options = AVAudioSession.InterruptionOptions(rawValue: optionsRaw)
                if options.contains(.shouldResume) {
                    resume()
                }
            }
        @unknown default:
            break
        }
    }

    private func handleRouteChange(_ note: Notification) {
        guard let raw = note.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt,
              let reason = AVAudioSession.RouteChangeReason(rawValue: raw) else { return }
        if reason == .oldDeviceUnavailable {
            pause()
        }
    }

    // MARK: - Remote commands

    private func configureRemoteCommands() {
        let center = MPRemoteCommandCenter.shared()
        center.playCommand.isEnabled = true
        center.pauseCommand.isEnabled = true
        center.togglePlayPauseCommand.isEnabled = true
        center.nextTrackCommand.isEnabled = true
        center.previousTrackCommand.isEnabled = true
        center.changePlaybackPositionCommand.isEnabled = true

        center.playCommand.addTarget { [weak self] _ in
            Task { @MainActor in self?.resume() }
            return .success
        }
        center.pauseCommand.addTarget { [weak self] _ in
            Task { @MainActor in self?.pause() }
            return .success
        }
        center.togglePlayPauseCommand.addTarget { [weak self] _ in
            Task { @MainActor in self?.toggle() }
            return .success
        }
        center.nextTrackCommand.addTarget { [weak self] _ in
            Task { @MainActor in self?.next() }
            return .success
        }
        center.previousTrackCommand.addTarget { [weak self] _ in
            Task { @MainActor in self?.previous() }
            return .success
        }
        center.changePlaybackPositionCommand.addTarget { [weak self] event in
            guard let event = event as? MPChangePlaybackPositionCommandEvent else {
                return .commandFailed
            }
            Task { @MainActor in self?.seek(to: event.positionTime) }
            return .success
        }

        MPNowPlayingInfoCenter.default().playbackState = .stopped
    }

    private func updateNowPlaying(full: Bool = true) {
        guard let song = current else {
            MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
            return
        }

        var info = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
        info[MPMediaItemPropertyTitle] = song.title
        info[MPMediaItemPropertyArtist] = song.artist ?? ""
        info[MPMediaItemPropertyAlbumTitle] = song.album ?? ""
        info[MPMediaItemPropertyPlaybackDuration] = duration
        info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = currentTime
        info[MPNowPlayingInfoPropertyPlaybackRate] = isPlaying ? 1.0 : 0.0
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
        MPNowPlayingInfoCenter.default().playbackState = isPlaying ? .playing : .paused

        if full {
            loadArtwork(for: song)
        }
    }

    private func refreshNowPlayingProgress() {
        guard current != nil else { return }
        var info = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
        info[MPMediaItemPropertyPlaybackDuration] = duration
        info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = currentTime
        info[MPNowPlayingInfoPropertyPlaybackRate] = isPlaying ? 1.0 : 0.0
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
    }

    private func loadArtwork(for song: Song) {
        artworkTask?.cancel()
        guard let url = client?.coverURL(id: song.coverArt, size: 600) else { return }
        artworkTask = Task { @MainActor [weak self] in
            guard let image = await ImageStore.shared.image(for: url),
                  !Task.isCancelled else { return }
            let artwork = MPMediaItemArtwork(boundsSize: image.size) { _ in image }
            guard self?.current?.id == song.id else { return }
            var info = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
            info[MPMediaItemPropertyArtwork] = artwork
            MPNowPlayingInfoCenter.default().nowPlayingInfo = info
        }
    }

    // MARK: - Persistence

    private struct Snapshot: Codable {
        var songs: [Song]
        var index: Int
        var time: Double
        var shuffle: Bool
        var repeatMode: RepeatMode
    }

    private func storageKey(_ profileID: UUID) -> String {
        "navideck.queue.\(profileID.uuidString)"
    }

    /// Called when the app leaves the foreground.
    func saveNow() {
        saveState()
    }

    private func saveState() {
        guard let profileID else { return }
        let snapshot = Snapshot(
            songs: queue,
            index: index,
            time: currentTime,
            shuffle: shuffleEnabled,
            repeatMode: repeatMode
        )
        if let data = try? JSONEncoder().encode(snapshot) {
            UserDefaults.standard.set(data, forKey: storageKey(profileID))
        }
        lastSaved = Date()
    }

    private func saveStateIfNeeded() {
        guard isPlaying || queue.isEmpty else { return }
        if Date().timeIntervalSince(lastSaved) > 10 {
            saveState()
        }
    }

    private func restoreState(profileID: UUID) {
        guard let data = UserDefaults.standard.data(forKey: storageKey(profileID)),
              let snapshot = try? JSONDecoder().decode(Snapshot.self, from: data),
              !snapshot.songs.isEmpty else { return }

        queue = snapshot.songs
        index = min(max(0, snapshot.index), snapshot.songs.count - 1)
        shuffleEnabled = snapshot.shuffle
        repeatMode = snapshot.repeatMode
        currentTime = max(0, snapshot.time)
        pendingResume = currentTime
        duration = Double(snapshot.songs[index].duration ?? 0)
    }
}
