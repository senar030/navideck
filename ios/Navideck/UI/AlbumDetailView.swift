import SwiftUI

struct AlbumDetailView: View {
    @Environment(AppModel.self) private var app

    @State private var album: Album
    @State private var loading = false
    @State private var errorMessage: String?

    init(album: Album) {
        _album = State(initialValue: album)
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                header
                actions

                if let errorMessage {
                    ErrorBanner(message: errorMessage)
                        .padding(.horizontal, 20)
                }

                if loading && album.songs.isEmpty {
                    ProgressView().tint(Theme.accent).padding(.vertical, 30)
                } else {
                    trackList
                }
            }
            .padding(.vertical, 16)
        }
        .navigationTitle(album.name)
        .navigationBarTitleDisplayMode(.inline)
        .navideckScreen()
        .task { await load() }
    }

    // MARK: - Header

    private var header: some View {
        VStack(spacing: 12) {
            CoverArtView(url: app.coverURL(album.coverArt, size: 700), radius: 16)
                .frame(width: 220, height: 220)
                .shadow(color: .black.opacity(0.45), radius: 24, y: 12)

            VStack(spacing: 4) {
                Text(album.name)
                    .font(.title2.weight(.bold))
                    .foregroundStyle(Theme.text)
                    .multilineTextAlignment(.center)

                if let artistId = album.artistId, let artist = album.artist {
                    NavigationLink(value: Artist(id: artistId, name: artist)) {
                        Text(artist)
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(Theme.accent)
                    }
                    .buttonStyle(.plain)
                } else if let artist = album.artist {
                    Text(artist)
                        .font(.subheadline)
                        .foregroundStyle(Theme.muted)
                }

                Text(metaLine)
                    .font(.caption)
                    .foregroundStyle(Theme.muted)
            }
            .padding(.horizontal, 24)
        }
    }

    private var metaLine: String {
        var parts: [String] = []
        if let year = album.year { parts.append(String(year)) }
        if let count = album.songCount ?? (album.songs.isEmpty ? nil : album.songs.count) {
            parts.append("\(count) Titel")
        }
        if let duration = Format.longDuration(album.duration ?? album.songs.compactMap(\.duration).reduce(0, +)) {
            parts.append(duration)
        }
        return parts.joined(separator: " · ")
    }

    private var actions: some View {
        HStack(spacing: 18) {
            PlayCircleButton(isPlaying: isPlaying) {
                if isPlaying {
                    app.player.pause()
                } else if let current = app.player.current, sortedSongs.contains(where: { $0.id == current.id }) {
                    app.player.resume()
                } else {
                    app.player.play(sortedSongs)
                }
            }

            Button {
                if !app.player.shuffleEnabled {
                    app.player.toggleShuffle()
                }
                app.player.play(sortedSongs)
            } label: {
                Image(systemName: "shuffle")
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(Theme.text)
                    .frame(width: 48, height: 48)
                    .background(Theme.surface, in: Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Zufällig abspielen")

            StarButton(starred: album.starred != nil, action: toggleStarAlbum)

            Menu {
                Button("Alle zur Warteschlange") {
                    app.player.addToQueue(sortedSongs)
                }
                Button("Als Nächstes abspielen") {
                    app.player.playNext(sortedSongs)
                }
            } label: {
                Image(systemName: "ellipsis")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(Theme.text)
                    .frame(width: 44, height: 44)
                    .contentShape(Rectangle())
            }
        }
        .padding(.top, 4)
    }

    // MARK: - Tracks

    private var trackList: some View {
        VStack(spacing: 0) {
            ForEach(Array(sortedSongs.enumerated()), id: \.element.id) { offset, song in
                Button {
                    app.player.play(sortedSongs, startingAt: offset)
                } label: {
                    TrackRow(
                        song: song,
                        number: song.track ?? offset + 1,
                        isCurrent: app.player.current?.id == song.id
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
                    Button {
                        toggleStar(song: song)
                    } label: {
                        Label(song.starred == nil ? "Zu Favoriten" : "Aus Favoriten", systemImage: "star")
                    }
                }

                if song.id != sortedSongs.last?.id {
                    Divider()
                        .overlay(Theme.hairline)
                        .padding(.leading, 56)
                        .padding(.trailing, 20)
                }
            }
        }
    }

    private var sortedSongs: [Song] {
        album.songs.sorted { left, right in
            let leftDisc = left.discNumber ?? 1
            let rightDisc = right.discNumber ?? 1
            if leftDisc != rightDisc { return leftDisc < rightDisc }
            return (left.track ?? 0) < (right.track ?? 0)
        }
    }

    private var isPlaying: Bool {
        guard let current = app.player.current else { return false }
        return app.player.isPlaying && album.songs.contains(where: { $0.id == current.id })
    }

    // MARK: - Data

    private func load() async {
        guard let client = app.client, album.songs.isEmpty else { return }
        loading = true
        do {
            album = try await client.album(id: album.id)
        } catch {
            errorMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
        loading = false
    }

    private func toggleStarAlbum() {
        guard let client = app.client else { return }
        let willStar = album.starred == nil
        album.starred = willStar ? ISO8601DateFormatter().string(from: Date()) : nil
        Task {
            if willStar {
                try? await client.star(id: album.id, kind: "albumId")
            } else {
                try? await client.unstar(id: album.id, kind: "albumId")
            }
        }
    }

    private func toggleStar(song: Song) {
        guard let client = app.client,
              let index = album.songs.firstIndex(where: { $0.id == song.id }) else { return }
        let willStar = song.starred == nil
        album.songs[index].starred = willStar ? ISO8601DateFormatter().string(from: Date()) : nil
        Task {
            if willStar {
                try? await client.star(id: song.id)
            } else {
                try? await client.unstar(id: song.id)
            }
        }
    }
}
