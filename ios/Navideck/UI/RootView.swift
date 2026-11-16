import SwiftUI

struct RootView: View {
    @Environment(AppModel.self) private var app
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        Group {
            if app.isConnected {
                MainTabs()
                    .transition(.opacity)
            } else {
                ConnectView()
                    .transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: 0.2), value: app.isConnected)
        .onChange(of: scenePhase) { _, phase in
            if phase != .active {
                app.player.saveNow()
            }
        }
    }
}

struct MainTabs: View {
    @Environment(AppModel.self) private var app
    @State private var selection = 0

    var body: some View {
        @Bindable var player = app.player

        TabView(selection: $selection) {
            tab { HomeView() }
                .tabItem { Label("Start", systemImage: "house.fill") }
                .tag(0)

            tab { AlbumsView() }
                .tabItem { Label("Alben", systemImage: "square.stack.fill") }
                .tag(1)

            tab { ArtistsView() }
                .tabItem { Label("Interpreten", systemImage: "music.mic") }
                .tag(2)

            tab { SearchView() }
                .tabItem { Label("Suche", systemImage: "magnifyingglass") }
                .tag(3)

            tab { SettingsView() }
                .tabItem { Label("Einstellungen", systemImage: "gearshape.fill") }
                .tag(4)
        }
        .tint(Theme.accent)
        .fullScreenCover(isPresented: $player.showNowPlaying) {
            NowPlayingView()
        }
    }

    private func tab<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        NavigationStack {
            content()
                .modifier(LibraryDestinations())
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            MiniPlayerBar()
        }
    }
}

/// Routes that every tab can push, so a link works no matter where it starts.
struct LibraryDestinations: ViewModifier {
    func body(content: Content) -> some View {
        content
            .navigationDestination(for: Album.self) { AlbumDetailView(album: $0) }
            .navigationDestination(for: Artist.self) { ArtistDetailView(artist: $0) }
            .navigationDestination(for: Playlist.self) { PlaylistDetailView(playlist: $0) }
            .navigationDestination(for: Genre.self) { GenreDetailView(genre: $0) }
            .navigationDestination(for: HomeRoute.self) { route in
                switch route {
                case .playlists: PlaylistsView()
                case .genres: GenresView()
                case .favorites: FavoritesView()
                case .settings: SettingsView()
                }
            }
    }
}

enum HomeRoute: Hashable {
    case playlists
    case genres
    case favorites
    case settings
}
