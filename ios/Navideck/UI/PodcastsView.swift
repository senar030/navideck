import SwiftUI

/// Podcast channels from the server, with their episodes.
///
/// The feeds are cached in `AppModel` (15 minutes), so switching tabs shows the
/// list immediately instead of refetching every channel. Rows are lazy and the
/// channel screen pages through long feeds.
struct PodcastsView: View {
    @Environment(AppModel.self) private var app

    @State private var loading = false
    @State private var errorMessage: String?
    @State private var continued: [ContinuedEpisode] = []
    @State private var index: [String: EpisodeLocation] = [:]
    @State private var demoChannel: PodcastChannel?

    private var channels: [PodcastChannel] { app.podcastSnapshot?.channels ?? [] }
    private var newest: [PodcastEpisode] { app.podcastSnapshot?.newest ?? [] }

    var body: some View {
        Group {
            if app.offlineMode {
                OfflineEpisodesView()
            } else if app.podcastBackend == .audiobookshelf {
                AbsPodcastsView()
            } else {
                library
            }
        }
        .navigationTitle("Podcasts")
        .offlineModeToolbar()
        .task {
            if app.podcastBackend == .audiobookshelf {
                await app.loadPodcasts()
            } else {
                await load()
            }
        }
    }

    private var library: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 0) {
                if let errorMessage {
                    ErrorBanner(message: errorMessage)
                        .padding(.horizontal, 20)
                        .padding(.bottom, 8)
                }

                if !continued.isEmpty {
                    SectionHeader(title: "Weiterhören")
                        .padding(.bottom, 6)

                    ForEach(Array(continued.enumerated()), id: \.element.episode.playableID) { offset, item in
                        continuedRow(item)
                            .padding(.horizontal, 20)
                            .padding(.vertical, 6)

                        if offset < continued.count - 1 {
                            Divider().overlay(Theme.hairline).padding(.leading, 76)
                        }
                    }
                }

                if !newest.isEmpty {
                    SectionHeader(title: "Neueste Folgen")
                        .padding(.top, continued.isEmpty ? 0 : 18)
                        .padding(.bottom, 6)

                    let resumed = Set(continued.map { $0.episode.playableID })
                    let latest = Array(newest.filter { !resumed.contains($0.playableID) }.prefix(6))
                    ForEach(Array(latest.enumerated()), id: \.element.playableID) { offset, episode in
                        latestRow(episode)
                            .padding(.horizontal, 20)
                            .padding(.vertical, 6)

                        if offset < latest.count - 1 {
                            Divider().overlay(Theme.hairline).padding(.leading, 76)
                        }
                    }
                }

                if !channels.isEmpty {
                    SectionHeader(title: "Sender")
                        .padding(.top, 18)
                        .padding(.bottom, 6)
                }

                ForEach(Array(channels.enumerated()), id: \.element.id) { offset, channel in
                    NavigationLink {
                        PodcastChannelView(channel: channel)
                    } label: {
                        channelRow(channel)
                            .padding(.horizontal, 20)
                            .padding(.vertical, 6)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)

                    if offset < channels.count - 1 {
                        Divider().overlay(Theme.hairline).padding(.leading, 76)
                    }
                }
            }
            .padding(.vertical, 10)

            if loading && channels.isEmpty {
                ProgressView().tint(Theme.accent).padding(.vertical, 40)
            }

            if channels.isEmpty && !loading && errorMessage == nil {
                EmptyStateView(
                    icon: "waveform",
                    title: "Keine Podcasts",
                    message: "Abonnierte Podcasts erscheinen hier, sobald der Server sie kennt."
                )
            }
        }
        .navideckScreen()
        .navigationDestination(item: $demoChannel) { channel in
            PodcastChannelView(channel: channel)
        }
        .refreshable { await load(force: true) }
        .onChange(of: app.episodeProgress.entries) { _, _ in
            rebuildContinued()
        }
    }

    // MARK: - Rows

    private func continuedRow(_ item: ContinuedEpisode) -> some View {
        Button {
            play(item.episode, in: item.channel)
        } label: {
            HStack(spacing: 12) {
                CoverArtView(url: app.artworkURL(item.episode.coverArt ?? item.channel.coverArt, size: 160))
                    .frame(width: 52, height: 52)

                VStack(alignment: .leading, spacing: 3) {
                    Text(item.episode.title)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(Theme.text)
                        .lineLimit(2)

                    Text(item.channel.title)
                        .font(.caption2)
                        .foregroundStyle(Theme.muted)
                        .lineLimit(1)

                    progressLine(item.progress)
                        .padding(.top, 2)

                    Text(remainingText(item))
                        .font(.caption2.monospacedDigit())
                        .foregroundStyle(Theme.accent)
                }

                Spacer(minLength: 8)

                Image(systemName: "play.fill")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.accent)
                    .frame(width: 32, height: 32)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func latestRow(_ episode: PodcastEpisode) -> some View {
        HStack(spacing: 4) {
            Button {
                if let channel = index[episode.playableID]?.channel {
                    play(episode, in: channel)
                } else {
                    app.playEpisodes([episode])
                }
            } label: {
                HStack(spacing: 12) {
                    CoverArtView(url: app.artworkURL(episode.coverArt, size: 160))
                        .frame(width: 52, height: 52)

                    VStack(alignment: .leading, spacing: 2) {
                        Text(episode.title)
                            .font(.subheadline)
                            .foregroundStyle(Theme.text)
                            .lineLimit(2)
                            .multilineTextAlignment(.leading)
                        Text(meta(episode))
                            .font(.caption2)
                            .foregroundStyle(Theme.muted)
                            .lineLimit(1)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            downloadButton(episode)
        }
    }

    private func channelRow(_ channel: PodcastChannel) -> some View {
        HStack(spacing: 12) {
            CoverArtView(url: channelImage(channel), maxPixel: 700)
                .frame(width: 52, height: 52)

            VStack(alignment: .leading, spacing: 2) {
                Text(channel.title)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Theme.text)
                    .lineLimit(1)
                Text(channel.episodes.isEmpty
                     ? "Keine Folgen"
                     : "\(channel.episodes.count) Folgen")
                    .font(.caption2)
                    .foregroundStyle(Theme.muted)
            }

            Spacer()

            if let id = app.episodeProgress.latestEpisodeID(in: channel),
               let latest = channel.episodes.first(where: { $0.playableID == id }) {
                Text(remainingText(episode: latest))
                    .font(.caption2.monospacedDigit())
                    .foregroundStyle(Theme.accent.opacity(0.9))
            }

            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Theme.muted.opacity(0.7))
        }
    }

    // MARK: - Building blocks

    private func downloadButton(_ episode: PodcastEpisode) -> some View {
        Group {
            if app.isDownloaded(episode) {
                SquareIconButton(
                    systemName: "arrow.down.circle.fill",
                    active: true,
                    size: 34,
                    accessibilityTitle: "Download entfernen"
                ) {
                    app.removeDownload(episode)
                }
            } else if app.isDownloading(episode) {
                SquareIconButton(
                    systemName: "stop.circle",
                    size: 34,
                    accessibilityTitle: "Download abbrechen"
                ) {
                    app.cancelDownload(episode)
                }
            } else {
                SquareIconButton(
                    systemName: "arrow.down.circle",
                    size: 34,
                    accessibilityTitle: "Folge herunterladen"
                ) {
                    if let channel = index[episode.playableID]?.channel {
                        app.download(episode, from: channel)
                    } else if let channel = channels.first(where: { $0.id == episode.channelId || $0.episodes.contains(where: { $0.id == episode.id }) }) {
                        app.download(episode, from: channel)
                    }
                }
            }
        }
    }

    private func progressLine(_ progress: EpisodeProgress) -> some View {
        GeometryReader { geometry in
            ZStack(alignment: .leading) {
                Rectangle().fill(Color.white.opacity(0.08))
                Rectangle()
                    .fill(Theme.accent.opacity(0.9))
                    .frame(width: geometry.size.width * progress.fraction)
            }
        }
        .frame(height: 2)
        .padding(.trailing, 6)
    }

    private func meta(_ episode: PodcastEpisode) -> String {
        let channel = index[episode.playableID]?.channel.title
        return [channel, episode.publishedText]
            .compactMap { $0 }
            .filter { !$0.isEmpty }
            .joined(separator: " · ")
    }

    private func remainingText(_ item: ContinuedEpisode) -> String {
        let total = item.progress.duration
        let left = max(0, total - item.progress.position)
        return "Noch \(Format.duration(left))"
    }

    private func remainingText(episode: PodcastEpisode) -> String {
        guard let progress = app.episodeProgress.progress(for: episode.playableID) else { return "" }
        return "Noch \(Format.duration(max(0, progress.duration - progress.position)))"
    }

    private func channelImage(_ channel: PodcastChannel) -> URL? {
        if let direct = channel.imageURL { return direct }
        return app.artworkURL(channel.coverArt)
    }

    // MARK: - Data

    private func play(_ episode: PodcastEpisode, in channel: PodcastChannel) {
        guard let offset = channel.episodes.firstIndex(where: { $0.playableID == episode.playableID }) else {
            app.playEpisodes([episode])
            return
        }
        app.playEpisodes(channel.episodes, startingAt: offset)
    }

    private func load(force: Bool = false) async {
        guard app.client != nil else { return }
        loading = channels.isEmpty
        errorMessage = nil
        do {
            _ = try await app.podcasts(force: force)
        } catch {
            if channels.isEmpty {
                errorMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
            }
        }
        loading = false
        rebuildIndex()
        await prefetchCovers()

        #if DEBUG
        let env = ProcessInfo.processInfo.environment
        if env["NAVIDECK_DEMO_CHANNEL"] == "1", demoChannel == nil, let first = channels.first {
            demoChannel = first
        }
        if env["NAVIDECK_DEMO_PODCAST_PLAY"] == "1", app.player.current == nil,
           let first = channels.first, !first.episodes.isEmpty {
            app.playEpisodes(first.episodes)
        }
        #endif
    }

    private func rebuildIndex() {
        var map: [String: EpisodeLocation] = [:]
        for channel in channels {
            for episode in channel.episodes {
                map[episode.playableID] = EpisodeLocation(channel: channel, episode: episode)
            }
        }
        for episode in newest {
            if map[episode.playableID] == nil,
               let channel = channels.first(where: { $0.id == episode.channelId }) {
                map[episode.playableID] = EpisodeLocation(channel: channel, episode: episode)
            }
        }
        index = map
        rebuildContinued()
    }

    private func rebuildContinued() {
        let items = app.episodeProgress.entries.compactMap { id, progress -> ContinuedEpisode? in
            guard !progress.isFinished, let location = index[id] else { return nil }
            return ContinuedEpisode(
                episode: location.episode,
                channel: location.channel,
                progress: progress
            )
        }
        continued = Array(items.sorted { $0.progress.updated > $1.progress.updated }.prefix(5))
    }

    private func prefetchCovers() async {
        let urls = channels.prefix(10).compactMap(channelImage)
            + newest.prefix(6).compactMap { app.artworkURL($0.coverArt) }
        await ImageStore.shared.prefetch(urls, limit: 12)
    }

    private struct EpisodeLocation {
        var channel: PodcastChannel
        var episode: PodcastEpisode
    }

    private struct ContinuedEpisode {
        var episode: PodcastEpisode
        var channel: PodcastChannel
        var progress: EpisodeProgress
    }
}

// MARK: - Channel

struct PodcastChannelView: View {
    @Environment(AppModel.self) private var app
    let channel: PodcastChannel

    /// Long feeds are rendered in pages; building all episodes at once made
    /// opening a channel take seconds.
    @State private var visibleCount = 40

    private var episodes: ArraySlice<PodcastEpisode> {
        channel.episodes.prefix(visibleCount)
    }

    var body: some View {
        library
    }

    private var library: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 0) {
                header
                    .padding(.bottom, 18)

                ForEach(Array(episodes.enumerated()), id: \.offset) { offset, episode in
                    row(episode)
                        .onAppear {
                            if offset == visibleCount - 5, visibleCount < channel.episodes.count {
                                visibleCount = min(channel.episodes.count, visibleCount + 40)
                            }
                        }

                    if offset < episodes.count - 1 {
                        Divider().overlay(Theme.hairline).padding(.leading, 52)
                    }
                }

                if visibleCount < channel.episodes.count {
                    Button {
                        visibleCount = min(channel.episodes.count, visibleCount + 60)
                    } label: {
                        Text("Weitere Folgen (\(channel.episodes.count - visibleCount))")
                            .font(.footnote.weight(.medium))
                            .foregroundStyle(Theme.accent)
                            .padding(.vertical, 14)
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.vertical, 16)
        }
        .navigationTitle(channel.title)
        .navigationBarTitleDisplayMode(.inline)
        .navideckScreen()
        .task {
            await ImageStore.shared.prefetch(
                [channel.imageURL ?? app.artworkURL(channel.coverArt)].compactMap { $0 }
            )
        }
    }

    private func row(_ episode: PodcastEpisode) -> some View {
        let progress = app.episodeProgress.progress(for: episode.playableID)
        let isCurrent = app.player.current?.id == episode.playableID

        return HStack(spacing: 4) {
            Button {
                play(episode)
            } label: {
                HStack(alignment: .top, spacing: 10) {
                    Image(systemName: isCurrent && app.player.isPlaying ? "waveform" : "play.fill")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(isCurrent ? Theme.accent : Theme.muted.opacity(0.8))
                        .frame(width: 22, height: 22)

                    VStack(alignment: .leading, spacing: 3) {
                        Text(episode.title)
                            .font(.subheadline)
                            .foregroundStyle(isCurrent ? Theme.accent : Theme.text)
                            .lineLimit(2)
                            .multilineTextAlignment(.leading)
                            .frame(maxWidth: .infinity, alignment: .leading)

                        Text(metaText(episode))
                            .font(.caption2)
                            .foregroundStyle(Theme.muted)
                            .lineLimit(1)

                        if let progress {
                            progressLine(progress)
                                .padding(.top, 2)
                            Text("Noch \(Format.duration(max(0, progress.duration - progress.position)))")
                                .font(.caption2.monospacedDigit())
                                .foregroundStyle(Theme.accent)
                        }
                    }

                    if let duration = episode.duration {
                        Text(Format.duration(Double(duration)))
                            .font(.caption2.monospacedDigit())
                            .foregroundStyle(Theme.muted)
                    }
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            downloadButton(episode)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 8)
        .contextMenu {
            Button {
                app.player.playNext([episode.song])
            } label: {
                Label("Als Nächstes", systemImage: "text.line.first.and.arrowtriangle.forward")
            }
            Button {
                app.player.addToQueue([episode.song])
            } label: {
                Label("Zur Warteschlange", systemImage: "text.badge.plus")
            }
        }
        .accessibilityElement(children: .contain)
    }

    private var header: some View {
        VStack(spacing: 12) {
            CoverArtView(url: channel.imageURL ?? app.artworkURL(channel.coverArt))
                .frame(width: 170, height: 170)

            VStack(spacing: 4) {
                Text(channel.title)
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(Theme.text)
                    .multilineTextAlignment(.center)
                if let description = channel.description, !description.isEmpty {
                    Text(description)
                        .font(.caption)
                        .foregroundStyle(Theme.muted)
                        .lineLimit(3)
                        .multilineTextAlignment(.center)
                }
            }
            .padding(.horizontal, 24)

            HStack(spacing: 8) {
                if let id = app.episodeProgress.latestEpisodeID(in: channel),
                   let offset = channel.episodes.firstIndex(where: { $0.playableID == id }) {
                    headerButton("Fortsetzen", active: true) {
                        app.playEpisodes(channel.episodes, startingAt: offset)
                    }
                }

                headerButton("Neueste Folge", active: false) {
                    app.playEpisodes(channel.episodes)
                }
            }
            .disabled(channel.episodes.isEmpty)
            .opacity(channel.episodes.isEmpty ? 0.5 : 1)
        }
        .frame(maxWidth: .infinity)
    }

    private func headerButton(_ title: String, active: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.subheadline.weight(.medium))
                .foregroundStyle(active ? Theme.background : Theme.text)
                .padding(.horizontal, 18)
                .padding(.vertical, 10)
                .background(active ? Theme.accent : Theme.surface)
                .overlay {
                    Rectangle().stroke(active ? Color.clear : Theme.hairline, lineWidth: 0.5)
                }
        }
        .buttonStyle(.plain)
    }

    private func downloadButton(_ episode: PodcastEpisode) -> some View {
        Group {
            if app.isDownloaded(episode) {
                SquareIconButton(systemName: "arrow.down.circle.fill", active: true, size: 32, accessibilityTitle: "Download entfernen") {
                    app.removeDownload(episode)
                }
            } else if app.isDownloading(episode) {
                SquareIconButton(systemName: "stop.circle", size: 32, accessibilityTitle: "Download abbrechen") {
                    app.cancelDownload(episode)
                }
            } else {
                SquareIconButton(systemName: "arrow.down.circle", size: 32, accessibilityTitle: "Folge herunterladen") {
                    app.download(episode, from: channel)
                }
            }
        }
    }

    private func progressLine(_ progress: EpisodeProgress) -> some View {
        GeometryReader { geometry in
            ZStack(alignment: .leading) {
                Rectangle().fill(Color.white.opacity(0.08))
                Rectangle()
                    .fill(Theme.accent.opacity(0.9))
                    .frame(width: geometry.size.width * progress.fraction)
            }
        }
        .frame(height: 2)
        .padding(.trailing, 8)
    }

    private func play(_ episode: PodcastEpisode) {
        guard let offset = channel.episodes.firstIndex(where: { $0.playableID == episode.playableID }) else {
            app.playEpisodes([episode])
            return
        }
        app.playEpisodes(channel.episodes, startingAt: offset)
    }

    private func metaText(_ episode: PodcastEpisode) -> String {
        var parts: [String] = []
        if let published = episode.publishedText { parts.append(published) }
        if let description = episode.description, !description.isEmpty {
            parts.append(description.replacingOccurrences(of: "\n", with: " "))
        }
        return parts.joined(separator: " · ")
    }
}
