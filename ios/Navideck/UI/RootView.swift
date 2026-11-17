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

/// Every destination the app can push. Keeping this in one enum makes links
/// work from any tab and lets the player open an album or artist from a sheet.
enum LibraryRoute: Hashable {
    case album(Album)
    case artist(Artist)
    case playlist(Playlist)
    case genre(Genre)
    case playlists
    case genres
    case favorites
    case settings
    case podcasts
    case radio
    case downloads
}

struct MainTabs: View {
    @Environment(AppModel.self) private var app
    @State private var selection: Int = {
        #if DEBUG
        if let raw = ProcessInfo.processInfo.environment["NAVIDECK_DEMO_TAB"],
           let tab = Int(raw), (0...4).contains(tab) {
            return tab
        }
        #endif
        return 0
    }()
    @State private var paths: [NavigationPath] = Array(repeating: NavigationPath(), count: 5)

    var body: some View {
        @Bindable var player = app.player

        TabView(selection: $selection) {
            stack(0) { HomeView() }
                .tag(0)

            stack(1) { AlbumsView() }
                .tag(1)

            stack(2) { ArtistsView() }
                .tag(2)

            stack(3) { SearchView() }
                .tag(3)

            stack(4) { SettingsView() }
                .tag(4)
        }
        .tint(Theme.accent)
        // The system bar is replaced by the floating pill below.
        .toolbar(.hidden, for: .tabBar)
        .safeAreaInset(edge: .bottom, spacing: 0) {
            bottomBar
        }
        .fullScreenCover(isPresented: $player.showNowPlaying) {
            NowPlayingView()
        }
        .onChange(of: app.pendingRoute) { _, route in
            guard let route else { return }
            app.pendingRoute = nil
            paths[selection].append(route)
        }
        .task {
            #if DEBUG
            pushDemoRoute()
            #endif
        }
    }

    #if DEBUG
    /// Opens a screen in the simulator without tapping through the UI, e.g.
    /// SIMCTL_CHILD_NAVIDECK_DEMO_ROUTE=downloads
    private func pushDemoRoute() {
        guard let raw = ProcessInfo.processInfo.environment["NAVIDECK_DEMO_ROUTE"] else { return }
        if raw == "album" {
            Task {
                guard let client = app.client,
                      let albums = try? await client.albumList(.newest, size: 1),
                      let first = albums.first else { return }
                paths[selection].append(LibraryRoute.album(first))
            }
            return
        }
        if raw == "mix" {
            Task {
                await app.startInstantMix()
                if app.player.current != nil {
                    app.player.showNowPlaying = true
                }
            }
            return
        }
        if raw == "downloads", app.downloads.items.isEmpty {
            Task {
                if let client = app.client,
                   let albums = try? await client.albumList(.newest, size: 1),
                   let first = albums.first,
                   let full = try? await client.album(id: first.id) {
                    app.download(full)
                    try? await Task.sleep(nanoseconds: 3_000_000_000)
                }
                paths[selection].append(LibraryRoute.downloads)
            }
            return
        }
        switch raw {
        case "playlists": paths[selection].append(LibraryRoute.playlists)
        case "genres": paths[selection].append(LibraryRoute.genres)
        case "favorites": paths[selection].append(LibraryRoute.favorites)
        case "settings": paths[selection].append(LibraryRoute.settings)
        case "podcasts": paths[selection].append(LibraryRoute.podcasts)
        case "radio": paths[selection].append(LibraryRoute.radio)
        case "downloads": paths[selection].append(LibraryRoute.downloads)
        default: break
        }
    }
    #endif

    private var bottomBar: some View {
        VStack(spacing: 8) {
            MiniPlayerBar()
            FloatingTabBar(selection: $selection)
        }
        .padding(.horizontal, 16)
        .padding(.top, 12)
        .padding(.bottom, 6)
        .background {
            // Soft scrim so lists fade out instead of showing through the pill.
            LinearGradient(
                colors: [Theme.background.opacity(0), Theme.background.opacity(0.92), Theme.background],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea(edges: .bottom)
            .allowsHitTesting(false)
        }
    }

    private func stack<Content: View>(
        _ index: Int,
        @ViewBuilder content: () -> Content
    ) -> some View {
        NavigationStack(path: $paths[index]) {
            content()
                .navigationDestination(for: LibraryRoute.self) { route in
                    destination(for: route)
                }
        }
    }

    @ViewBuilder
    private func destination(for route: LibraryRoute) -> some View {
        switch route {
        case .album(let album):
            AlbumDetailView(album: album)
        case .artist(let artist):
            ArtistDetailView(artist: artist)
        case .playlist(let playlist):
            PlaylistDetailView(playlist: playlist)
        case .genre(let genre):
            GenreDetailView(genre: genre)
        case .playlists:
            PlaylistsView()
        case .genres:
            GenresView()
        case .favorites:
            FavoritesView()
        case .settings:
            SettingsView()
        case .podcasts:
            PodcastsView()
        case .radio:
            RadioView()
        case .downloads:
            DownloadsView()
        }
    }
}
