import SwiftUI

/// „Kürzlich hinzugefügt“, „Kürzlich gespielt“ and „Häufig gespielt“ from the
/// music tab. Grid or list, like the album library itself.
struct AlbumCollectionView: View {
    @Environment(AppModel.self) private var app
    let collection: AlbumCollection

    @AppStorage("navideck.collection-layout") private var layout = "grid"

    @State private var albums: [Album] = []
    @State private var loading = false
    @State private var errorMessage: String?

    private let columns = [
        GridItem(.adaptive(minimum: 150, maximum: 220), spacing: 14, alignment: .top)
    ]

    var body: some View {
        ScrollView {
            if layout == "grid" {
                LazyVGrid(columns: columns, spacing: 20) {
                    ForEach(shownAlbums) { album in
                        AlbumCard(album: album)
                    }
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 12)
            } else {
                LazyVStack(spacing: 0) {
                    ForEach(Array(shownAlbums.enumerated()), id: \.element.id) { offset, album in
                        AlbumRow(album: album)
                            .padding(.horizontal, 20)

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
                    .padding(.top, 12)
            }

            if loading && albums.isEmpty {
                ProgressView().tint(Theme.accent).padding(.vertical, 40)
            }

            if shownAlbums.isEmpty && !loading && errorMessage == nil {
                EmptyStateView(
                    icon: collection.icon,
                    title: "Keine Alben",
                    message: "Für \(collection.title) gibt es noch keine Alben."
                )
            }
        }
        .navigationTitle(collection.title)
        .navideckScreen()
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    withAnimation(.easeOut(duration: 0.18)) {
                        layout = layout == "grid" ? "list" : "grid"
                    }
                } label: {
                    Image(systemName: layout == "grid" ? "list.bullet" : "square.grid.2x2")
                }
                .accessibilityLabel(layout == "grid" ? "Listenansicht" : "Kachelansicht")
            }
        }
        .task { await load() }
        .refreshable { await load() }
    }

    private var shownAlbums: [Album] {
        app.offlineMode ? app.downloadedAlbums : albums
    }

    private func load() async {
        if app.offlineMode {
            albums = app.downloadedAlbums
            loading = false
            return
        }
        guard let client = app.client else { return }
        loading = true
        errorMessage = nil
        do {
            let page = try await client.albumList(collection.listType, size: 100)
            albums = page
            await ImageStore.shared.prefetch(
                page.prefix(24).compactMap { app.artworkURL($0.coverArt, size: 300) },
                limit: 24
            )
        } catch {
            errorMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
        loading = false
    }
}
