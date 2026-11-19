import SwiftUI

extension Notification.Name {
    /// Sent when the Podcast tab is selected so it can jump to the overview.
    static let navideckPodcastOverview = Notification.Name("navideck.podcast.overview")
}

/// Shared episode row: title, show, short description, date and runtime.
struct EpisodeRowContent: View {
    let title: String
    let showTitle: String?
    let summary: String?
    let dateText: String?
    let duration: Double?
    var progress: Double?
    var isCurrent: Bool = false
    var isPlaying: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .top, spacing: 8) {
                Image(systemName: isCurrent && isPlaying ? "waveform" : "play.fill")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(isCurrent ? Theme.accent : Theme.muted.opacity(0.8))
                    .frame(width: 20, height: 20)

                VStack(alignment: .leading, spacing: 3) {
                    Text(title)
                        .font(.body.weight(isCurrent ? .semibold : .regular))
                        .foregroundStyle(isCurrent ? Theme.accent : Theme.text)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                        .frame(maxWidth: .infinity, alignment: .leading)

                    if let showTitle, !showTitle.isEmpty {
                        Text(showTitle)
                            .font(.caption.weight(.medium))
                            .foregroundStyle(Theme.accent.opacity(0.85))
                            .lineLimit(1)
                    }

                    if let summary = Format.plainText(summary) {
                        Text(summary)
                            .font(.caption)
                            .foregroundStyle(Theme.muted)
                            .lineLimit(3)
                            .multilineTextAlignment(.leading)
                    }

                    HStack(spacing: 8) {
                        if let dateText, !dateText.isEmpty {
                            Text(dateText)
                        }
                        if let duration, duration > 0 {
                            Text(Format.duration(duration))
                        }
                    }
                    .font(.caption2.monospacedDigit())
                    .foregroundStyle(Theme.muted)

                    if let progress, progress > 0, progress < 0.999 {
                        DownloadProgressView(progress: progress)
                            .frame(maxWidth: 160)
                            .padding(.top, 2)
                    }
                }
            }
        }
        .contentShape(Rectangle())
    }
}

// MARK: - Neueste Folgen

struct PodcastLatestView: View {
    @Environment(AppModel.self) private var app
    var embedded = false
    @State private var visibleEpisodes = 15

