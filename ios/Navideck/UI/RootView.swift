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
    case albums
    case artists
    case albumCollection(AlbumCollection)
    case playlists
    case genres
    case favorites
    case settings
    case radio
    case downloads
}

struct MainTabs: View {
    @Environment(AppModel.self) private var app

    @State private var selection: Int = {
        #if DEBUG
        if let raw = ProcessInfo.processInfo.environment["NAVIDECK_DEMO_TAB"],
           let tab = Int(raw), (0...3).contains(tab) {
            return tab
        }
        #endif
        return 0
    }()
    @State private var paths: [NavigationPath] = Array(repeating: NavigationPath(), count: 4)
    /// Tabs that have been opened at least once. Their stacks stay mounted so
    /// scroll positions survive, but a tab is not loaded before its first visit.
    @State private var visitedTabs: Set<Int> = []
    /// Measured height of the Start/pill/Suche row; every stack reserves it.
    @State private var barHeight: CGFloat = 64
    @State private var navExpanded = false
    @State private var showSearch = false

    var body: some View {
        @Bindable var player = app.player

        // Deliberately no TabView: iOS 26 draws its own floating glass tab bar
        // and left a remnant capsule behind our custom bar. A plain switcher
        // keeps every stack alive after its first visit.
        ZStack {
            ForEach(0..<4, id: \.self) { index in
                if visitedTabs.contains(index) || selection == index {
                    stack(index) { screen(index) }
                        .opacity(selection == index ? 1 : 0)
                        .allowsHitTesting(selection == index)
                        .zIndex(selection == index ? 1 : 0)
                }
            }
        }
        .onChange(of: selection) { _, tab in
            visitedTabs.insert(tab)
        }
        .tint(Theme.accent)
        .overlay {
            if navExpanded {
                Color.black.opacity(0.32)
                    .ignoresSafeArea()
                    .transition(.opacity)
                    .onTapGesture { closeNavigation() }
            }
        }
        .overlay(alignment: .bottom) {
            bottomBar
        }
        .overlay {
            if showSearch {
                SearchOverlay {
                    withAnimation(.easeOut(duration: 0.18)) { showSearch = false }
                }
                .transition(.opacity)
            }
        }
        .fullScreenCover(isPresented: $player.showNowPlaying) {
            NowPlayingView()
        }
        .onChange(of: app.pendingRoute) { _, route in
            guard let route else { return }
            app.pendingRoute = nil
            paths[selection].append(route)
        }
        .onChange(of: player.showNowPlaying) { _, open in
            if open { closeNavigation() }
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
        let env = ProcessInfo.processInfo.environment
        if env["NAVIDECK_DEMO_SEARCH"] == "1" {
            showSearch = true
            return
        }
        if env["NAVIDECK_DEMO_NAV"] == "1" {
            withAnimation(.easeOut(duration: 0.16)) { navExpanded = true }
            return
        }
        guard let raw = env["NAVIDECK_DEMO_ROUTE"] else { return }
        if raw == "album" {
            Task {
                guard let client = app.client,
                      let albums = try? await client.albumList(.newest, size: 1),
                      let first = albums.first else { return }
                paths[selection].append(LibraryRoute.album(first))
            }
            return
        }
        if raw == "playlist" {
            Task {
                guard let client = app.client,
                      let playlists = try? await client.playlists(),
                      let first = playlists.first else { return }
                paths[selection].append(LibraryRoute.playlist(first))
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
        case "musik": selection = 1
        case "podcasts": selection = 2
        case "settings": selection = 3
        case "albums": paths[selection].append(LibraryRoute.albums)
        case "artists": paths[selection].append(LibraryRoute.artists)
        case "newest": paths[selection].append(LibraryRoute.albumCollection(.newest))
        case "recent": paths[selection].append(LibraryRoute.albumCollection(.recent))
        case "frequent": paths[selection].append(LibraryRoute.albumCollection(.frequent))
        case "playlists": paths[selection].append(LibraryRoute.playlists)
        case "genres": paths[selection].append(LibraryRoute.genres)
        case "favorites": paths[selection].append(LibraryRoute.favorites)
        case "radio": paths[selection].append(LibraryRoute.radio)
        case "downloads": paths[selection].append(LibraryRoute.downloads)
        default: break
        }
    }
    #endif

    // MARK: - Bottom bar

    private var bottomBar: some View {
        VStack(spacing: 10) {
            if navExpanded {
                FloatingTabBar(selection: $selection) {
                    closeNavigation()
                }
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }

            HStack(spacing: 10) {
                glassButton("Start", icon: "house", active: navExpanded) {
                    toggleNavigation()
                }

                if app.player.current != nil {
                    MiniPlayerBar()
                        .frame(maxWidth: .infinity)
                } else {
                    Spacer(minLength: 0)
                }

                glassButton("Suche", icon: "magnifyingglass") {
                    openSearch()
                }
            }
            .padding(.top, 12)
            .padding(.bottom, 6)
            .background {
                GeometryReader { proxy in
                    Color.clear.preference(key: BottomBarHeightKey.self, value: proxy.size.height)
                }
            }
        }
        .padding(.horizontal, 16)
        .background {
            // Soft scrim so lists fade out under the glass instead of showing
            // through too harshly.
            LinearGradient(
                stops: [
                    .init(color: Theme.background.opacity(navExpanded ? 0.6 : 0), location: 0),
                    .init(color: Theme.background.opacity(0.45), location: 0.22),
                    .init(color: Theme.background.opacity(0.9), location: 0.62),
                    .init(color: Theme.background, location: 1),
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea(edges: .bottom)
            .allowsHitTesting(false)
        }
        .onPreferenceChange(BottomBarHeightKey.self) { height in
            if abs(height - barHeight) > 0.5 {
                barHeight = height
            }
        }
    }

    /// Round icon button. No label text: the symbol alone, on a glass circle.
    private func glassButton(
        _ title: String,
        icon: String,
        active: Bool = false,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 18, weight: .medium))
                .foregroundStyle(active ? Theme.accent : Theme.text)
                .frame(width: 48, height: 48)
                .navideckGlass(
                    Circle(),
                    tint: active ? Theme.accent.opacity(0.3) : nil
                )
                .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(title)
    }

    private func toggleNavigation() {
        withAnimation(.spring(response: 0.26, dampingFraction: 0.9)) {
            navExpanded.toggle()
        }
    }

    private func closeNavigation() {
        guard navExpanded else { return }
        withAnimation(.easeOut(duration: 0.16)) {
            navExpanded = false
        }
    }

    private func openSearch() {
        withAnimation(.easeOut(duration: 0.16)) {
            navExpanded = false
            showSearch = true
        }
    }

    // MARK: - Tabs

    @ViewBuilder
    private func screen(_ index: Int) -> some View {
        switch index {
        case 0: HomeView()
        case 1: MusikView()
        case 2: PodcastsView()
        default: SettingsView()
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
        .safeAreaInset(edge: .bottom, spacing: 0) {
            Color.clear.frame(height: barHeight)
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
        case .albums:
            AlbumsView()
        case .artists:
            ArtistsView()
        case .albumCollection(let collection):
            AlbumCollectionView(collection: collection)
        case .playlists:
            PlaylistsView()
        case .genres:
            GenresView()
        case .favorites:
            FavoritesView()
        case .settings:
            SettingsView()
        case .radio:
            RadioView()
        case .downloads:
            DownloadsView()
        }
    }
}

private struct BottomBarHeightKey: PreferenceKey {
    static let defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = max(value, nextValue())
    }
}
