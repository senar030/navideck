import SwiftUI

/// Full-screen live search. Opens from the Suche button (and the Suche entry
/// in the expanded navigation) and shows results while typing.
struct SearchOverlay: View {
    @Environment(AppModel.self) private var app
    var onClose: () -> Void

    @State private var query = ""
    @State private var results = SearchResult()
    @State private var loading = false
    @State private var searched = false
    @State private var errorMessage: String?
    @State private var recent: [String] = []
    @State private var expanded: Set<String> = []

    @FocusState private var focused: Bool

    private var trimmed: String {
        query.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var body: some View {
        ZStack(alignment: .top) {
            Rectangle()
                .fill(.ultraThinMaterial)
                .overlay(Theme.background.opacity(0.55))
                .ignoresSafeArea()
                .onTapGesture { focused = false }

            VStack(spacing: 0) {
                searchField
                    .padding(.horizontal, 16)
                    .padding(.top, 8)
                    .padding(.bottom, 10)

                if loading {
                    ProgressView()
                        .tint(Theme.accent)
                        .scaleEffect(0.7)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 24)
                        .padding(.bottom, 4)
                } else {
                    Color.clear.frame(height: 4)
                }

                ScrollView {
                    content
                        .padding(.bottom, 40)
                }
                .scrollDismissesKeyboard(.interactively)
            }
        }
        .task {
            recent = RecentSearches.load()
            #if DEBUG
            if let demo = ProcessInfo.processInfo.environment["NAVIDECK_DEMO_QUERY"],
               !demo.isEmpty, query.isEmpty {
                query = demo
            }
            #endif
            try? await Task.sleep(nanoseconds: 180_000_000)
            focused = true
        }
        .task(id: query) { await scheduleSearch() }
        .onChange(of: query) { _, _ in
            expanded = []
            errorMessage = nil
        }
    }

    // MARK: - Field

    private var searchField: some View {
        HStack(spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(Theme.muted)

                TextField("Titel, Alben, Interpreten", text: $query)
                    .focused($focused)
                    .font(.subheadline)
                    .foregroundStyle(Theme.text)
                    .tint(Theme.accent)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .submitLabel(.search)
                    .onSubmit {
                        remember(trimmed)
                        focused = false
                    }

                if !query.isEmpty {
                    Button {
                        query = ""
                        focused = true
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 15))
                            .foregroundStyle(Theme.muted)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Eingabe löschen")
                }
            }
            .padding(.horizontal, 14)
            .frame(height: 44)
            .navideckGlass(Capsule())

