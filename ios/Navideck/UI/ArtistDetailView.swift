import SwiftUI

struct ArtistDetailView: View {
    @Environment(AppModel.self) private var app

    @State private var artist: Artist
    @State private var topSongs: [Song] = []
    @State private var info: ArtistInfo?
    @State private var loading = false
    @State private var errorMessage: String?
    @State private var bioExpanded = false

    init(artist: Artist) {
        _artist = State(initialValue: artist)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                header

                if let errorMessage {
                    ErrorBanner(message: errorMessage).padding(.horizontal, 20)
                }

                if let biography = info?.biography, !biography.isEmpty {
                    biographyView(biography)
                }

                if !artist.albums.isEmpty {
                    albumsSection
                }

                if !topSongs.isEmpty {
                    topSongsSection
                }

                if loading && artist.albums.isEmpty && topSongs.isEmpty {
                    ProgressView().tint(Theme.accent)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 30)
                }
            }
            .padding(.vertical, 16)
        }
        .navigationTitle(artist.name)
        .navigationBarTitleDisplayMode(.inline)
        .navideckScreen()
        .task { await load() }
    }

    // MARK: - Header

    private var header: some View {
        VStack(spacing: 14) {
            CoverArtView(url: app.coverURL(headerArtwork, size: 700), radius: 60)
                .frame(width: 180, height: 180)
                .shadow(color: .black.opacity(0.4), radius: 20, y: 10)

            VStack(spacing: 4) {
                Text(artist.name)
                    .font(.title.weight(.bold))
                    .foregroundStyle(Theme.text)
                    .multilineTextAlignment(.center)
                Text(metaLine)
                    .font(.caption)
                    .foregroundStyle(Theme.muted)
            }
            .padding(.horizontal, 24)

            HStack(spacing: 18) {
                PlayCircleButton(isPlaying: isPlaying) {
                    if isPlaying {
                        app.player.pause()
                    } else if topSongs.isEmpty {
                        app.player.resume()
                    } else {
                        app.player.play(topSongs)
                    }
                }
                .opacity(topSongs.isEmpty ? 0.5 : 1)

                Button {
                    if !topSongs.isEmpty {
                        if !app.player.shuffleEnabled { app.player.toggleShuffle() }
                        app.player.play(topSongs)
                    }
                } label: {
                    Image(systemName: "shuffle")
                        .font(.system(size: 20, weight: .semibold))
                        .foregroundStyle(Theme.text)
                        .frame(width: 48, height: 48)
                        .background(Theme.surface, in: Circle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Zufällig abspielen")

                StarButton(starred: artist.starred != nil, action: toggleStar)
            }
        }
        .frame(maxWidth: .infinity)
    }

    private var headerArtwork: String? {
        if let cover = artist.coverArt { return cover }
        return artist.albums.first?.coverArt
    }

    private var metaLine: String {
        var parts: [String] = []
        let count = artist.albumCount ?? artist.albums.count
        if count > 0 { parts.append("\(count) \(count == 1 ? "Album" : "Alben")") }
        if let genre = artist.albums.first?.genre, !genre.isEmpty { parts.append(genre) }
        return parts.joined(separator: " · ")
    }

    private var isPlaying: Bool {
        guard let current = app.player.current else { return false }
        return app.player.isPlaying && (topSongs.contains { $0.id == current.id } || current.artistId == artist.id)
    }

    // MARK: - Sections

    private var albumsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Alben")

            LazyVGrid(
                columns: [GridItem(.adaptive(minimum: 150, maximum: 220), spacing: 14, alignment: .top)],
                spacing: 20
            ) {
                ForEach(artist.albums) { album in
                    AlbumCard(album: album)
                }
            }
            .padding(.horizontal, 20)
        }
    }

    private var topSongsSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionHeader(title: "Beliebte Titel")

            ForEach(Array(topSongs.enumerated()), id: \.element.id) { offset, song in
                Button {
                    app.player.play(topSongs, startingAt: offset)
                } label: {
                    TrackRow(
                        song: song,
                        number: offset + 1,
                        isCurrent: app.player.current?.id == song.id,
                        subtitle: song.album
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
            }
        }
        .padding(.top, 4)
    }

    private func biographyView(_ text: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            SectionHeader(title: "Über")
            Text(text)
                .font(.footnote)
                .foregroundStyle(Theme.muted)
                .lineLimit(bioExpanded ? nil : 6)
                .padding(.horizontal, 20)
            Button(bioExpanded ? "Weniger" : "Mehr") {
                bioExpanded.toggle()
            }
            .font(.caption.weight(.semibold))
            .foregroundStyle(Theme.accent)
            .padding(.horizontal, 20)
        }
    }

    // MARK: - Data

    private func load() async {
        guard let client = app.client else { return }
        loading = true
        errorMessage = nil

        async let fullArtist = client.artist(id: artist.id)
        async let songs = client.topSongs(artist: artist.name)
        async let artistInfo = client.artistInfo(id: artist.id)

        if let loaded = try? await fullArtist {
            artist = loaded
        } else {
            errorMessage = "Der Interpret konnte nicht geladen werden."
        }
        topSongs = (try? await songs) ?? []
        info = try? await artistInfo

        loading = false
    }

    private func toggleStar() {
        guard let client = app.client else { return }
        let willStar = artist.starred == nil
        artist.starred = willStar ? ISO8601DateFormatter().string(from: Date()) : nil
        Task {
            if willStar {
                try? await client.star(id: artist.id, kind: "artistId")
            } else {
                try? await client.unstar(id: artist.id, kind: "artistId")
            }
        }
    }
}
