import SwiftUI

enum AlbumSort: String, CaseIterable, Identifiable {
    case newest
    case recent
    case frequent
    case alphabetical
    case random

    var id: String { rawValue }

    var label: String {
        switch self {
        case .newest: return "Neu hinzugefügt"
        case .recent: return "Zuletzt gespielt"
        case .frequent: return "Meistgespielt"
        case .alphabetical: return "A–Z"
        case .random: return "Zufällig"
        }
    }

    var listType: AlbumListType {
        switch self {
        case .newest: return .newest
        case .recent: return .recent
        case .frequent: return .frequent
        case .alphabetical: return .alphabeticalByName
        case .random: return .random
        }
    }
}

struct AlbumsView: View {
    @Environment(AppModel.self) private var app

    @State private var albums: [Album] = []
    @State private var sort: AlbumSort = .newest
    @State private var loading = false
    @State private var canLoadMore = true
    @State private var errorMessage: String?
    @AppStorage("navideck.albums-layout") private var layout = "grid"

    private let columns = [
        GridItem(.adaptive(minimum: 150, maximum: 220), spacing: 14, alignment: .top)
    ]

    var body: some View {
        ScrollView {
            if layout == "grid" {
                LazyVGrid(columns: columns, spacing: 20) {
                    ForEach(shownAlbums) { album in
                        AlbumCard(album: album)
                            .onAppear {
                                if album.id == albums.last?.id {
                                    Task { await loadNextPage() }
                                }
                            }
                    }
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 12)
            } else {
                LazyVStack(spacing: 0) {
                    ForEach(Array(shownAlbums.enumerated()), id: \.element.id) { offset, album in
                        AlbumRow(album: album)
                            .padding(.horizontal, 20)
                            .onAppear {
                                if offset == albums.count - 1 {
                                    Task { await loadNextPage() }
                                }
                            }

                        if offset < albums.count - 1 {
                            Divider()
                                .overlay(Theme.hairline)
                                .padding(.leading, 84)
                        }
                    }
                }
                .padding(.vertical, 8)
            }

            if let errorMessage {
                ErrorBanner(message: errorMessage)
                    .padding(.horizontal, 20)
            }

            if loading {
                ProgressView()
                    .tint(Theme.accent)
                    .padding(.vertical, 20)
            }

            if albums.isEmpty && !loading && errorMessage == nil {
                EmptyStateView(
                    icon: "square.stack",
                    title: "Keine Alben",
                    message: "Diese Bibliothek hat noch keine Alben."
                )
            }
        }
        .navigationTitle("Alben")
        .navideckScreen()
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                Button {
                    withAnimation(.easeOut(duration: 0.18)) {
                        layout = layout == "grid" ? "list" : "grid"
                    }
                } label: {
                    Image(systemName: layout == "grid" ? "list.bullet" : "square.grid.2x2")
                }
                .accessibilityLabel(layout == "grid" ? "Listenansicht" : "Kachelansicht")

                Menu {
                    Picker("Sortierung", selection: $sort) {
                        ForEach(AlbumSort.allCases) { option in
                            Text(option.label).tag(option)
                        }
                    }
                } label: {
                    Image(systemName: "arrow.up.arrow.down.circle")
                        .foregroundStyle(Theme.text)
                }
                .accessibilityLabel("Sortierung")
            }
        }
        .task(id: sort) { await reload() }
        .refreshable { await reload() }
    }

    /// Offline the grid is simply a filtered view of the downloads.
    private var shownAlbums: [Album] {
        app.offlineMode ? app.downloadedAlbums : albums
    }

    private func reload() async {
        if app.offlineMode {
            albums = app.downloadedAlbums
            canLoadMore = false
            errorMessage = nil
            loading = false
            return
        }
        guard let client = app.client else { return }
        albums = []
        canLoadMore = true
        errorMessage = nil
        loading = true
        do {
            let page = try await client.albumList(sort.listType, offset: 0)
            albums = page
            canLoadMore = sort != .random && page.count >= SubsonicClient.pageSize
        } catch {
            errorMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
        loading = false
        await prefetch(Array(albums.prefix(18)))
    }

    private func loadNextPage() async {
        guard !app.offlineMode, let client = app.client, canLoadMore, !loading else { return }
        loading = true
        do {
            let page = try await client.albumList(sort.listType, offset: albums.count)
            let known = Set(albums.map(\.id))
            albums.append(contentsOf: page.filter { !known.contains($0.id) })
            canLoadMore = page.count >= SubsonicClient.pageSize
        } catch {
            canLoadMore = false
        }
        loading = false
        await prefetch(Array(albums.suffix(18)))
    }

    /// Warms the cover cache so the grid fills in without blank tiles.
    private func prefetch(_ albums: [Album]) async {
        let urls = albums.compactMap { app.artworkURL($0.coverArt) }
        await ImageStore.shared.prefetch(urls, limit: 18)
    }
}
