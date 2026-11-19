import SwiftUI

struct FavoritesView: View {
    /// Used inside a category shell that already provides the chrome.
    var embedded = false
    private enum Mode: String, CaseIterable {
        case albums = "Alben"
        case songs = "Titel"
        case artists = "Interpreten"
    }

    @Environment(AppModel.self) private var app

    @AppStorage("navideck.favorites-layout") private var layout = "grid"
    @State private var result = SearchResult()
    @State private var mode: Mode = .albums
    @State private var loading = false
    @State private var errorMessage: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Picker("Ansicht", selection: $mode) {
                    ForEach(Mode.allCases, id: \.self) { option in
                        Text(option.rawValue).tag(option)
                    }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, 20)

                if let errorMessage {
                    ErrorBanner(message: errorMessage).padding(.horizontal, 20)
                }

                content

                if loading {
                    ProgressView().tint(Theme.accent).padding(.vertical, 20)
                }

                if !loading && shown.isEmpty && errorMessage == nil {
                    EmptyStateView(
                        icon: "star",
                        title: "Noch keine Favoriten",
                        message: "Markierte Alben, Titel und Interpreten erscheinen hier."
                   )
                }
            }
            .padding(.vertical, 12)
        }
        .navigationTitle(embedded ? "" : "Favoriten")
        .navideckScreen()
        .toolbar {
            if mode == .albums {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        layout = layout == "grid" ? "list" : "grid"
                    } label: {
                        Image(systemName: layout == "grid" ? "list.bullet" : "square.grid.2x2")
                    }
                    .accessibilityLabel(layout == "grid" ? "Listenansicht" : "Kachelansicht")
                }
            }
        }
        .task { await load() }
        .refreshable { await load() }
        .onChange(of: app.favoritesRevision) { _, _ in
            Task { await load() }
        }
    }

    /// Offline the page shows the downloaded part of the favorites.
    private var shown: SearchResult {
        guard app.offlineMode else { return result }
        return SearchResult(
            artists: app.downloadedArtists.filter { $0.starred != nil },
            albums: app.downloadedAlbums.filter { $0.starred != nil },
            songs: app.downloadedSongs.filter { $0.starred != nil }
       )
    }

    @ViewBuilder
    private var content: some View {
        switch mode {
        case .albums:
            if layout == "list" {
                LazyVStack(spacing: 0) {
                    ForEach(Array(shown.albums.enumerated()), id: \.element.id) { offset, album in
                        AlbumRow(album: album)
                            .padding(.horizontal, 20)
                        if offset < shown.albums.count - 1 {
                            Divider().overlay(Theme.hairline).padding(.leading, 88)
                        }
                    }
                }
                .padding(.vertical, 8)
            } else {
                LazyVGrid(
                    columns: [GridItem(.adaptive(minimum: 150, maximum: 220), spacing: 14, alignment: .top)],
                    spacing: 20
               ) {
                    ForEach(shown.albums) { album in
                        AlbumCard(album: album)
                    }
                }
                .padding(.horizontal, 20)
            }

        case .songs:
            if !shown.songs.isEmpty {
                HStack(spacing: 14) {
                    Button {
                        app.player.play(shown.songs)
                    } label: {
                        Label("Alle abspielen", systemImage: "play.fill")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Theme.background)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 10)
                            .background(Theme.accent)
                    }
                    .buttonStyle(.plain)

                    Button {
                        if !app.player.shuffleEnabled { app.player.toggleShuffle() }
                        app.player.play(shown.songs)
                    } label: {
                        Label("Mischen", systemImage: "shuffle")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Theme.text)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 10)
                            .background(Theme.surface)
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, 20)
            }

            ForEach(Array(shown.songs.enumerated()), id: \.element.id) { offset, song in
                Button {
                    app.player.play(shown.songs, startingAt: offset)
                } label: {
                    TrackRow(
                        song: song,
                        isCurrent: app.player.current?.id == song.id,
                        subtitle: [song.artist, song.album].compactMap { $0 }.joined(separator: " · ")
                   )
                    .padding(.horizontal, 20)
                    .padding(.vertical, 6)
                }
                .buttonStyle(.plain)
            }

        case .artists:
            ForEach(shown.artists) { artist in
                ArtistRow(artist: artist)
                    .padding(.horizontal, 20)
                    .padding(.vertical, 6)

                if artist.id != result.artists.last?.id {
                    Divider().overlay(Theme.hairline).padding(.leading, 78)
                }
            }
        }
    }

    private func load() async {
        if app.offlineMode {
            errorMessage = nil
            loading = false
            return
        }
        guard let client = app.client else { return }
        loading = true
        errorMessage = nil
        do {
            result = try await client.starred()
        } catch {
            if !Format.isCancellation(error) {
                errorMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
            }
        }
        loading = false
    }
}
