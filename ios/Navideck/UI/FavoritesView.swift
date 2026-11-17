import SwiftUI

struct FavoritesView: View {
    private enum Mode: String, CaseIterable {
        case albums = "Alben"
        case songs = "Titel"
        case artists = "Interpreten"
    }

    @Environment(AppModel.self) private var app

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

                if !loading && result.isEmpty && errorMessage == nil {
                    EmptyStateView(
                        icon: "star",
                        title: "Noch keine Favoriten",
                        message: "Markierte Alben, Titel und Interpreten erscheinen hier."
                    )
                }
            }
            .padding(.vertical, 12)
        }
        .navigationTitle("Favoriten")
        .navideckScreen()
        .task { await load() }
        .refreshable { await load() }
    }

    @ViewBuilder
    private var content: some View {
        switch mode {
        case .albums:
            LazyVGrid(
                columns: [GridItem(.adaptive(minimum: 150, maximum: 220), spacing: 14, alignment: .top)],
                spacing: 20
            ) {
                ForEach(result.albums) { album in
                    AlbumCard(album: album)
                }
            }
            .padding(.horizontal, 20)

        case .songs:
            if !result.songs.isEmpty {
                HStack(spacing: 14) {
                    Button {
                        app.player.play(result.songs)
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
                        app.player.play(result.songs)
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

            ForEach(Array(result.songs.enumerated()), id: \.element.id) { offset, song in
                Button {
                    app.player.play(result.songs, startingAt: offset)
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
            ForEach(result.artists) { artist in
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
        guard let client = app.client else { return }
        loading = true
        errorMessage = nil
        do {
            result = try await client.starred()
        } catch {
            errorMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
        loading = false
    }
}
