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

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 26) {
                instantMix

                if let mixError = app.mixError {
                    ErrorBanner(message: mixError)
                        .padding(.horizontal, 20)
                }

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
                if !random.isEmpty {
                    albumSection(
                        "Zufällig",
                        albums: random,
                        actionTitle: "Neu mischen",
                        action: { Task { await loadRandom() } }
                    )
                }
            }
            .padding(.vertical, 12)
        }
        .navigationTitle("Start")
        .navideckScreen()
        .defaultScrollAnchor(demoBottom ? .bottom : .top)
        .task { await load() }
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
