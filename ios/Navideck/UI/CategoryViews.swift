import SwiftUI

/// Horizontal navigation band that sits at the top of every category page.
struct CategoryBand: View {
    struct Item: Identifiable {
        let id: Int
        let title: String
        let icon: String
    }

    let items: [Item]
    @Binding var selection: Int

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(items) { item in
                    Button {
                        withAnimation(.easeOut(duration: 0.18)) {
                            selection = item.id
                        }
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: item.icon)
                                .font(.system(size: 13, weight: .medium))
                            Text(item.title)
                                .font(.subheadline.weight(.medium))
                        }
                        .foregroundStyle(selection == item.id ? Theme.background : Theme.text)
                        .padding(.horizontal, 14)
                        .frame(height: 38)
                        .background(selection == item.id ? Theme.accent : Theme.surface, in: Capsule())
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 10)
        }
    }
}

private let overviewItem = CategoryBand.Item(id: 0, title: "Übersicht", icon: "rectangle.grid.2x2")

// MARK: - Musik

struct MusikCategoryView: View {
    @Environment(AppModel.self) private var app
    @AppStorage("navideck.musik-section") private var section = 0

    @State private var recent: [Album] = []
    @State private var newest: [Album] = []
    @State private var frequent: [Album] = []
    @State private var random: [Album] = []
    @State private var showConfig = false

    private let items: [CategoryBand.Item] = [
        overviewItem,
        .init(id: 1, title: "Alben", icon: "square.stack"),
        .init(id: 2, title: "Künstler", icon: "music.mic"),
        .init(id: 3, title: "Genres", icon: "guitars"),
        .init(id: 4, title: "Playlists", icon: "music.note.list"),
        .init(id: 5, title: "Favoriten", icon: "star"),
        .init(id: 6, title: "Radio", icon: "dot.radiowaves.left.and.right"),
        .init(id: 7, title: "Downloads", icon: "arrow.down.circle"),
    ]

    var body: some View {
        VStack(spacing: 0) {
            CategoryBand(items: items, selection: $section)

            Group {
                switch section {
                case 0: overview
                case 1: AlbumsView(embedded: true)
                case 2: ArtistsView(embedded: true)
                case 3: GenresView(embedded: true)
                case 4: PlaylistsView(embedded: true)
                case 5: FavoritesView(embedded: true)
                case 6: RadioView(embedded: true)
                default: DownloadsView(embedded: true)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .navigationTitle("Musik")
        .navideckScreen()
        .offlineModeToolbar()
        .toolbar {
            if section == 0 {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        showConfig = true
                    } label: {
                        Image(systemName: "wand.and.stars")
                            .foregroundStyle(Theme.text)
                    }
                    .accessibilityLabel("Widgets anpassen")
                }
            }
        }
        .sheet(isPresented: $showConfig) {
            WidgetConfigView(
                title: "Musik-Widgets",
                all: WidgetConfig.musik.all,
                orderKey: WidgetConfig.musik.orderKey,
                hiddenKey: WidgetConfig.musik.hiddenKey
            )
        }
        .task { await loadOverview() }
    }

    private var overview: some View {
        ScrollView {
            MusikWidgetsView(
                config: .musik,
                recent: recent,
                newest: newest,
                frequent: frequent,
                random: random
            )
            .padding(.vertical, 10)

            if recent.isEmpty && newest.isEmpty && frequent.isEmpty && random.isEmpty {
                ProgressView("Bibliothek wird geladen …")
                    .tint(Theme.accent)
                    .foregroundStyle(Theme.muted)
                    .padding(.vertical, 40)
            }
        }
        .refreshable { await loadOverview(force: true) }
    }

    private func loadOverview(force: Bool = false) async {
        guard !app.offlineMode, let client = app.client else {
            apply(app.homeSnapshot)
            return
        }
        if !force, let snapshot = app.homeSnapshot, snapshot.isFresh {
            apply(snapshot)
            return
        }
        guard recent.isEmpty, newest.isEmpty, frequent.isEmpty, random.isEmpty else { return }
        do {
            async let r = client.albumList(.recent, size: 12)
            async let n = client.albumList(.newest, size: 12)
            async let f = client.albumList(.frequent, size: 12)
            async let x = client.albumList(.random, size: 12)
            let result = try await (r, n, f, x)
            let snapshot = HomeSnapshot(newest: result.1, recent: result.0, frequent: result.2, random: result.3)
            app.homeSnapshot = snapshot
            apply(snapshot)
        } catch {
            // Widgets stay empty; the sections below still work.
        }
    }

    private func apply(_ snapshot: HomeSnapshot?) {
        guard let snapshot else { return }
        recent = snapshot.recent
        newest = snapshot.newest
        frequent = snapshot.frequent
        random = snapshot.random
    }
}

// MARK: - Hörbücher

struct HörbücherCategoryView: View {
    @Environment(AppModel.self) private var app
    @AppStorage("navideck.hoerbuch-section") private var section = 0
    @AppStorage("navideck.hoerbuch-sort") private var sortRaw = "added"
    @AppStorage("navideck.hoerbuch-layout") private var layout = "grid"
    @State private var showConfig = false

