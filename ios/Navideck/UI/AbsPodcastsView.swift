import SwiftUI

/// Podcasts from Audiobookshelf: shows first, episodes inside the show.
struct AbsPodcastsView: View {
    @Environment(AppModel.self) private var app

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 0) {
                if let error = app.absError {
                    ErrorBanner(message: error)
                        .padding(.horizontal, 20)
                        .padding(.bottom, 8)
                }

                ForEach(Array(app.absPodcasts.enumerated()), id: \.element.id) { offset, show in
                    NavigationLink {
                        AbsPodcastShowView(show: show)
                    } label: {
                        row(show)
                            .padding(.horizontal, 20)
                            .padding(.vertical, 6)
                    }
                    .buttonStyle(.plain)

                    if offset < app.absPodcasts.count - 1 {
                        Divider().overlay(Theme.hairline).padding(.leading, 76)
                    }
                }

                if app.absPodcasts.isEmpty {
                    EmptyStateView(
                        icon: "waveform",
                        title: "Keine Podcasts",
                        message: "Der Audiobookshelf-Server hat keine Podcast-Bibliothek oder sie ist leer."
                   )
                    .padding(.top, 30)
                }
            }
            .padding(.vertical, 12)
        }
        .task { await app.loadPodcasts() }
        .refreshable { await app.loadPodcasts(force: true) }
    }

    private func row(_ show: AbsBook) -> some View {
        HStack(spacing: 12) {
            CoverArtView(url: app.absCoverURL(show, width: 200))
                .frame(width: Theme.rowArtwork, height: Theme.rowArtwork)

            VStack(alignment: .leading, spacing: 3) {
                Text(show.media.metadata.title)
                    .font(.body.weight(.medium))
                    .foregroundStyle(Theme.text)
                    .lineLimit(1)
                Text("\(app.episodeCount(show)) Folgen")
                    .font(.caption)
                    .foregroundStyle(Theme.muted)
            }

            Spacer(minLength: 8)

            Image(systemName: "chevron.right")
                .font(.caption2.weight(.semibold))
                .foregroundStyle(Theme.muted.opacity(0.7))
        }
        .contentShape(Rectangle())
    }
}

struct AbsPodcastShowView: View {
    @Environment(AppModel.self) private var app
    @State private var show: AbsBook

    init(show: AbsBook) {
        _show = State(initialValue: show)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                header

                if let description = show.media.metadata.description, !description.isEmpty {
                    Text(description)
                        .font(.footnote)
                        .foregroundStyle(Theme.muted)
                        .padding(.horizontal, 20)
                }

                let episodes = show.media.episodes
                if episodes.isEmpty {
                    EmptyStateView(
                        icon: "waveform",
                        title: "Keine Folgen",
                        message: "Für diesen Podcast liegen keine Folgen vor."
                   )
                } else {
                    ForEach(Array(episodes.enumerated()), id: \.element.id) { offset, episode in
                        episodeRow(episode)
                            .padding(.horizontal, 20)
                            .padding(.vertical, 6)

                        if offset < episodes.count - 1 {
                            Divider().overlay(Theme.hairline).padding(.leading, 76)
                        }
                    }
                }
            }
            .padding(.vertical, 16)
        }
        .navigationTitle(show.media.metadata.title)
        .navigationBarTitleDisplayMode(.inline)
        .navideckScreen()
        .task {
            // Episodes are often missing from the library list response.
            if let full = await app.fullShow(show) {
                show = full
            }
        }
    }

    private var header: some View {
        HStack(spacing: 14) {
            CoverArtView(url: app.absCoverURL(show, width: 400))
                .frame(width: 96, height: 96)

            VStack(alignment: .leading, spacing: 4) {
                Text(show.media.metadata.title)
                    .font(.headline)
                    .foregroundStyle(Theme.text)
                if let author = show.media.metadata.authorName, !author.isEmpty {
                    Text(author)
                        .font(.caption)
                        .foregroundStyle(Theme.muted)
                }
                Text("\(app.episodeCount(show)) Folgen")
                    .font(.caption)
                    .foregroundStyle(Theme.muted)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 20)
    }

    private func episodeRow(_ episode: AbsEpisode) -> some View {
        let songID = "abs:\(show.id):\(episode.audioFile?.ino ?? "")"
        let isCurrent = app.player.current?.id == songID

        return HStack(spacing: 10) {
            Button {
                app.playAbsEpisode(episode, from: show)
            } label: {
                EpisodeRowContent(
                    title: episode.title,
                    showTitle: nil,
                    summary: episode.description ?? episode.subtitle,
                    dateText: episode.publishedText,
                    duration: episode.runtime,
                    isCurrent: isCurrent,
                    isPlaying: app.player.isPlaying
               )
            }
            .buttonStyle(.plain)

            episodeDownloadButton(episode)
        }
        .padding(.vertical, 4)
    }

    @ViewBuilder
    private func episodeDownloadButton(_ episode: AbsEpisode) -> some View {
        if app.absEpisodeDownloaded(episode) {
            Button {
                app.removeAbsEpisodeDownload(episode)
            } label: {
                Image(systemName: "trash")
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.muted)
                    .frame(width: 36, height: 36)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Download entfernen")
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
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Folge herunterladen")
        }
    }

    private func meta(_ episode: AbsEpisode) -> String {
        var parts: [String] = []
        if let published = episode.publishedText { parts.append(published) }
        if let subtitle = episode.subtitle, !subtitle.isEmpty { parts.append(subtitle) }
        return parts.joined(separator: " · ")
    }
}
