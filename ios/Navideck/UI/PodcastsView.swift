import SwiftUI

/// Podcast channels from the server, with their episodes.
struct PodcastsView: View {
    @Environment(AppModel.self) private var app

    @State private var channels: [PodcastChannel] = []
    @State private var newest: [PodcastEpisode] = []
    @State private var loading = false
    @State private var errorMessage: String?

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 0) {
                if let errorMessage {
                    ErrorBanner(message: errorMessage)
                        .padding(.horizontal, 20)
                        .padding(.bottom, 8)
                }

                if !newest.isEmpty {
                    SectionHeader(title: "Neueste Folgen")
                        .padding(.bottom, 6)

                    ForEach(Array(newest.prefix(5).enumerated()), id: \.element.id) { offset, episode in
                        episodeRow(episode, list: newest)
                            .padding(.horizontal, 20)
                            .padding(.vertical, 6)

                        if offset < min(newest.count, 5) - 1 {
                            Divider().overlay(Theme.hairline).padding(.leading, 76)
                        }
                    }

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
        .navigationTitle("Podcasts")
        .navideckScreen()
        .task { await load() }
        .refreshable { await load() }
    }

    private func channelRow(_ channel: PodcastChannel) -> some View {
        HStack(spacing: 12) {
            CoverArtView(url: channelImage(channel))
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

            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Theme.muted.opacity(0.7))
        }
    }

    private func episodeRow(_ episode: PodcastEpisode, list: [PodcastEpisode]) -> some View {
        Button {
            if let index = list.firstIndex(where: { $0.id == episode.id }) {
                app.playEpisodes(list, startingAt: index)
            }
        } label: {
            HStack(spacing: 12) {
                Image(systemName: app.player.current?.id == episode.song.id && app.player.isPlaying
                      ? "waveform" : "play")
                    .font(.system(size: 14, weight: .regular))
                    .foregroundStyle(app.player.current?.id == episode.song.id ? Theme.accent : Theme.muted)
                    .frame(width: 24)

                VStack(alignment: .leading, spacing: 2) {
                    Text(episode.title)
                        .font(.subheadline)
                        .foregroundStyle(Theme.text)
                        .lineLimit(2)
                    Text(meta(episode))
                        .font(.caption2)
                        .foregroundStyle(Theme.muted)
                        .lineLimit(1)
                }

                Spacer(minLength: 8)

                if let duration = episode.duration {
                    Text(Format.duration(Double(duration)))
                        .font(.caption2.monospacedDigit())
                        .foregroundStyle(Theme.muted)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func meta(_ episode: PodcastEpisode) -> String {
        [episode.artist, episode.publishedText]
            .compactMap { $0 }
            .filter { !$0.isEmpty }
            .joined(separator: " · ")
    }

    private func channelImage(_ channel: PodcastChannel) -> URL? {
        if let direct = channel.imageURL { return direct }
        return app.artworkURL(channel.coverArt)
    }

    private func load() async {
        guard let client = app.client else { return }
        loading = true
        errorMessage = nil
        async let channelsTask = client.podcasts()
        async let newestTask = client.newestPodcasts(count: 12)
        do {
            channels = try await channelsTask
            newest = (try? await newestTask) ?? []
        } catch let failure as SubsonicFailure where failure.code == 30 || failure.code == 0 {
            channels = []
        } catch {
            errorMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
        loading = false
    }
}

struct PodcastChannelView: View {
    @Environment(AppModel.self) private var app
    let channel: PodcastChannel

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                header

                VStack(spacing: 0) {
                    ForEach(Array(channel.episodes.enumerated()), id: \.element.id) { offset, episode in
                        Button {
                            app.playEpisodes(channel.episodes, startingAt: offset)
                        } label: {
                            HStack(alignment: .top, spacing: 10) {
                                Text("\(offset + 1)")
                                    .font(.caption.monospacedDigit())
                                    .foregroundStyle(Theme.muted)
                                    .frame(width: 22, alignment: .leading)
                                    .padding(.top, 2)

                                VStack(alignment: .leading, spacing: 3) {
                                    Text(episode.title)
                                        .font(.subheadline)
                                        .foregroundStyle(app.player.current?.id == episode.song.id
                                                         ? Theme.accent : Theme.text)
                                        .lineLimit(2)
                                    Text(metaText(episode))
                                        .font(.caption2)
                                        .foregroundStyle(Theme.muted)
                                }

                                Spacer(minLength: 8)

                                if let duration = episode.duration {
                                    Text(Format.duration(Double(duration)))
                                        .font(.caption2.monospacedDigit())
                                        .foregroundStyle(Theme.muted)
                                }
                            }
                            .padding(.horizontal, 20)
                            .padding(.vertical, 8)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)

                        if offset < channel.episodes.count - 1 {
                            Divider().overlay(Theme.hairline).padding(.leading, 52)
                        }
                    }
                }
            }
            .padding(.vertical, 16)
        }
        .navigationTitle(channel.title)
        .navigationBarTitleDisplayMode(.inline)
        .navideckScreen()
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

            Button {
                app.playEpisodes(channel.episodes)
            } label: {
                Text("Neueste Folge abspielen")
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Theme.background)
                    .padding(.horizontal, 18)
                    .padding(.vertical, 10)
                    .background(Theme.accent)
            }
            .buttonStyle(.plain)
            .disabled(channel.episodes.isEmpty)
            .opacity(channel.episodes.isEmpty ? 0.5 : 1)
        }
        .frame(maxWidth: .infinity)
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
