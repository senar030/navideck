import SwiftUI

/// The four rows of the start screen. Loading them in one task group lets each
/// section appear as soon as its request is done.
private enum HomeRow: CaseIterable {
    case recent
    case newest
    case frequent
    case random

    var listType: AlbumListType {
        switch self {
        case .recent: return .recent
        case .newest: return .newest
        case .frequent: return .frequent
        case .random: return .random
        }
    }
}

struct HomeView: View {
    @Environment(AppModel.self) private var app

    @State private var newest: [Album] = []
    @State private var recent: [Album] = []
    @State private var frequent: [Album] = []
    @State private var random: [Album] = []
    @State private var loading = false
    @State private var errorMessage: String?
    @State private var showWidgetSettings = false
    @AppStorage("navideck.home-widgets") private var widgetOrderRaw = ""
    @AppStorage("navideck.home-widgets-hidden") private var widgetHiddenRaw = ""

    var body: some View {
        library
            .navigationTitle("Start")
            .offlineModeToolbar()
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        showWidgetSettings = true
                    } label: {
                        Image(systemName: "wand.and.stars")
                            .foregroundStyle(Theme.text)
                    }
                    .accessibilityLabel("Start anpassen")
                }
            }
            .sheet(isPresented: $showWidgetSettings) {
                HomeWidgetSettingsView()
            }
            .task {
                await load()
                if app.audiobooksAvailable { await app.loadAudiobooks() }
                if app.podcastBackend == .audiobookshelf { await app.loadPodcasts() }
            }
    }

    private var library: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 26) {
                if app.offlineMode {
                    HStack(spacing: 8) {
                        Image(systemName: "arrow.down.circle.fill")
                            .font(.system(size: 14))
                            .foregroundStyle(Theme.accent)
                        Text("Offline-Modus — nur Downloads")
                            .font(.caption.weight(.medium))
                            .foregroundStyle(Theme.muted)
                    }
                    .padding(.horizontal, 20)
                }

                instantMix

                if let mixError = app.mixError {
                    ErrorBanner(message: mixError)
                        .padding(.horizontal, 20)
                }

                if app.offlineMode && !app.hasDownloads {
                    EmptyStateView(
                        icon: "arrow.down.circle",
                        title: "Nichts heruntergeladen",
                        message: "Im Offline-Modus siehst du nur Inhalte, die auf dem Gerät liegen. Lade Alben, Playlists oder Interpreten herunter."
                    )
                }

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

                ForEach(visibleWidgets) { widget in
                    widgetView(widget)
                }
            }
            .padding(.vertical, 12)
        }
        .navideckScreen()
        .defaultScrollAnchor(demoBottom ? .bottom : .top)
        .refreshable { await load(force: true) }
    }

    /// Simulator helper: start a screen already scrolled to the bottom so the
    /// floating bar can be checked for covering content.
    private var demoBottom: Bool {
        #if DEBUG
        ProcessInfo.processInfo.environment["NAVIDECK_DEMO_BOTTOM"] == "1"
        #else
        false
        #endif
    }

    // MARK: - Instant mix

    private var instantMix: some View {
        Button {
            Task { await app.startInstantMix() }
        } label: {
            HStack(spacing: 14) {
                ZStack {
                    Rectangle()
                        .stroke(Theme.accent.opacity(0.55), lineWidth: 1)
                        .frame(width: 46, height: 46)
                    if app.mixLoading {
                        ProgressView()
                            .tint(Theme.accent)
                    } else {
                        Image(systemName: "shuffle")
                            .font(.system(size: 18, weight: .medium))
                            .foregroundStyle(Theme.accent)
                    }
                }

                VStack(alignment: .leading, spacing: 3) {
                    Text(app.mixLoading ? "Mix wird erstellt …" : "Sofortmix")
                        .font(.headline.weight(.semibold))
                        .foregroundStyle(Theme.text)
                    Text("\(app.prefs.mixSize) zufällige Titel aus deiner Bibliothek")
                        .font(.caption)
                        .foregroundStyle(Theme.muted)
                }

                Spacer(minLength: 8)

                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Theme.muted.opacity(0.7))
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .background(Theme.backgroundLift)
            .overlay {
                Rectangle().stroke(Theme.hairline, lineWidth: 0.5)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(app.mixLoading)
        .padding(.horizontal, 20)
        .accessibilityLabel("Sofortmix starten")
    }

    // MARK: - Shortcuts

    private var shortcuts: some View {
        VStack(spacing: 10) {
            HStack(spacing: 10) {
                shortcut("Favoriten", icon: "star", route: .favorites)
                shortcut("Playlists", icon: "music.note.list", route: .playlists)
                shortcut("Genres", icon: "guitars", route: .genres)
            }
            HStack(spacing: 10) {
                shortcut("Alben", icon: "square.stack", route: .albums)
                shortcut("Radio", icon: "dot.radiowaves.left.and.right", route: .radio)
                shortcut("Downloads", icon: "arrow.down", route: .downloads)
            }
        }
        .padding(.horizontal, 20)
    }

    private func shortcut(_ title: String, icon: String, route: LibraryRoute) -> some View {
        NavigationLink(value: route) {
            VStack(alignment: .leading, spacing: 8) {
                Image(systemName: icon)
                    .font(.system(size: 16, weight: .regular))
                    .foregroundStyle(Theme.accent)
                Text(title)
                    .font(.footnote.weight(.medium))
                    .foregroundStyle(Theme.text)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(12)
            .background(Theme.surface)
            .overlay {
                Rectangle().stroke(Theme.hairline, lineWidth: 0.5)
            }
        }
        .buttonStyle(.plain)
    }

    // MARK: - Widgets

    private var widgetOrder: [HomeWidget] {
        let stored = widgetOrderRaw.split(separator: ",").compactMap { HomeWidget(rawValue: String($0)) }
        let missing = HomeWidget.defaultOrder.filter { !stored.contains($0) }
        return stored + missing
    }

    private var hiddenWidgets: Set<HomeWidget> {
        Set(widgetHiddenRaw.split(separator: ",").compactMap { HomeWidget(rawValue: String($0)) })
    }

    private var visibleWidgets: [HomeWidget] {
        widgetOrder.filter { !hiddenWidgets.contains($0) }
    }

    @ViewBuilder
    private func widgetView(_ widget: HomeWidget) -> some View {
        // Offline only music downloads exist; hide the network widgets.
        if app.offlineMode {
            switch widget {
            case .shortcuts:
                WidgetSection(title: widget.title, icon: widget.icon) {
                    QuickAccessBand()
                }
            case .downloads:
                let albums = app.downloadedAlbums
                if !albums.isEmpty {
                    WidgetSection(title: widget.title, icon: widget.icon) {
                        albumRow(albums)
                    }
                }
            default:
                EmptyView()
            }
        } else {
        switch widget {
        case .shortcuts:
            WidgetSection(title: widget.title, icon: widget.icon) {
                QuickAccessBand()
            }

        case .musicRecent:
            if !recent.isEmpty {
                WidgetSection(title: widget.title, icon: widget.icon) {
                    albumRow(recent)
                }
            }
        case .musicNewest:
            if !newest.isEmpty {
                WidgetSection(title: widget.title, icon: widget.icon) {
                    albumRow(newest)
                }
            }
        case .musicFrequent:
            if !frequent.isEmpty {
                WidgetSection(title: widget.title, icon: widget.icon) {
                    albumRow(frequent)
                }
            }
        case .musicRandom:
            if !random.isEmpty {
                WidgetSection(title: widget.title, icon: widget.icon) {
                    albumRow(random)
                }
            }
        case .audiobooksContinue:
            let books = app.audiobooksInProgress
            if !books.isEmpty {
                WidgetSection(title: widget.title, icon: widget.icon) {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(alignment: .top, spacing: 14) {
                            ForEach(books) { book in
                                AudiobookCard(book: book, width: Theme.cardWidth, showsProgress: true)
                            }
                        }
                        .padding(.horizontal, 20)
                    }
                }
            }
        case .audiobooksNewest:
            let books = Array(app.absBooks.prefix(12))
            if !books.isEmpty {
                WidgetSection(title: widget.title, icon: widget.icon) {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(alignment: .top, spacing: 14) {
                            ForEach(books) { book in
                                AudiobookCard(book: book, width: Theme.cardWidth)
                            }
                        }
                        .padding(.horizontal, 20)
                    }
                }
            }
        case .podcastsNewest:
            let shows = Array(app.absPodcasts.prefix(12))
            if !shows.isEmpty {
                WidgetSection(title: widget.title, icon: widget.icon) {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(alignment: .top, spacing: 14) {
                            ForEach(shows) { show in
                                NavigationLink {
                                    AbsPodcastShowView(show: show)
                                } label: {
                                    VStack(alignment: .leading, spacing: 6) {
                                        CoverArtView(url: app.absCoverURL(show, width: 300), radius: Theme.artworkRadius)
                                            .aspectRatio(1, contentMode: .fit)
                                            .frame(width: Theme.cardWidth)
                                        Text(show.media.metadata.title)
                                            .font(.body.weight(.semibold))
                                            .foregroundStyle(Theme.text)
                                            .lineLimit(2)
                                        Text("\(app.episodeCount(show)) Folgen")
                                            .font(.caption)
                                            .foregroundStyle(Theme.muted)
                                    }
                                    .frame(width: Theme.cardWidth, alignment: .leading)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.horizontal, 20)
                    }
                }
            }
        case .downloads:
            let albums = app.downloadedAlbums
            if !albums.isEmpty {
                WidgetSection(title: widget.title, icon: widget.icon) {
                    albumRow(albums)
                }
            }
        }
        }
    }

    private func albumRow(_ albums: [Album]) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            LazyHStack(alignment: .top, spacing: 14) {
                ForEach(albums) { album in
                    AlbumCard(album: album)
                        .frame(width: Theme.cardWidth)
                }
            }
            .padding(.horizontal, 20)
        }
    }

    // MARK: - Album rows

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

    // MARK: - Loading

    private func load(force: Bool = false) async {
        errorMessage = nil
        if app.offlineMode {
            let downloaded = app.downloadedAlbums
            let ids = Set(downloaded.map(\.id))
            var snapshot = HomeSnapshot(newest: [], recent: [], frequent: [], random: [])
            if let cached = app.homeSnapshot {
                snapshot = HomeSnapshot(
                    newest: cached.newest.filter { ids.contains($0.id) },
                    recent: cached.recent.filter { ids.contains($0.id) },
                    frequent: cached.frequent.filter { ids.contains($0.id) },
                    random: cached.random.filter { ids.contains($0.id) }
                )
            }
            // A fresh offline start has no cached rows; show the downloads then.
            if snapshot.newest.isEmpty, snapshot.recent.isEmpty,
               snapshot.frequent.isEmpty, snapshot.random.isEmpty {
                snapshot.newest = downloaded
            }
            apply(snapshot)
            return
        }
        if !force, let snapshot = app.homeSnapshot, snapshot.isFresh {
            apply(snapshot)
            return
        }
        guard let client = app.client else { return }
        loading = true
        errorMessage = nil
        do {
            // Each row appears as soon as its request returns instead of the
            // screen waiting for the slowest of four.
            var snapshot = HomeSnapshot(newest: [], recent: [], frequent: [], random: [])
            try await withThrowingTaskGroup(of: (HomeRow, [Album]).self) { group in
                for row in HomeRow.allCases {
                    group.addTask {
                        (row, try await client.albumList(row.listType, size: 12))
                    }
                }
                for try await (row, albums) in group {
                    switch row {
                    case .recent: snapshot.recent = albums
                    case .newest: snapshot.newest = albums
                    case .frequent: snapshot.frequent = albums
                    case .random: snapshot.random = albums
                    }
                    apply(snapshot)
                }
            }
            app.homeSnapshot = snapshot
            await prefetch(snapshot)
        } catch is CancellationError {
            // Pull-to-refresh can cancel the previous request; not an error.
        } catch let error as URLError where error.code == .cancelled {
        } catch {
            errorMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
        loading = false
    }

    private func apply(_ snapshot: HomeSnapshot) {
        newest = snapshot.newest
        recent = snapshot.recent
        frequent = snapshot.frequent
        random = snapshot.random
        loading = false
    }

    /// Warms the artwork cache so the rows do not flash in one by one.
    private func prefetch(_ snapshot: HomeSnapshot) async {
        let albums = snapshot.recent + snapshot.newest + snapshot.frequent + snapshot.random
        let urls = albums.prefix(16).compactMap { app.artworkURL($0.coverArt) }
        await ImageStore.shared.prefetch(urls, limit: 16)
    }

    private func loadRandom() async {
        guard let client = app.client else { return }
        if let albums = try? await client.albumList(.random, size: 12) {
            random = albums
            if var snapshot = app.homeSnapshot {
                snapshot.random = albums
                snapshot.loadedAt = Date()
                app.homeSnapshot = snapshot
            }
        }
    }
}
