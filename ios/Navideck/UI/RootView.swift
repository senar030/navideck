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
    case audiobooks
    case podcastLatest
    case podcastDownloads
    case audiobook(AbsBook)
    case audioSeries(String)
    case audioAuthor(String)
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
    /// Tabs that have been opened at least once. Their stacks stay mounted so
    /// scroll positions survive, but a tab is not loaded before its first visit.
    @State private var visitedTabs: Set<Int> = []
    /// Measured height of the Start/pill/Suche row; every stack reserves it.
    @State private var barHeight: CGFloat = 64
    /// Set while the start button's long press runs so its release does not
    /// also toggle the menu.
    @State private var suppressStartTap = false
    @State private var navExpanded = false
    @State private var showSearch = false

    var body: some View {
        @Bindable var player = app.player

        // Deliberately no TabView: iOS 26 draws its own floating glass tab bar
        // and left a remnant capsule behind our custom bar. A plain switcher
        // keeps every stack alive after its first visit.
        ZStack {
            ForEach(0..<5, id: \.self) { index in
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
            if tab == 2 {
                NotificationCenter.default.post(name: .navideckPodcastOverview, object: nil)
            }
        }
        .environment(\.bottomBarInset, barHeight)
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
        .onChange(of: app.pendingTab) { _, tab in
            guard let tab else { return }
            app.pendingTab = nil
            closeNavigation()
            selection = tab
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
        if raw == "audiobook" {
            Task {
                await app.loadAudiobooks()
                if let first = app.absBooks.first {
                    paths[selection].append(LibraryRoute.audiobook(first))
                }
            }
            return
        }
        if raw == "series" {
            Task {
                await app.loadAudiobooks()
                if let name = app.absBooks.compactMap({ $0.media.metadata.seriesTitle }).first {
                    selection = 3
                    paths[3].append(LibraryRoute.audioSeries(name))
                }
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
        case "audiobooks": selection = 3
        case "settings": selection = 4
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
        VStack(alignment: .leading, spacing: 6) {
            if navExpanded {
                FloatingTabBar(items: menuItems, selection: $selection) {
                    closeNavigation()
                }
                // Grows straight up out of the Start button.
                .transition(
                    .scale(scale: 0.25, anchor: .bottomLeading)
                        .combined(with: .opacity)
               )
            }

            HStack(spacing: 10) {
                glassButton(
                    "Start",
                    icon: "line.3.horizontal",
                    active: navExpanded,
                    onLongPress: goHome
               ) {
                    if suppressStartTap { return }
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
                    .init(color: Theme.background.opacity(0), location: 0),
                    .init(color: Theme.background.opacity(navExpanded ? 0.25 : 0.45), location: 0.2),
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
        onLongPress: (() -> Void)? = nil,
        action: @escaping () -> Void
   ) -> some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 20, weight: .medium))
                .foregroundStyle(active ? Theme.accent : Theme.text)
                .frame(width: Theme.controlSize, height: Theme.controlSize)
                .navideckGlass(
                    Circle(),
                    tint: active ? Theme.accent.opacity(0.3) : nil
               )
                .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .simultaneousGesture(
            LongPressGesture(minimumDuration: 0.5)
                .onEnded { _ in
                    guard let onLongPress else { return }
                    UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                    suppressStartTap = true
                    onLongPress()
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
                        suppressStartTap = false
                    }
                }
       )
        .accessibilityLabel(title)
    }

    /// Long press: jump to the Start root from anywhere.
    private func goHome() {
        withAnimation(.easeOut(duration: 0.18)) {
            navExpanded = false
        }
        selection = 0
        paths[0] = NavigationPath()
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
        case 1: MusikCategoryView()
        case 2: PodcastCategoryView()
        case 3: HörbücherCategoryView()
        default: SettingsView()
        }
    }

    /// Only categories with a connected source appear in the menu.
    private var menuItems: [(title: String, icon: String, tab: Int)] {
        var items: [(String, String, Int)] = [("Start", "house", 0)]
        if app.musicAvailable { items.append(("Musik", "music.note", 1)) }
        if app.podcastsAvailable { items.append(("Podcast", "waveform", 2)) }
        if app.audiobooksAvailable { items.append(("Hörbücher", "books.vertical", 3)) }
        items.append(("Optionen", "slider.horizontal.3", 4))
        return items
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
        case .audiobooks:
            AudiobooksView()
        case .podcastLatest:
            PodcastLatestView()
        case .podcastDownloads:
            PodcastDownloadsView()
        case .audiobook(let book):
            AudiobookDetailView(book: book)
        case .audioSeries(let name):
            AudiobookCollectionView(title: name, filter: .series(name))
        case .audioAuthor(let name):
            AudiobookAuthorView(name: name)
        }
    }
}

private struct BottomBarHeightKey: PreferenceKey {
    static let defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = max(value, nextValue())
    }
}
