import SwiftUI

struct PlaylistsView: View {
    @Environment(AppModel.self) private var app

    @State private var playlists: [Playlist] = []
    @State private var loading = false
    @State private var errorMessage: String?

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 0) {
                ForEach(playlists) { playlist in
                    PlaylistRow(playlist: playlist)
                        .padding(.horizontal, 20)
                        .padding(.vertical, 6)

                    if playlist.id != playlists.last?.id {
                        Divider().overlay(Theme.hairline).padding(.leading, 84)
                    }
                }
            }
            .padding(.vertical, 8)

            if let errorMessage {
                ErrorBanner(message: errorMessage).padding(.horizontal, 20)
            }

            if loading && playlists.isEmpty {
                ProgressView().tint(Theme.accent).padding(.vertical, 40)
            }

            if playlists.isEmpty && !loading && errorMessage == nil {
                EmptyStateView(
                    icon: "music.note.list",
                    title: "Keine Playlists",
                    message: "Auf diesem Server gibt es noch keine Playlists."
                )
            }
        }
        .navigationTitle("Playlists")
        .navideckScreen()
        .task { await load() }
        .refreshable { await load() }
    }

    private func load() async {
        guard let client = app.client else { return }
        loading = true
        errorMessage = nil
        do {
            playlists = try await client.playlists()
        } catch {
            errorMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
        loading = false
    }
}

struct PlaylistDetailView: View {
    @Environment(AppModel.self) private var app

    @State private var playlist: Playlist
    @State private var loading = false
    @State private var errorMessage: String?

    init(playlist: Playlist) {
        _playlist = State(initialValue: playlist)
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                header
                actions

                if let errorMessage {
                    ErrorBanner(message: errorMessage).padding(.horizontal, 20)
                }

                if loading && playlist.entries.isEmpty {
                    ProgressView().tint(Theme.accent).padding(.vertical, 30)
                } else {
                    trackList
                }
            }
            .padding(.vertical, 16)
        }
        .navigationTitle(playlist.name)
        .navigationBarTitleDisplayMode(.inline)
        .navideckScreen()
        .task { await load() }
    }

    private var header: some View {
        VStack(spacing: 12) {
            CoverArtView(url: app.coverURL(playlist.coverArt, size: 700), radius: 16)
                .frame(width: 200, height: 200)
                .shadow(color: .black.opacity(0.45), radius: 22, y: 10)

            VStack(spacing: 4) {
                Text(playlist.name)
                    .font(.title2.weight(.bold))
                    .foregroundStyle(Theme.text)
                    .multilineTextAlignment(.center)

                Text(metaLine)
                    .font(.caption)
                    .foregroundStyle(Theme.muted)
                    .multilineTextAlignment(.center)

                if let comment = playlist.comment, !comment.isEmpty {
                    Text(comment)
                        .font(.caption)
                        .foregroundStyle(Theme.muted.opacity(0.85))
                        .multilineTextAlignment(.center)
                        .padding(.top, 2)
                }
            }
            .padding(.horizontal, 24)
        }
    }

    private var metaLine: String {
        var parts: [String] = []
        let count = playlist.songCount ?? playlist.entries.count
        if count > 0 { parts.append("\(count) Titel") }
        if let duration = Format.longDuration(playlist.duration) { parts.append(duration) }
        return parts.joined(separator: " · ")
    }

    private var actions: some View {
        HStack(spacing: 18) {
            PlayCircleButton(isPlaying: isPlaying) {
                if isPlaying {
                    app.player.pause()
                } else {
                    app.player.play(playlist.entries)
                }
            }
            .opacity(playlist.entries.isEmpty ? 0.5 : 1)

            Button {
                guard !playlist.entries.isEmpty else { return }
                if !app.player.shuffleEnabled { app.player.toggleShuffle() }
                app.player.play(playlist.entries)
            } label: {
                Image(systemName: "shuffle")
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(Theme.text)
                    .frame(width: 48, height: 48)
                    .background(Theme.surface, in: Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Zufällig abspielen")

            Menu {
                Button("Alle zur Warteschlange") {
                    app.player.addToQueue(playlist.entries)
                }
            } label: {
                Image(systemName: "ellipsis")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(Theme.text)
                    .frame(width: 44, height: 44)
                    .contentShape(Rectangle())
            }
        }
    }

    private var trackList: some View {
        VStack(spacing: 0) {
            ForEach(Array(playlist.entries.enumerated()), id: \.element.id) { offset, song in
                Button {
                    app.player.play(playlist.entries, startingAt: offset)
                } label: {
                    TrackRow(
                        song: song,
                        number: offset + 1,
                        isCurrent: app.player.current?.id == song.id,
                        subtitle: [song.artist, song.album].compactMap { $0 }.joined(separator: " · ")
                    )
                    .padding(.horizontal, 20)
                    .padding(.vertical, 6)
                }
                .buttonStyle(.plain)
                .contextMenu {
                    Button {
                        app.player.playNext([song])
                    } label: {
                        Label("Als Nächstes", systemImage: "text.line.first.and.arrowtriangle.forward")
                    }
                    Button {
                        app.player.addToQueue([song])
                    } label: {
                        Label("Zur Warteschlange", systemImage: "text.badge.plus")
                    }
                }

                if song.id != playlist.entries.last?.id {
                    Divider()
                        .overlay(Theme.hairline)
                        .padding(.leading, 56)
                        .padding(.trailing, 20)
                }
            }
        }
    }

    private var isPlaying: Bool {
        guard let current = app.player.current else { return false }
        return app.player.isPlaying && playlist.entries.contains { $0.id == current.id }
    }

    private func load() async {
        guard let client = app.client, playlist.entries.isEmpty else { return }
        loading = true
        do {
            playlist = try await client.playlist(id: playlist.id)
        } catch {
            errorMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
        loading = false
    }
}
