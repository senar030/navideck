import SwiftUI

struct SearchView: View {
    @Environment(AppModel.self) private var app

    @State private var query = ""
    @State private var results = SearchResult()
    @State private var loading = false
    @State private var errorMessage: String?
    @State private var searched = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                if let errorMessage {
                    ErrorBanner(message: errorMessage).padding(.horizontal, 20)
                }

                if loading {
                    ProgressView().tint(Theme.accent)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 30)
                }

                if searched && results.isEmpty && !loading {
                    EmptyStateView(
                        icon: "magnifyingglass",
                        title: "Nichts gefunden",
                        message: "Kein Treffer für „\(query)“."
                    )
                }

                if !results.artists.isEmpty {
                    VStack(alignment: .leading, spacing: 6) {
                        SectionHeader(title: "Interpreten")
                        ForEach(results.artists) { artist in
                            ArtistRow(artist: artist)
                                .padding(.horizontal, 20)
                                .padding(.vertical, 6)
                        }
                    }
                }

                if !results.albums.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        SectionHeader(title: "Alben")
                        ScrollView(.horizontal, showsIndicators: false) {
                            LazyHStack(alignment: .top, spacing: 14) {
                                ForEach(results.albums) { album in
                                    AlbumCard(album: album)
                                        .frame(width: 148)
                                }
                            }
                            .padding(.horizontal, 20)
                        }
                    }
                }

                if !results.songs.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        SectionHeader(title: "Titel")
                        ForEach(Array(results.songs.enumerated()), id: \.element.id) { offset, song in
                            Button {
                                app.player.play(results.songs, startingAt: offset)
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
                }

                if !searched && query.isEmpty {
                    EmptyStateView(
                        icon: "magnifyingglass",
                        title: "Suchen",
                        message: "Titel, Alben und Interpreten auf deinem Server."
                    )
                }
            }
            .padding(.vertical, 14)
        }
        .navigationTitle("Suche")
        .navideckScreen()
        .searchable(
            text: $query,
            placement: .navigationBarDrawer(displayMode: .always),
            prompt: "Titel, Alben oder Interpreten"
        )
        .task(id: query) { await scheduleSearch() }
    }

    private func scheduleSearch() async {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count >= 2 else {
            results = SearchResult()
            searched = false
            errorMessage = nil
            return
        }

        do {
            try await Task.sleep(nanoseconds: 350_000_000)
        } catch {
            return
        }
        guard !Task.isCancelled else { return }
        await search(trimmed)
    }

    private func search(_ text: String) async {
        guard let client = app.client else { return }
        loading = true
        errorMessage = nil
        do {
            results = try await client.search(text)
            searched = true
        } catch {
            if !Task.isCancelled {
                errorMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
                searched = true
            }
        }
        loading = false
    }
}
