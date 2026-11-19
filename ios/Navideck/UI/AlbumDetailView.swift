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

                if let progress = app.downloads.progressValue(kind: .album, sourceID: album.id) {
                    DownloadProgressView(progress: progress)
                        .padding(.horizontal, 20)
                }

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
        .task {
            await load()
            #if DEBUG
            if ProcessInfo.processInfo.environment["NAVIDECK_DEMO_DOWNLOAD"] == "1",
               app.downloads.item(kind: .album, sourceID: album.id) == nil {
                app.download(album)
            }
            #endif
        }
    }

    // MARK: - Header

    private var header: some View {
        VStack(spacing: 12) {
            CoverArtView(url: app.artworkURL(album.coverArt, size: 700), radius: 16, maxPixel: 1000)
                .frame(width: 220, height: 220)
                .shadow(color: .black.opacity(0.4), radius: 22, y: 12)

            VStack(spacing: 4) {
                Text(album.name)
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(Theme.text)
                    .multilineTextAlignment(.center)

                if let artistId = album.artistId, let artist = album.artist {
                    NavigationLink(value: LibraryRoute.artist(Artist(id: artistId, name: artist))) {
                        Text(artist)
                            .font(.subheadline)
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

    // MARK: - Actions

    private var actions: some View {
        ZStack {
            HStack(spacing: 6) {
                SquareIconButton(systemName: "shuffle", accessibilityTitle: "Zufällig abspielen") {
                    if !app.player.shuffleEnabled {
                        app.player.toggleShuffle()
                    }
                    app.player.play(sortedSongs)
                }

                StarButton(starred: album.starred != nil, action: toggleStarAlbum)

                Spacer(minLength: 0)

                downloadButton
                trackMenu
            }

            PlayCircleButton(isPlaying: isPlaying) {
                if isPlaying {
                    app.player.pause()
                } else if let current = app.player.current,
                          sortedSongs.contains(where: { $0.id == current.id }) {
                    app.player.resume()
                } else {
                    app.player.play(sortedSongs)
                }
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 2)
    }

    @ViewBuilder
    private var downloadButton: some View {
        if app.downloads.item(kind: .album, sourceID: album.id) != nil {
            SquareIconButton(systemName: "trash", accessibilityTitle: "Download löschen") {
                if let item = app.downloads.item(kind: .album, sourceID: album.id) {
                    app.downloads.delete(item)
                }
            }
        } else if app.downloads.isDownloading(kind: .album, sourceID: album.id) {
            Button {
                app.downloads.cancel(kind: .album, sourceID: album.id)
            } label: {
                ProgressView()
                    .tint(Theme.accent)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Download abbrechen")
        } else {
            SquareIconButton(systemName: "arrow.down", accessibilityTitle: "Album herunterladen") {
                if album.songs.isEmpty {
                    Task { await load() }
                }
                app.download(album)
            }
            .disabled(album.songs.isEmpty)
        }
    }

    private var trackMenu: some View {
        Menu {
            Button {
                app.player.addToQueue(sortedSongs)
            } label: {
                Label("Alle zur Warteschlange", systemImage: "text.badge.plus")
            }
            Button {
                app.player.playNext(sortedSongs)
            } label: {
                Label("Als Nächstes abspielen", systemImage: "text.line.first.and.arrowtriangle.forward")
            }
        } label: {
            Image(systemName: "ellipsis")
                .font(.system(size: 16, weight: .regular))
                .foregroundStyle(Theme.text)
                .frame(width: 40, height: 44)
                .contentShape(Rectangle())
        }
    }

    // MARK: - Tracks

    private var trackList: some View {
        // Sort once per body; with a few hundred tracks the old per-row call
        // to `sortedSongs` was noticeably slow.
        let songs = sortedSongs

        return LazyVStack(spacing: 0) {
            ForEach(Array(songs.enumerated()), id: \.element.id) { offset, song in
                Button {
                    app.player.play(songs, startingAt: offset)
                } label: {
                    TrackRow(
                        song: song,
                        number: song.track ?? offset + 1,
                        isCurrent: app.player.current?.id == song.id,
                        downloaded: app.downloads.contains(songID: song.id),
                        progress: app.downloads.songProgress[song.id]
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
                        if app.downloads.contains(songID: song.id) {
                            if let item = app.downloads.items.first(where: { $0.songs.contains(where: { $0.id == song.id }) }) {
                                app.downloads.delete(item)
                            }
                        } else {
                            app.download(song, from: album.name, artist: album.artist)
                        }
                    } label: {
                        Label(
                            app.downloads.contains(songID: song.id) ? "Download entfernen" : "Titel herunterladen",
                            systemImage: app.downloads.contains(songID: song.id) ? "trash" : "arrow.down"
                        )
                    }
                    Button {
                        toggleStar(song: song)
                    } label: {
                        Label(song.starred == nil ? "Zu Favoriten" : "Aus Favoriten", systemImage: "star")
                    }
                }

                if offset < songs.count - 1 {
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
        if album.songs.isEmpty,
           let item = app.downloads.item(kind: .album, sourceID: album.id) {
            album.songs = item.songs
            if album.coverArt == nil { album.coverArt = item.coverArt }
            if album.artist == nil { album.artist = item.subtitle }
        }
        guard !app.offlineMode, let client = app.client, album.songs.isEmpty else { return }
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
