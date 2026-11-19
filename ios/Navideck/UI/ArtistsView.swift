import SwiftUI

struct ArtistsView: View {
    /// Used inside a category shell that already provides the chrome.
    var embedded = false
    @Environment(AppModel.self) private var app

    @AppStorage("navideck.artists-layout") private var layout = "list"
    @AppStorage("navideck.artists-ascending") private var ascending = true
    @State private var indexes: [ArtistIndex] = []
    @State private var loading = false
    @State private var errorMessage: String?

    var body: some View {
        ScrollView {
            if layout == "grid" {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 100, maximum: 140), spacing: 16)], spacing: 20) {
                    ForEach(sections.flatMap(\.artists)) { artist in
                        NavigationLink(value: LibraryRoute.artist(artist)) {
                            VStack(spacing: 8) {
                                PersonAvatar(url: app.artworkURL(artist.coverArt, size: 240), size: 92)
                                Text(artist.name)
                                    .font(.footnote.weight(.medium))
                                    .foregroundStyle(Theme.text)
                                    .lineLimit(2)
                                    .multilineTextAlignment(.center)
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 12)
            } else {
            LazyVStack(alignment: .leading, spacing: 0) {
                ForEach(sections, id: \.name) { section in
                    Text(section.name ?? "#")
                        .font(.footnote.weight(.bold))
                        .foregroundStyle(Theme.accent)
                        .padding(.horizontal, 20)
                        .padding(.top, 18)
                        .padding(.bottom, 6)

                    ForEach(section.artists) { artist in
                        ArtistRow(artist: artist)
                            .padding(.horizontal, 20)
                            .padding(.vertical, 6)

                        if artist.id != section.artists.last?.id {
                            Divider()
                                .overlay(Theme.hairline)
                                .padding(.leading, 78)
                        }
                    }
                }
            }
            .padding(.bottom, 12)
            }

            if let errorMessage {
                ErrorBanner(message: errorMessage)
                    .padding(.horizontal, 20)
                    .padding(.top, 12)
            }

            if loading && indexes.isEmpty {
                ProgressView().tint(Theme.accent).padding(.vertical, 40)
            }
        }
        .navigationTitle(embedded ? "" : "Interpreten")
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

    private var sections: [ArtistIndex] {
        let source: [ArtistIndex]
        if app.offlineMode {
            let artists = app.downloadedArtists
            source = artists.isEmpty ? [] : [ArtistIndex(artists: artists)]
        } else {
            source = indexes
        }
        return source
            .filter { !$0.artists.isEmpty }
            .map { index in
                var sorted = index.artists.sorted {
                    $0.name.localizedCaseInsensitiveCompare($1.name) == (ascending ? .orderedAscending : .orderedDescending)
                }
                return ArtistIndex(name: index.name, artists: sorted)
            }
    }

    private func load() async {
        if app.offlineMode {
            indexes = [ArtistIndex(artists: app.downloadedArtists)]
            errorMessage = nil
            loading = false
            return
        }
        guard let client = app.client else { return }
        loading = true
        errorMessage = nil
        do {
            indexes = try await client.artistIndexes()
            let artists = indexes.flatMap(\.artists).prefix(20)
            await ImageStore.shared.prefetch(artists.compactMap { app.artworkURL($0.coverArt) }, limit: 20)
        } catch {
            errorMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
        loading = false
    }
}