    private let items: [CategoryBand.Item] = [
        overviewItem,
        .init(id: 1, title: "Weiterhören", icon: "play.circle"),
        .init(id: 2, title: "Alle", icon: "books.vertical"),
        .init(id: 3, title: "Serien", icon: "square.stack"),
        .init(id: 4, title: "Autoren", icon: "person"),
        .init(id: 5, title: "Neu", icon: "sparkles"),
    ]

    private let columns = [
        GridItem(.adaptive(minimum: 150, maximum: 220), spacing: 16, alignment: .top)
    ]

    var body: some View {
        VStack(spacing: 0) {
            CategoryBand(items: items, selection: $section)

            ScrollView {
                if app.offlineMode {
                    EmptyStateView(
                        icon: "books.vertical",
                        title: "Hörbücher nur online",
                        message: "Hörbuch-Downloads folgen in einem späteren Update."
                    )
                    .padding(.top, 30)
                } else if !app.audiobooksAvailable {
                    EmptyStateView(
                        icon: "books.vertical",
                        title: "Keine Hörbuch-Quelle",
                        message: "Ordne in den Einstellungen eine Audiobookshelf-Bibliothek den Hörbüchern zu."
                    )
                    .padding(.top, 30)
                } else {
                    content
                }
            }
            .refreshable { await app.loadAudiobooks(force: true) }
        }
        .navigationTitle("Hörbücher")
        .navideckScreen()
        .offlineModeToolbar()
        .toolbar {
            if section == 0 {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        showConfig = true
                    } label: {
                        Image(systemName: "wand.and.stars")
                            .foregroundStyle(Theme.text)
                    }
                    .accessibilityLabel("Widgets anpassen")
                }
            } else {
                ToolbarItemGroup(placement: .topBarLeading) {
                    Menu {
                        Picker("Sortierung", selection: $sortRaw) {
                            Text("Neu hinzugefügt").tag("added")
                            Text("Titel").tag("title")
                        }
                    } label: {
                        Image(systemName: "arrow.up.arrow.down")
                            .foregroundStyle(Theme.text)
                    }
                    .accessibilityLabel("Sortierung")

                    Button {
                        layout = layout == "grid" ? "list" : "grid"
                    } label: {
                        Image(systemName: layout == "grid" ? "list.bullet" : "square.grid.2x2")
                            .foregroundStyle(Theme.text)
                    }
                    .accessibilityLabel(layout == "grid" ? "Listenansicht" : "Kachelansicht")
                }
            }
        }
        .sheet(isPresented: $showConfig) {
            WidgetConfigView(
                title: "Hörbuch-Widgets",
                all: WidgetConfig.books.all,
                orderKey: WidgetConfig.books.orderKey,
                hiddenKey: WidgetConfig.books.hiddenKey
            )
        }
        .task { await app.loadAudiobooks() }
    }

    @ViewBuilder
    private var content: some View {
        switch section {
        case 0: bookWidgets
        case 1:
            let books = app.audiobooksInProgress
            if books.isEmpty {
                EmptyStateView(
                    icon: "play.circle",
                    title: "Nichts angefangen",
                    message: "Sobald du ein Hörbuch hörst, erscheint es hier."
                )
                .padding(.top, 30)
            } else {
                grid(books)
            }
        case 3:
            chips(values: unique(\.seriesName), icon: "square.stack") { LibraryRoute.audioSeries($0) }
        case 4:
            chips(values: unique(\.authorName), icon: "person") { LibraryRoute.audioAuthor($0) }
        case 5:
            grid(Array(sortedBooks.prefix(18)))
        default:
            grid(sortedBooks)
        }
    }

    @ViewBuilder
    private var bookWidgets: some View {
        VStack(alignment: .leading, spacing: 26) {
            ForEach(WidgetConfig.books.visible(defaults: [])) { entry in
                switch entry.id {
                case "continue":
                    let books = app.audiobooksInProgress
                    if !books.isEmpty {
                        WidgetSection(title: entry.title, icon: entry.icon) {
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
                case "newest":
                    let books = Array(app.absBooks.prefix(12))
                    if !books.isEmpty {
                        WidgetSection(title: entry.title, icon: entry.icon) {
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
                case "series":
                    seriesChips
                case "authors":
                    authorChips
                default:
                    EmptyView()
                }
            }
        }
        .padding(.vertical, 10)
    }

    private var seriesChips: some View {
        let values = unique(\.seriesName)
        return Group {
            if !values.isEmpty {
                WidgetSection(title: "Serien", icon: "square.stack") {
                    chipsRow(values, icon: "square.stack") { LibraryRoute.audioSeries($0) }
                }
            }
        }
    }

    private var authorChips: some View {
        let values = unique(\.authorName)
        return Group {
            if !values.isEmpty {
                WidgetSection(title: "Autoren", icon: "person") {
                    chipsRow(values, icon: "person") { LibraryRoute.audioAuthor($0) }
                }
            }
        }
    }

    private func chipsRow(
        _ values: [String],
        icon: String,
        route: @escaping (String) -> LibraryRoute
    ) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(values, id: \.self) { value in
                    NavigationLink(value: route(value)) {
                        HStack(spacing: 6) {
                            Image(systemName: icon).font(.caption2)
                            Text(value).font(.subheadline.weight(.medium)).lineLimit(1)
                        }
                        .foregroundStyle(Theme.text)
                        .padding(.horizontal, 14)
                        .frame(height: 38)
                        .background(Theme.surface, in: Capsule())
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 20)
        }
    }

    private var sortedBooks: [AbsBook] {
        let books = app.absBooks
        return sortRaw == "title"
            ? books.sorted { $0.media.metadata.title.localizedCaseInsensitiveCompare($1.media.metadata.title) == .orderedAscending }
            : books
    }

    @ViewBuilder
    private func grid(_ books: [AbsBook]) -> some View {
        if layout == "list" {
            VStack(alignment: .leading, spacing: 0) {
                ForEach(Array(books.enumerated()), id: \.element.id) { offset, book in
                    NavigationLink(value: LibraryRoute.audiobook(book)) {
                        HStack(spacing: 12) {
                            CoverArtView(url: app.absCoverURL(book, width: 200), radius: Theme.artworkRadius)
                                .frame(width: Theme.rowArtwork, height: Theme.rowArtwork)
                            VStack(alignment: .leading, spacing: 3) {
                                Text(book.media.metadata.title)
                                    .font(.body.weight(.medium))
                                    .foregroundStyle(Theme.text)
                                    .lineLimit(1)
                                Text(book.media.metadata.authorName ?? " ")
                                    .font(.caption)
                                    .foregroundStyle(Theme.muted)
                                    .lineLimit(1)
                            }
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.caption2.weight(.semibold))
                                .foregroundStyle(Theme.muted.opacity(0.7))
                        }
                        .padding(.horizontal, 20)
                        .padding(.vertical, 6)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)

                    if offset < books.count - 1 {
                        Divider().overlay(Theme.hairline).padding(.leading, 88)
                    }
                }
            }
            .padding(.vertical, 8)
        } else {
            LazyVGrid(columns: columns, spacing: 22) {
                ForEach(books) { book in
                    AudiobookCard(book: book, width: nil)
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 10)
        }
    }

    private func unique(_ key: KeyPath<AbsMetadata, String?>) -> [String] {
        var seen = Set<String>()
        return app.absBooks
            .compactMap { $0.media.metadata[keyPath: key] }
            .filter { !$0.isEmpty && seen.insert($0).inserted }
            .sorted { $0.localizedCaseInsensitiveCompare($1) == .orderedAscending }
    }

    private func chips(
        values: [String],
        icon: String,
        route: @escaping (String) -> LibraryRoute
    ) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            if values.isEmpty {
                EmptyStateView(
                    icon: icon,
                    title: "Nichts vorhanden",
                    message: "Für diese Auswahl gibt es noch keine Einträge."
                )
                .padding(.top, 30)
            } else {
                ForEach(values, id: \.self) { value in
                    NavigationLink(value: route(value)) {
                        HStack(spacing: 12) {
                            Image(systemName: icon)
                                .font(.system(size: 15))
                                .foregroundStyle(Theme.accent)
                                .frame(width: 44, height: 44)
                                .background(Theme.surface, in: RoundedRectangle(cornerRadius: Theme.artworkRadius, style: .continuous))

                            Text(value)
                                .font(.body.weight(.medium))
                                .foregroundStyle(Theme.text)

                            Spacer()

                            Image(systemName: "chevron.right")
                                .font(.caption2.weight(.semibold))
                                .foregroundStyle(Theme.muted.opacity(0.7))
                        }
                        .padding(.horizontal, 20)
                        .padding(.vertical, 6)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(.vertical, 10)
    }
}

// MARK: - Podcasts

struct PodcastCategoryView: View {
    @Environment(AppModel.self) private var app
    @AppStorage("navideck.podcast-section") private var section = 0
    @AppStorage("navideck.podcast-sort") private var sortRaw = "newest"
    @State private var showConfig = false

    private var isABS: Bool { app.podcastBackend == .audiobookshelf }

    private var items: [CategoryBand.Item] {
        isABS
            ? [overviewItem, .init(id: 1, title: "Sender", icon: "waveform")]
            : [
                overviewItem,
                .init(id: 1, title: "Neueste", icon: "sparkles"),
                .init(id: 2, title: "Sender", icon: "waveform"),
            ]
    }

    var body: some View {
        VStack(spacing: 0) {
            CategoryBand(items: items, selection: $section)

            ScrollView {
                if app.offlineMode {
                    EmptyStateView(
                        icon: "waveform",
                        title: "Podcasts nur online",
                        message: "Im Offline-Modus stehen nur heruntergeladene Folgen zur Verfügung."
                    )
                    .padding(.top, 30)
                } else if section == 0 {
                    overview
                } else if isABS {
                    absShows
                } else if section == 1 {
                    subsonicEpisodes
                } else {
                    subsonicChannels
                }
            }
            .refreshable { await reload() }
        }
        .navigationTitle("Podcasts")
        .navideckScreen()
        .offlineModeToolbar()
        .toolbar {
            if section == 0 {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        showConfig = true
                    } label: {
                        Image(systemName: "wand.and.stars")
                            .foregroundStyle(Theme.text)
                    }
                    .accessibilityLabel("Widgets anpassen")
                }
            } else {
                ToolbarItem(placement: .topBarLeading) {
                    Menu {
                        Picker("Sortierung", selection: $sortRaw) {
                            Text("Neueste").tag("newest")
                            Text("Titel").tag("title")
                        }
                    } label: {
                        Image(systemName: "arrow.up.arrow.down")
                            .foregroundStyle(Theme.text)
                    }
                    .accessibilityLabel("Sortierung")
                }
            }
        }
        .sheet(isPresented: $showConfig) {
            WidgetConfigView(
                title: "Podcast-Widgets",
                all: WidgetConfig.podcasts.all,
                orderKey: WidgetConfig.podcasts.orderKey,
                hiddenKey: WidgetConfig.podcasts.hiddenKey
            )
        }
        .task { await reload() }
    }

    private func reload() async {
        if isABS {
            await app.loadPodcasts(force: true)
        } else {
            _ = try? await app.podcasts(force: true)
        }
    }

    @ViewBuilder
    private var overview: some View {
        VStack(alignment: .leading, spacing: 26) {
            ForEach(WidgetConfig.podcasts.visible(defaults: [])) { entry in
                if entry.id == "shows" {
                    let shows = isABS ? Array(app.absPodcasts.prefix(12)) : []
                    if !shows.isEmpty {
                        WidgetSection(title: entry.title, icon: entry.icon) {
                            showsRow(shows)
                        }
                    }
                } else if entry.id == "newest" {
                    if isABS {
                        let shows = Array(app.absPodcasts.prefix(12))
                        if !shows.isEmpty {
                            WidgetSection(title: entry.title, icon: entry.icon) {
                                showsRow(shows)
                            }
                        }
                    } else {
                        let episodes = Array((app.podcastSnapshot?.newest ?? []).prefix(8))
                        if !episodes.isEmpty {
                            WidgetSection(title: entry.title, icon: entry.icon) {
                                episodesRow(episodes)
                            }
                        }
                    }
                }
            }
        }
        .padding(.vertical, 10)
    }

    private func showsRow(_ shows: [AbsBook]) -> some View {
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
                            Text("\(show.media.episodes.count) Folgen")
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

    private func episodesRow(_ episodes: [PodcastEpisode]) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(alignment: .top, spacing: 14) {
                ForEach(episodes) { episode in
                    Button {
                        app.playEpisodes([episode])
                    } label: {
                        VStack(alignment: .leading, spacing: 6) {
                            CoverArtView(url: app.artworkURL(episode.coverArt, size: 300), radius: Theme.artworkRadius)
                                .aspectRatio(1, contentMode: .fit)
                                .frame(width: Theme.cardWidth)
                            Text(episode.title)
                                .font(.body.weight(.semibold))
                                .foregroundStyle(Theme.text)
                                .lineLimit(2)
                                .multilineTextAlignment(.leading)
                            Text(episode.artist ?? " ")
                                .font(.caption)
                                .foregroundStyle(Theme.muted)
                                .lineLimit(1)
                        }
                        .frame(width: Theme.cardWidth, alignment: .leading)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 20)
        }
    }

    private var sortedAbsShows: [AbsBook] {
        app.absPodcasts.sorted {
            sortRaw == "title"
                ? $0.media.metadata.title.localizedCaseInsensitiveCompare($1.media.metadata.title) == .orderedAscending
                : ($0.addedAt ?? 0) > ($1.addedAt ?? 0)
        }
    }

    private var sortedChannels: [PodcastChannel] {
        (app.podcastSnapshot?.channels ?? []).sorted {
            $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending
        }
    }

    private var absShows: some View {
        VStack(alignment: .leading, spacing: 0) {
            if app.absPodcasts.isEmpty {
                EmptyStateView(
                    icon: "waveform",
                    title: "Keine Podcasts",
                    message: "Die zugeordnete Bibliothek enthält keine Podcasts."
                )
                .padding(.top, 30)
            } else {
                ForEach(Array(sortedAbsShows.enumerated()), id: \.element.id) { offset, show in
                    NavigationLink {
                        AbsPodcastShowView(show: show)
                    } label: {
                        HStack(spacing: 12) {
                            CoverArtView(url: app.absCoverURL(show, width: 200), radius: Theme.artworkRadius)
                                .frame(width: Theme.rowArtwork, height: Theme.rowArtwork)

                            VStack(alignment: .leading, spacing: 3) {
                                Text(show.media.metadata.title)
                                    .font(.body.weight(.medium))
                                    .foregroundStyle(Theme.text)
                                    .lineLimit(1)
                                Text("\(show.media.episodes.count) Folgen")
                                    .font(.caption)
                                    .foregroundStyle(Theme.muted)
                            }

                            Spacer(minLength: 8)

                            Image(systemName: "chevron.right")
                                .font(.caption2.weight(.semibold))
                                .foregroundStyle(Theme.muted.opacity(0.7))
                        }
                        .padding(.horizontal, 20)
                        .padding(.vertical, 6)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)

                    if offset < sortedAbsShows.count - 1 {
                        Divider().overlay(Theme.hairline).padding(.leading, 88)
                    }
                }
            }
        }
        .padding(.vertical, 8)
    }

    @ViewBuilder
    private var subsonicEpisodes: some View {
        let episodes = app.podcastSnapshot?.newest ?? []
        VStack(alignment: .leading, spacing: 0) {
            if episodes.isEmpty {
                EmptyStateView(
                    icon: "sparkles",
                    title: "Keine neuen Folgen",
                    message: "Der Server liefert derzeit keine aktuellen Episoden."
                )
                .padding(.top, 30)
            } else {
                ForEach(Array(episodes.enumerated()), id: \.element.playableID) { offset, episode in
                    Button {
                        app.playEpisodes([episode])
                    } label: {
                        HStack(spacing: 12) {
                            CoverArtView(url: app.artworkURL(episode.coverArt, size: 200), radius: Theme.artworkRadius)
                                .frame(width: Theme.rowArtwork, height: Theme.rowArtwork)

                            VStack(alignment: .leading, spacing: 3) {
                                Text(episode.title)
                                    .font(.body.weight(.medium))
                                    .foregroundStyle(Theme.text)
                                    .lineLimit(2)
                                    .multilineTextAlignment(.leading)
                                Text([episode.artist, episode.publishedText]
                                    .compactMap { $0 }
                                    .joined(separator: " · "))
                                    .font(.caption)
                                    .foregroundStyle(Theme.muted)
                                    .lineLimit(1)
                            }

                            Spacer(minLength: 8)

                            Image(systemName: "play.fill")
                                .font(.caption)
                                .foregroundStyle(Theme.muted)
                        }
                        .padding(.horizontal, 20)
                        .padding(.vertical, 6)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)

                    if offset < episodes.count - 1 {
                        Divider().overlay(Theme.hairline).padding(.leading, 88)
                    }
                }
            }
        }
        .padding(.vertical, 8)
    }

    @ViewBuilder
    private var subsonicChannels: some View {
        let channels = sortedChannels
        VStack(alignment: .leading, spacing: 0) {
            if channels.isEmpty {
                EmptyStateView(
                    icon: "waveform",
                    title: "Keine Sender",
                    message: "Der Server meldet keine abonnierten Podcasts."
                )
                .padding(.top, 30)
            } else {
                ForEach(Array(channels.enumerated()), id: \.element.id) { offset, channel in
                    NavigationLink {
                        PodcastChannelView(channel: channel)
                    } label: {
                        HStack(spacing: 12) {
                            CoverArtView(url: app.artworkURL(channel.coverArt, size: 200), radius: Theme.artworkRadius)
                                .frame(width: Theme.rowArtwork, height: Theme.rowArtwork)

                            VStack(alignment: .leading, spacing: 3) {
                                Text(channel.title)
                                    .font(.body.weight(.medium))
                                    .foregroundStyle(Theme.text)
                                    .lineLimit(1)
                                Text("\(channel.episodes.count) Folgen")
                                    .font(.caption)
                                    .foregroundStyle(Theme.muted)
                            }

                            Spacer(minLength: 8)

                            Image(systemName: "chevron.right")
                                .font(.caption2.weight(.semibold))
                                .foregroundStyle(Theme.muted.opacity(0.7))
                        }
                        .padding(.horizontal, 20)
                        .padding(.vertical, 6)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)

                    if offset < channels.count - 1 {
                        Divider().overlay(Theme.hairline).padding(.leading, 88)
                    }
                }
            }
        }
        .padding(.vertical, 8)
    }
}
