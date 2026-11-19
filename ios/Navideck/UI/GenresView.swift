import SwiftUI

struct GenresView: View {
    /// Used inside a category shell that already provides the chrome.
    var embedded = false
    @Environment(AppModel.self) private var app

    @AppStorage("navideck.genres-ascending") private var ascending = true
    @AppStorage("navideck.genres-layout") private var layout = "list"
    @State private var genres: [Genre] = []
    @State private var loading = false
    @State private var errorMessage: String?

    var body: some View {
        ScrollView {
            if layout == "grid" {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 150, maximum: 220), spacing: 14)], spacing: 16) {
                    ForEach(shownGenres) { genre in
                        NavigationLink(value: LibraryRoute.genre(genre)) {
                            VStack(alignment: .leading, spacing: 8) {
                                Image(systemName: "guitars")
                                    .font(.system(size: 18))
                                    .foregroundStyle(Theme.accent)
                                Text(genre.value)
                                    .font(.body.weight(.medium))
                                    .foregroundStyle(Theme.text)
                                    .lineLimit(2)
                                if let count = genre.songCount {
                                    Text("\(count) Titel")
                                        .font(.caption)
                                        .foregroundStyle(Theme.muted)
                                }
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(14)
                            .background(Theme.surface, in: RoundedRectangle(cornerRadius: Theme.artworkRadius, style: .continuous))
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 12)
            } else {
            LazyVStack(alignment: .leading, spacing: 0) {
                ForEach(shownGenres) { genre in
                    NavigationLink(value: LibraryRoute.genre(genre)) {
                        HStack(spacing: 12) {
                            Image(systemName: "guitars")
                                .font(.system(size: 14, weight: .regular))
                                .foregroundStyle(Theme.accent)
                                .frame(width: 40, height: 40)
                                .background(Theme.surface)

                            Text(genre.value)
                                .font(.body.weight(.medium))
                                .foregroundStyle(Theme.text)
                                .lineLimit(1)

                            Spacer()

                            if let count = genre.songCount {
                                Text("\(count)")
                                    .font(.caption.monospacedDigit())
                                    .foregroundStyle(Theme.muted)
                            }

                            Image(systemName: "chevron.right")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(Theme.muted.opacity(0.7))
                        }
                        .padding(.horizontal, 20)
                        .padding(.vertical, 8)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)

                    if genre.id != shownGenres.last?.id {
                        Divider().overlay(Theme.hairline).padding(.leading, 80)
                    }
                }
            }
            .padding(.vertical, 8)
            }

            if let errorMessage {
                ErrorBanner(message: errorMessage).padding(.horizontal, 20)
            }

            if loading && shownGenres.isEmpty {
                ProgressView().tint(Theme.accent).padding(.vertical, 40)
            }

            if shownGenres.isEmpty && !loading && errorMessage == nil {
                EmptyStateView(
                    icon: "guitars",
                    title: "Keine Genres",
                    message: "Der Server liefert keine Genre-Liste."
               )
            }
        }
        .navigationTitle(embedded ? "" : "Genres")
        .navideckScreen()
        .toolbar {
            ToolbarItemGroup(placement: .topBarLeading) {
                Button {
                    ascending.toggle()
                } label: {
                    Image(systemName: ascending ? "arrow.up" : "arrow.down")
                }
                .accessibilityLabel(ascending ? "A–Z" : "Z–A")

                Button {
                    layout = layout == "list" ? "grid" : "list"
                } label: {
                    Image(systemName: layout == "list" ? "square.grid.2x2" : "list.bullet")
                }
                .accessibilityLabel(layout == "list" ? "Kachelansicht" : "Listenansicht")
            }
        }
        .task { await load() }
        .refreshable { await load() }
    }

    private var shownGenres: [Genre] {
        let source = app.offlineMode ? app.downloadedGenres : genres
        return source.sorted {
            $0.value.localizedCaseInsensitiveCompare($1.value) == (ascending ? .orderedAscending : .orderedDescending)
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
            genres = try await client.genres()
                .sorted { $0.value.localizedCaseInsensitiveCompare($1.value) == .orderedAscending }
        } catch {
            if !Format.isCancellation(error) {
                errorMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
            }
        }
        loading = false
    }
}

