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
    /// A queue player instead of a single-item player: the next song is
    /// appended while the current one plays, so tracks change without the
    /// network round-trip and the buffering pause in between.
    @ObservationIgnored private let player = AVQueuePlayer()
    /// Items currently inside the queue player, in playback order, together
    /// with the song index they belong to.
    @ObservationIgnored private var playerSongs: [(songIndex: Int, songID: String, item: AVPlayerItem)] = []
    @ObservationIgnored private var client: SubsonicClient?
    @ObservationIgnored private var profileID: UUID?

    /// Lokale Dateien aus dem Download-Speicher; gesetzt vom AppModel.
    @ObservationIgnored var localURL: ((String) -> URL?)?
    /// Direct stream URLs for sources without a Subsonic client (audiobooks).
    @ObservationIgnored var externalURLResolver: ((Song) -> URL?)?
    /// Full assets for sources that need request headers (Audiobookshelf).
    @ObservationIgnored var externalAssetResolver: ((Song) -> AVURLAsset?)?
    /// Obergrenze fürs Streaming in kbit/s (0 = Originaldatei).
    @ObservationIgnored var streamBitRate: () -> Int = { 0 }
    /// Reports playback position so podcast episodes can be continued later.
    @ObservationIgnored var progressSink: ((Song, Double, Double, Bool) -> Void)?
    /// Lets the library refresh when a song was starred from the player.
    @ObservationIgnored var onFavoriteChange: (() -> Void)?
    @ObservationIgnored private var lastProgressReport = Date.distantPast
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
        // The queue player must move on to the preloaded item; pausing here
        // stopped playback after the first song.
        player.actionAtItemEnd = .advance

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
        ) { [weak self] note in
            MainActor.assumeIsolated {
                guard let item = note.object as? AVPlayerItem else { return }
                self?.handleTrackEnd(item)
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

    /// Keeps the Subsonic queue intact; audiobooks are played through the
    /// external URL resolver and do not need a client.
    func configureAudiobookshelf() {}

    func configure(client: SubsonicClient, profileID: UUID) {
        self.client = client
        self.profileID = profileID
        player.pause()
        player.removeAllItems()
        playerSongs = []
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
        player.removeAllItems()
        playerSongs = []
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

    func play(_ songs: [Song], startingAt startIndex: Int = 0, resumeAt resume: Double = 0) {
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
        lastProgressReport = .distantPast
        startPlayback(at: start, autoplay: true, resume: resume)
    }

    func play(song: Song, within songs: [Song]) {
        let start = songs.firstIndex(where: { $0.id == song.id }) ?? 0
        play(songs, startingAt: start)
    }

    func toggle() {
        if player.currentItem == nil {
            guard current != nil else { return }
            startPlayback(at: index, autoplay: true, resume: pendingResume)
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
            startPlayback(at: index, autoplay: true, resume: pendingResume)
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
        reportProgress(force: true)
        saveState()
    }

    func next() {
        advance()
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
        startPlayback(at: index, autoplay: isPlaying, resume: 0)
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
        // The preloaded item is outdated now; swap it for the new first up.
        preloadNext()
        saveState()
    }

    func addToQueue(_ songs: [Song]) {
        guard !songs.isEmpty else { return }
        queue.append(contentsOf: songs)
        preloadNext()
        saveState()
    }

    func jump(to queueIndex: Int) {
        jump(to: queueIndex, autoplay: true)
    }

    private func jump(to queueIndex: Int, autoplay: Bool) {
        guard queue.indices.contains(queueIndex) else { return }
        index = queueIndex
        scrobbled = false
        pendingResume = 0
        startPlayback(at: queueIndex, autoplay: autoplay, resume: 0)
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
            startPlayback(at: index, autoplay: isPlaying, resume: 0)
        } else {
            preloadNext()
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
                if !playerSongs.isEmpty {
                    playerSongs[0] = (0, playing.id, playerSongs[0].item)
                }
                preloadNext()
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
        toggleStar(at: index)
    }

    /// Stars or unstars one entry of the queue.
    func toggleStar(at queueIndex: Int) {
        guard queue.indices.contains(queueIndex), let client else { return }
        let song = queue[queueIndex]
        let willStar = song.starred == nil
        queue[queueIndex].starred = willStar ? ISO8601DateFormatter().string(from: Date()) : nil

        Task {
            do {
                if willStar {
                    try await client.star(id: song.id)
                } else {
                    try await client.unstar(id: song.id)
                }
                await MainActor.run { self.onFavoriteChange?() }
            } catch {
                await MainActor.run {
                    if self.queue.indices.contains(queueIndex) {
                        self.queue[queueIndex].starred = willStar ? nil : song.starred
                    }
                    self.errorMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
                }
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

        // Radio is a single stream: no preload, no automatic advance.
        let item = makeItem(url: url, song: song)
        player.removeAllItems()
        playerSongs = [(0, song.id, item)]
        player.insert(item, after: nil)
        duration = 0
        currentTime = 0
        isLoading = true
        errorMessage = nil
        activateAudioSession()
        player.play()
        isPlaying = true
        updateNowPlaying()
        saveState()
    }

    /// Stream URL for a queue entry, preferring the offline file.
    private func playbackURL(for queueIndex: Int) -> URL? {
        guard queue.indices.contains(queueIndex) else { return nil }
        let song = queue[queueIndex]
        // Downloaded files always win, even for sources with their own URLs.
        if let local = localURL?(song.id) { return local }
        if let external = externalURLResolver?(song) { return external }
        guard let client else { return nil }
        return client.streamURL(id: song.id, maxBitRate: streamBitRate())
    }

    private func makeItem(url: URL, song: Song?) -> AVPlayerItem {
        let asset: AVURLAsset
        if let song, let external = externalAssetResolver?(song) {
            asset = external
        } else {
            asset = AVURLAsset(url: url)
        }
        let item = AVPlayerItem(asset: asset)
        // Enough runway for the next song to be buffered when the current one
        // ends, which is what makes the transition gapless.
        item.preferredForwardBufferDuration = 12
        itemStatusObserver = item.observe(\.status, options: [.new]) { [weak self] item, _ in
            Task { @MainActor in
                self?.handleItemStatus(item)
            }
        }
        return item
    }

    /// Starts the queue at `queueIndex` and preloads the following entry.
    private func startPlayback(at queueIndex: Int, autoplay: Bool, resume: Double) {
        guard let url = playbackURL(for: queueIndex) else {
            errorMessage = "Für diesen Titel gibt es keine Stream-Adresse."
            return
        }

        let song = queue[queueIndex]
        let item = makeItem(url: url, song: song)
        player.removeAllItems()
        playerSongs = [(queueIndex, song.id, item)]
        player.insert(item, after: nil)

        duration = Double(queue[queueIndex].duration ?? 0)
        currentTime = max(0, resume)
        isLoading = true
        errorMessage = nil
        pendingResume = max(0, resume)
        applyPendingResume()

        if autoplay {
            activateAudioSession()
            player.play()
            isPlaying = true
        } else {
            isPlaying = false
        }

        if !scrobbled, let song = current {
            announceStart(to: client, song: song)
        }
        updateNowPlaying()
        preloadNext()
        saveState()
    }

    /// Keeps exactly one song queued behind the current one, so the queue
    /// player can cross the track boundary without a network pause.
    private func preloadNext() {
        guard let last = playerSongs.last else { return }

        let desired: Int?
        if repeatMode == .one {
            desired = last.songIndex
        } else if last.songIndex + 1 < queue.count {
            desired = last.songIndex + 1
        } else if repeatMode == .all, !queue.isEmpty {
            desired = 0
        } else {
            desired = nil
        }
        let desiredID = desired.flatMap { queue.indices.contains($0) ? queue[$0].id : nil }

        if playerSongs.count > 1 {
            let upcoming = playerSongs[1]
            let stale = playerSongs.count > 2
                || desiredID == nil
                || (repeatMode != .one && upcoming.songID != desiredID)
            if stale {
                for extra in playerSongs.dropFirst() {
                    player.remove(extra.item)
                }
                playerSongs.removeSubrange(1...)
            }
        }

        guard playerSongs.count == 1, let desired, queue.indices.contains(desired) else { return }
        guard let url = playbackURL(for: desired) else { return }
        let upcoming = queue[desired]
        let item = makeItem(url: url, song: upcoming)
        player.insert(item, after: playerSongs[0].item)
        playerSongs.append((desired, queue[desired].id, item))
    }

    private func handleItemStatus(_ item: AVPlayerItem) {
        guard item === player.currentItem else { return }
        switch item.status {
        case .readyToPlay:
            isLoading = false
            // A seek issued before the asset is ready may be dropped. Repeat
            // it now so an audiobook really resumes where it stopped.
            applyPendingResume()
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

    /// Seeks to the saved position once the item can actually honour it.
    private func applyPendingResume() {
        guard pendingResume > 0 else {
            isSeeking = false
            return
        }
        let target = pendingResume
        isSeeking = true
        player.seek(
            to: CMTime(seconds: target, preferredTimescale: 600),
            toleranceBefore: .zero,
            toleranceAfter: .zero
        ) { [weak self] finished in
            Task { @MainActor in
                guard let self else { return }
                self.isSeeking = false
                if finished { self.pendingResume = 0 }
                self.updateNowPlaying()
            }
        }
    }

    private func announceStart(to client: SubsonicClient?, song: Song) {
        guard let client, !song.id.isEmpty, !song.id.hasPrefix("abs:") else { return }
        Task {
            await client.scrobble(id: song.id, submission: false)
        }
    }

    private func advance() {
        guard !queue.isEmpty else { return }

        if index + 1 < queue.count {
            jump(to: index + 1, autoplay: true)
            return
        }
        if repeatMode == .all {
            jump(to: 0, autoplay: true)
            return
        }

        // End of the queue: stay on the last track, paused at its start.
        isPlaying = false
        player.pause()
        saveState()
    }

    /// The queue player already moved on to the preloaded item; only the app
    /// state, the metadata and the next preload have to follow.
    private func handleTrackEnd(_ finishedItem: AVPlayerItem) {
        guard let finished = playerSongs.first, finished.item === finishedItem else { return }

        let finishedIndex = finished.songIndex
        if queue.indices.contains(finishedIndex) {
            progressSink?(queue[finishedIndex], duration, duration, true)
        }
        playerSongs.removeFirst()

        if let upcoming = playerSongs.first {
            index = upcoming.songIndex
            scrobbled = false
            pendingResume = 0
            currentTime = 0
            duration = Double(queue[index].duration ?? 0)
            if let song = current {
                announceStart(to: client, song: song)
            }
            updateNowPlaying()
            preloadNext()
            saveState()
            return
        }

        // Nothing was preloaded: the queue is finished.
        isPlaying = false
        player.pause()
        index = min(max(0, finishedIndex), max(0, queue.count - 1))
        currentTime = 0
        saveState()
    }

    private func stopPlaybackKeepingClient() {
        // Remember where the episode stopped before the queue disappears.
        reportProgress(force: true)
        player.pause()
        player.removeAllItems()
        playerSongs = []
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
        if pendingResume > 0, seconds.isFinite, seconds >= pendingResume - 0.5 {
            pendingResume = 0
            isSeeking = false
        }
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
        if playing { reportProgress(force: false) }
    }

    /// Hands the current position to the app, throttled while playing.
    private func reportProgress(force: Bool) {
        guard let song = current, let sink = progressSink else { return }
        guard force || isPlaying else { return }
        guard force || Date().timeIntervalSince(lastProgressReport) > 4 else { return }
        lastProgressReport = Date()
        sink(song, currentTime, duration, force)
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

    #if DEBUG
    /// Simulator helper: jump close to the end so the gapless transition can
    /// be checked without waiting four minutes.
    func demoTickToEnd() {
        seek(to: max(0, duration - 1))
    }
    #endif

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