    private var absEpisodes: [(show: AbsBook, episode: AbsEpisode)] { app.podcastLatest }
    private var subsonicEpisodes: [PodcastEpisode] {
        (app.podcastSnapshot?.newest ?? []).sorted { ($0.publishDate ?? "") > ($1.publishDate ?? "") }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                if app.podcastBackend == .audiobookshelf {
                    ForEach(Array(absEpisodes.prefix(visibleEpisodes).enumerated()), id: \.element.episode.id) { offset, item in
                        row(show: item.show, episode: item.episode)
                            .onAppear {
                                if offset >= visibleEpisodes - 3 {
                                    Task {
                                        await app.loadPodcastEpisodes(limit: 4)
                                        visibleEpisodes += 15
                                    }
                                }
                            }
                        if offset < min(absEpisodes.count, visibleEpisodes) - 1 {
                            Divider().overlay(Theme.hairline).padding(.leading, 20)
                        }
                    }

                    if visibleEpisodes < absEpisodes.count {
                        Button {
                            Task {
                                await app.loadPodcastEpisodes(limit: 4)
                                visibleEpisodes += 15
                            }
                        } label: {
                            Text("Weitere Folgen")
                                .font(.subheadline.weight(.medium))
                                .foregroundStyle(Theme.accent)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 14)
                        }
                        .buttonStyle(.plain)
                    }
                    if absEpisodes.isEmpty {
                        EmptyStateView(
                            icon: "sparkles",
                            title: "Keine Folgen",
                            message: "Die zugeordnete Bibliothek enthält keine Episoden."
                       )
                        .padding(.top, 30)
                    }
                } else {
                    ForEach(Array(subsonicEpisodes.enumerated()), id: \.element.playableID) { offset, episode in
                        Button {
                            app.playEpisodes([episode])
                        } label: {
                            EpisodeRowContent(
                                title: episode.title,
                                showTitle: episode.artist,
                                summary: episode.description,
                                dateText: episode.publishedText,
                                duration: episode.duration.map(Double.init),
                                progress: app.episodeProgress.progress(for: episode.playableID).map {
                                    $0.duration > 0 ? $0.position / $0.duration : 0
                                },
                                isCurrent: app.player.current?.id == episode.playableID,
                                isPlaying: app.player.isPlaying
                           )
                            .padding(.horizontal, 20)
                            .padding(.vertical, 8)
                        }
                        .buttonStyle(.plain)

                        if offset < subsonicEpisodes.count - 1 {
                            Divider().overlay(Theme.hairline).padding(.leading, 20)
                        }
                    }
                    if subsonicEpisodes.isEmpty {
                        EmptyStateView(
                            icon: "sparkles",
                            title: "Keine Folgen",
                            message: "Der Server liefert keine aktuellen Episoden."
                       )
                        .padding(.top, 30)
                    }
                }
            }
            .padding(.vertical, 8)
        }
        .navigationTitle(embedded ? "" : "Neueste Folgen")
        .navideckScreen()
        .task { await reload() }
        .refreshable { await reload() }
    }

    private func reload() async {
        if app.podcastBackend == .audiobookshelf {
            await app.loadPodcasts(force: true)
            await app.loadPodcastEpisodes()
        } else {
            _ = try? await app.podcasts(force: true)
        }
    }

    private func row(show: AbsBook, episode: AbsEpisode) -> some View {
        let songID = "abs:\(show.id):\(episode.audioFile?.ino ?? "")"
        let isCurrent = app.player.current?.id == songID

        return HStack(spacing: 10) {
            Button {
                app.playAbsEpisode(episode, from: show)
            } label: {
                EpisodeRowContent(
                    title: episode.title,
                    showTitle: show.media.metadata.title,
                    summary: episode.description ?? episode.subtitle,
                    dateText: episode.publishedText,
                    duration: episode.runtime,
                    isCurrent: isCurrent,
                    isPlaying: app.player.isPlaying
               )
            }
            .buttonStyle(.plain)

            episodeDownload(episode, show: show)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 8)
    }

    @ViewBuilder
    private func episodeDownload(_ episode: AbsEpisode, show: AbsBook) -> some View {
        if app.absEpisodeDownloaded(episode) {
            Button {
                app.removeAbsEpisodeDownload(episode)
            } label: {
                Image(systemName: "trash")
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.muted)
                    .frame(width: 36, height: 36)
            }
            .buttonStyle(.plain)
        } else if let progress = app.absEpisodeDownloadProgress(episode) {
            DownloadRing(progress: progress)
                .frame(width: 20, height: 20)
                .frame(width: 36, height: 36)
        } else {
            Button {
                app.downloadAbsEpisode(episode, from: show)
            } label: {
                Image(systemName: "arrow.down")
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.muted)
                    .frame(width: 36, height: 36)
            }
            .buttonStyle(.plain)
        }
    }
}

// MARK: - Downloads

struct PodcastDownloadsView: View {
    @Environment(AppModel.self) private var app
    var embedded = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                ForEach(Array(app.downloadedPodcastEpisodes.enumerated()), id: \.element.id) { offset, item in
                    HStack(spacing: 12) {
                        Button {
                            app.player.play(item.songs)
                        } label: {
                            HStack(spacing: 12) {
                                CoverArtView(url: app.downloads.localCoverURL(coverArt: item.coverArt))
                                    .frame(width: Theme.rowArtwork, height: Theme.rowArtwork)

                                VStack(alignment: .leading, spacing: 3) {
                                    Text(item.title)
                                        .font(.body.weight(.medium))
                                        .foregroundStyle(Theme.text)
                                        .lineLimit(2)
                                    Text(item.subtitle ?? item.metaText)
                                        .font(.caption)
                                        .foregroundStyle(Theme.muted)
                                        .lineLimit(1)
                                }
                                Spacer(minLength: 8)
                                Image(systemName: "play.fill")
                                    .font(.caption)
                                    .foregroundStyle(Theme.muted)
                            }
                        }
                        .buttonStyle(.plain)

                        Button {
                            app.downloads.delete(item)
                        } label: {
                            Image(systemName: "trash")
                                .font(.system(size: 14))
                                .foregroundStyle(Theme.muted)
                                .frame(width: 36, height: 36)
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(.horizontal, 20)
                    .padding(.vertical, 8)

                    if offset < app.downloadedPodcastEpisodes.count - 1 {
                        Divider().overlay(Theme.hairline).padding(.leading, 20)
                    }
                }

                if app.downloadedPodcastEpisodes.isEmpty {
                    EmptyStateView(
                        icon: "arrow.down.circle",
                        title: "Keine Folgen geladen",
                        message: "Lade einzelne Folgen über das Download-Symbol herunter."
                   )
                    .padding(.top, 30)
                }
            }
            .padding(.vertical, 8)
        }
        .navigationTitle(embedded ? "" : "Podcast-Downloads")
        .navideckScreen()
    }
}
