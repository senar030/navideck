import SwiftUI

/// Second tab: everything that belongs to the music library in one place.
/// Podcasts and radio keep their own tab/screen, this is the library hub.
struct MusikView: View {
    @Environment(AppModel.self) private var app

    private let columns = [
        GridItem(.flexible(), spacing: 12, alignment: .top),
        GridItem(.flexible(), spacing: 12, alignment: .top),
    ]

    private var tiles: [Tile] {
        [
            Tile("Alben", "Alle Alben der Bibliothek", "square.stack", .albums),
            Tile("Interpreten", "Nach Künstler sortiert", "music.mic", .artists),
            Tile("Playlists", "Eigene und geteilte Listen", "music.note.list", .playlists),
            Tile("Genres", "Nach Stilrichtung stöbern", "guitars", .genres),
            Tile("Favoriten", "Markierte Titel und Alben", "star", .favorites),
            Tile("Radio", "Internetradios des Servers", "dot.radiowaves.left.and.right", .radio),
            Tile("Downloads", downloadsSubtitle, "arrow.down", .downloads),
        ]
    }

    private var downloadsSubtitle: String {
        let count = app.downloads.items.count
        return count == 0 ? "Offline verfügbar" : "\(count) offline verfügbar"
    }

    var body: some View {
        ScrollView {
            LazyVGrid(columns: columns, spacing: 12) {
                ForEach(tiles) { tile in
                    NavigationLink(value: tile.route) {
                        tileView(tile)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
        }
        .navigationTitle("Musik")
        .navideckScreen()
    }

    private func tileView(_ tile: Tile) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Image(systemName: tile.icon)
                .font(.system(size: 18, weight: .regular))
                .foregroundStyle(Theme.accent)
                .frame(height: 24)

            VStack(alignment: .leading, spacing: 2) {
                Text(tile.title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.text)
                Text(tile.subtitle)
                    .font(.caption2)
                    .foregroundStyle(Theme.muted)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
            }
        }
        .frame(maxWidth: .infinity, minHeight: 96, alignment: .topLeading)
        .padding(14)
        .background(Theme.surface)
        .overlay {
            Rectangle().stroke(Theme.hairline, lineWidth: 0.5)
        }
        .contentShape(Rectangle())
    }

    private struct Tile: Identifiable {
        let title: String
        let subtitle: String
        let icon: String
        let route: LibraryRoute

        var id: String { title }

        init(_ title: String, _ subtitle: String, _ icon: String, _ route: LibraryRoute) {
            self.title = title
            self.subtitle = subtitle
            self.icon = icon
            self.route = route
        }
    }
}
