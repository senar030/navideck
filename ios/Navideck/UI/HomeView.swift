import SwiftUI

struct HomeView: View {
    @Environment(AppModel.self) private var app

    @State private var newest: [Album] = []
    @State private var recent: [Album] = []
    @State private var frequent: [Album] = []
    @State private var random: [Album] = []
    @State private var loading = false
    @State private var errorMessage: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                shortcuts

                if let errorMessage {
                    ErrorBanner(message: errorMessage)
                        .padding(.horizontal, 20)
                }

                if loading && newest.isEmpty {
                    ProgressView("Bibliothek wird geladen …")
                        .tint(Theme.accent)
                        .foregroundStyle(Theme.muted)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 40)
                }

                if !recent.isEmpty {
                    albumSection("Zuletzt gespielt", albums: recent)
                }
                if !newest.isEmpty {
                    albumSection("Neu im Regal", albums: newest)
                }
                if !frequent.isEmpty {
                    albumSection("Meistgespielt", albums: frequent)
                }
                albumSection(
                    "Zufällig",
                    albums: random,
                    actionTitle: "Neu mischen",
                    action: { Task { await loadRandom() } }
                )
            }
            .padding(.vertical, 10)
        }
        .navigationTitle("Start")
        .navideckScreen()
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                NavigationLink(value: HomeRoute.settings) {
                    Image(systemName: "gearshape")
                        .foregroundStyle(Theme.text)
                }
                .accessibilityLabel("Einstellungen")
            }
        }
        .task { await load() }
        .refreshable { await load() }
    }

    private var shortcuts: some View {
        HStack(spacing: 10) {
            shortcut("Favoriten", icon: "star.fill", route: .favorites)
            shortcut("Playlists", icon: "music.note.list", route: .playlists)
            shortcut("Genres", icon: "guitars.fill", route: .genres)
        }
        .padding(.horizontal, 20)
    }

    private func shortcut(_ title: String, icon: String, route: HomeRoute) -> some View {
        NavigationLink(value: route) {
            VStack(alignment: .leading, spacing: 10) {
                Image(systemName: icon)
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(Theme.accent)
                Text(title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.text)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    private func albumSection(
        _ title: String,
        albums: [Album],
        actionTitle: String? = nil,
        action: (() -> Void)? = nil
    ) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: title, actionTitle: actionTitle, action: action)

            ScrollView(.horizontal, showsIndicators: false) {
                LazyHStack(alignment: .top, spacing: 14) {
                    ForEach(albums) { album in
                        AlbumCard(album: album)
                            .frame(width: 148)
                    }
                }
                .padding(.horizontal, 20)
            }
        }
    }

    private func load() async {
        guard let client = app.client else { return }
        loading = true
        errorMessage = nil
        do {
            async let newestAlbums = client.albumList(.newest, size: 12)
            async let recentAlbums = client.albumList(.recent, size: 12)
            async let frequentAlbums = client.albumList(.frequent, size: 12)
            async let randomAlbums = client.albumList(.random, size: 12)
            let result = try await (newestAlbums, recentAlbums, frequentAlbums, randomAlbums)
            newest = result.0
            recent = result.1
            frequent = result.2
            random = result.3
        } catch {
            errorMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
        loading = false
    }

    private func loadRandom() async {
        guard let client = app.client else { return }
        if let albums = try? await client.albumList(.random, size: 12) {
            random = albums
        }
    }
}