struct GenreDetailView: View {
    private enum Mode: String, CaseIterable {
        case albums = "Alben"
        case songs = "Titel"
    }

    @Environment(AppModel.self) private var app
    let genre: Genre

    @State private var mode: Mode = .albums
    @State private var albums: [Album] = []
    @State private var songs: [Song] = []
    @State private var albumsDone = false
    @State private var songsDone = false
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

                switch mode {
                case .albums:
                    albumContent
                case .songs:
                    songContent
                }
            }
            .padding(.vertical, 12)
        }
        .navigationTitle(genre.value)
        .navideckScreen()
        .task { await loadInitial() }
        .onChange(of: mode) { _, newValue in
            Task {
                if newValue == .albums && albums.isEmpty {
                    await loadAlbums()
                } else if newValue == .songs && songs.isEmpty {
                    await loadSongs()
                }
            }
        }
    }

    private var albumContent: some View {
        VStack(spacing: 14) {
            LazyVGrid(
                columns: [GridItem(.adaptive(minimum: 150, maximum: 220), spacing: 14, alignment: .top)],
                spacing: 20
           ) {
                ForEach(albums) { album in
                    AlbumCard(album: album)
                }
            }
            .padding(.horizontal, 20)

            loadMoreButton(visible: !albumsDone) {
                Task { await loadAlbums() }
            }
        }
    }

    private var songContent: some View {
        VStack(spacing: 0) {
            ForEach(Array(songs.enumerated()), id: \.element.id) { offset, song in
                Button {
                    app.player.play(songs, startingAt: offset)
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

                if song.id != songs.last?.id {
                    Divider().overlay(Theme.hairline).padding(.leading, 56)
                }
            }

            loadMoreButton(visible: !songsDone) {
                Task { await loadSongs() }
            }
        }
    }

    private func loadMoreButton(visible: Bool, action: @escaping () -> Void) -> some View {
        Group {
            if visible {
                Button("Mehr laden", action: action)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.accent)
                    .padding(.vertical, 16)
            } else if loading {
                ProgressView().tint(Theme.accent).padding(.vertical, 16)
            }
        }
    }

    private func loadInitial() async {
        await loadAlbums()
    }

    private func loadAlbums() async {
        if app.offlineMode {
            albums = app.downloadedAlbums.filter {
                ($0.genre ?? "").caseInsensitiveCompare(genre.value) == .orderedSame
                    || $0.songs.contains { ($0.genre ?? "").caseInsensitiveCompare(genre.value) == .orderedSame }
            }
            albumsDone = true
            loading = false
            return
        }
        guard let client = app.client, !loading, !albumsDone else { return }
        loading = true
        do {
            let page = try await client.albums(byGenre: genre.value, offset: albums.count)
            albums.append(contentsOf: page.filter { album in !albums.contains { $0.id == album.id } })
            albumsDone = page.count < SubsonicClient.pageSize
        } catch {
            if !Format.isCancellation(error) {
                errorMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
            }
            albumsDone = true
        }
        loading = false
    }

    private func loadSongs() async {
        if app.offlineMode {
            songs = app.downloadedSongs.filter {
                ($0.genre ?? "").caseInsensitiveCompare(genre.value) == .orderedSame
            }
            songsDone = true
            loading = false
            return
        }
        guard let client = app.client, !loading, !songsDone else { return }
        loading = true
        do {
            let page = try await client.songs(byGenre: genre.value, offset: songs.count)
            songs.append(contentsOf: page.filter { song in !songs.contains { $0.id == song.id } })
            songsDone = page.count < SubsonicClient.pageSize
        } catch {
            if !Format.isCancellation(error) {
                errorMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
            }
            songsDone = true
        }
        loading = false
    }
}