            Button(action: onClose) {
                Image(systemName: "xmark")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.text)
                    .frame(width: 44, height: 44)
                    .navideckGlass(Circle())
                    .contentShape(Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Suche schließen")
        }
    }

    // MARK: - Content

    @ViewBuilder
    private var content: some View {
        if let errorMessage {
            ErrorBanner(message: errorMessage)
                .padding(.horizontal, 20)
                .padding(.top, 8)
        }

        if trimmed.isEmpty {
            recentSearches
        } else if searched && results.isEmpty && !loading {
            EmptyStateView(
                icon: "magnifyingglass",
                title: "Nichts gefunden",
                message: "Kein Treffer für „\(trimmed)“."
            )
            .padding(.top, 40)
        } else {
            resultList
        }
    }

    private var recentSearches: some View {
        VStack(alignment: .leading, spacing: 14) {
            if recent.isEmpty {
                EmptyStateView(
                    icon: "sparkle.magnifyingglass",
                    title: "Live suchen",
                    message: "Titel, Alben und Interpreten erscheinen schon beim Tippen."
                )
                .padding(.top, 40)
            } else {
                HStack {
                    Text("Zuletzt gesucht")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(Theme.muted)
                    Spacer()
                    Button("Löschen") {
                        RecentSearches.clear()
                        recent = []
                    }
                    .font(.caption.weight(.medium))
                    .foregroundStyle(Theme.muted)
                }
                .padding(.horizontal, 20)

                FlowLayout(spacing: 8) {
                    ForEach(recent, id: \.self) { term in
                        Button {
                            query = term
                            remember(term)
                        } label: {
                            HStack(spacing: 5) {
                                Image(systemName: "clock")
                                    .font(.caption2)
                                Text(term)
                                    .font(.caption.weight(.medium))
                            }
                            .foregroundStyle(Theme.text)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 7)
                            .navideckGlass(Capsule())
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 20)
            }
        }
        .padding(.top, 8)
    }

    @ViewBuilder
    private var resultList: some View {
        if !searched && loading {
            Color.clear.frame(height: 1)
        } else {
            VStack(alignment: .leading, spacing: 20) {
                if !results.songs.isEmpty {
                    section("Titel", count: results.songs.count, key: "songs") {
                        let limit = expanded.contains("songs") ? results.songs.count : min(8, results.songs.count)
                        ForEach(Array(results.songs.prefix(limit).enumerated()), id: \.element.id) { offset, song in
                            songRow(song) {
                                remember(trimmed)
                                app.player.play(results.songs, startingAt: offset)
                                onClose()
                            }
                        }
                    }
                }

                if !results.albums.isEmpty {
                    section("Alben", count: results.albums.count, key: "albums") {
                        let limit = expanded.contains("albums") ? results.albums.count : min(6, results.albums.count)
                        ForEach(results.albums.prefix(limit)) { album in
                            Button {
                                remember(trimmed)
                                open(.album(album))
                            } label: {
                                AlbumRowContent(album: album)
                                    .padding(.horizontal, 20)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }

                if !results.artists.isEmpty {
                    section("Interpreten", count: results.artists.count, key: "artists") {
                        let limit = expanded.contains("artists") ? results.artists.count : min(6, results.artists.count)
                        ForEach(results.artists.prefix(limit)) { artist in
                            Button {
                                remember(trimmed)
                                open(.artist(artist))
                            } label: {
                                artistRow(artist)
                                    .padding(.horizontal, 20)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
            .padding(.top, 8)
        }
    }

    private func section<Content: View>(
        _ title: String,
        count: Int,
        key: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .firstTextBaseline) {
                Text(title)
                    .font(.headline.weight(.semibold))
                    .foregroundStyle(Theme.text)
                Text("\(count)")
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(Theme.muted)
                Spacer()
                if count > (key == "songs" ? 8 : 6) {
                    Button(expanded.contains(key) ? "Weniger" : "Alle") {
                        if expanded.contains(key) {
                            expanded.remove(key)
                        } else {
                            expanded.insert(key)
                        }
                    }
                    .font(.caption.weight(.medium))
                    .foregroundStyle(Theme.accent)
                }
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 2)

            content()
        }
    }

    private func songRow(_ song: Song, play: @escaping () -> Void) -> some View {
        let isCurrent = app.player.current?.id == song.id

        return Button(action: play) {
            HStack(spacing: 12) {
                CoverArtView(url: app.artworkURL(song.coverArt, size: 160))
                    .frame(width: 44, height: 44)

                VStack(alignment: .leading, spacing: 2) {
                    Text(song.title)
                        .font(.subheadline.weight(isCurrent ? .semibold : .regular))
                        .foregroundStyle(isCurrent ? Theme.accent : Theme.text)
                        .lineLimit(1)
                    Text([song.artist, song.album]
                        .compactMap { $0 }
                        .joined(separator: " · "))
                        .font(.caption2)
                        .foregroundStyle(Theme.muted)
                        .lineLimit(1)
                }

                Spacer(minLength: 8)

                if isCurrent && app.player.isPlaying {
                    Image(systemName: "waveform")
                        .font(.caption)
                        .foregroundStyle(Theme.accent)
                } else {
                    Text(song.durationText)
                        .font(.caption2.monospacedDigit())
                        .foregroundStyle(Theme.muted)
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 5)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .contextMenu {
            Button {
                app.player.playNext([song])
            } label: {
                Label("Als Nächstes", systemImage: "text.line.first.and.arrowtriangle.forward")
            }
            Button {
                app.player.addToQueue([song])
            } label: {
                Label("Zur Warteschlange", systemImage: "text.badge.plus")
            }
            Button {
                app.download(song, from: song.album, artist: song.artist)
            } label: {
                Label("Titel herunterladen", systemImage: "arrow.down")
            }
        }
    }

    private func artistRow(_ artist: Artist) -> some View {
        HStack(spacing: 12) {
            CoverArtView(url: app.artworkURL(artist.coverArt, size: 120))
                .frame(width: 44, height: 44)

            VStack(alignment: .leading, spacing: 2) {
                Text(artist.name)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Theme.text)
                    .lineLimit(1)
                if let count = artist.albumCount {
                    Text("\(count) \(count == 1 ? "Album" : "Alben")")
                        .font(.caption2)
                        .foregroundStyle(Theme.muted)
                }
            }

            Spacer(minLength: 8)

            Image(systemName: "chevron.right")
                .font(.caption2.weight(.semibold))
                .foregroundStyle(Theme.muted.opacity(0.7))
        }
        .padding(.vertical, 5)
        .contentShape(Rectangle())
    }

    // MARK: - Actions and data

    private func open(_ route: LibraryRoute) {
        focused = false
        onClose()
        app.pendingRoute = route
    }

    private func remember(_ term: String) {
        let value = term.trimmingCharacters(in: .whitespacesAndNewlines)
        guard value.count >= 2 else { return }
        RecentSearches.add(value)
        recent = RecentSearches.load()
    }

    private func scheduleSearch() async {
        guard trimmed.count >= 1 else {
            results = SearchResult()
            searched = false
            loading = false
            return
        }

        do {
            try await Task.sleep(nanoseconds: 220_000_000)
        } catch {
            return
        }
        guard !Task.isCancelled else { return }
        await run(trimmed)
    }

    private func run(_ text: String) async {
        guard let client = app.client else { return }
        loading = true
        do {
            let found = try await client.search(text)
            guard !Task.isCancelled else { return }
            results = found
            searched = true
            errorMessage = nil
        } catch {
            guard !Task.isCancelled else { return }
            errorMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
            results = SearchResult()
            searched = true
        }
        loading = false
    }
}

// MARK: - Recent searches

enum RecentSearches {
    private static let key = "navideck.recent-searches"

    static func load() -> [String] {
        UserDefaults.standard.stringArray(forKey: key) ?? []
    }

    static func add(_ term: String) {
        var list = load()
        list.removeAll { $0.caseInsensitiveCompare(term) == .orderedSame }
        list.insert(term, at: 0)
        UserDefaults.standard.set(Array(list.prefix(8)), forKey: key)
    }

    static func clear() {
        UserDefaults.standard.removeObject(forKey: key)
    }
}

// MARK: - Wrapping chips

/// Small wrapping layout for the recent search chips.
struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        var x: CGFloat = 0
        var y: CGFloat = 0
        var lineHeight: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x > 0, x + size.width > maxWidth {
                x = 0
                y += lineHeight + spacing
                lineHeight = 0
            }
            x += size.width + spacing
            lineHeight = max(lineHeight, size.height)
        }

        return CGSize(width: maxWidth == .infinity ? x : maxWidth, height: y + lineHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX
        var y = bounds.minY
        var lineHeight: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x > bounds.minX, x + size.width > bounds.maxX {
                x = bounds.minX
                y += lineHeight + spacing
                lineHeight = 0
            }
            subview.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            lineHeight = max(lineHeight, size.height)
        }
    }
}
