import SwiftUI

enum PlaylistSort: String, CaseIterable, Identifiable {
    case name
    case changed
    case count
    case duration

    var id: String { rawValue }

    var label: String {
        switch self {
        case .name: return "Name"
        case .changed: return "Zuletzt geändert"
        case .count: return "Anzahl Titel"
        case .duration: return "Dauer"
        }
    }
}

struct PlaylistsView: View {
    /// Used inside a category shell that already provides the chrome.
    var embedded = false
    @Environment(AppModel.self) private var app

    @State private var playlists: [Playlist] = []
    @State private var loading = false
    @State private var errorMessage: String?
    @State private var sort: PlaylistSort = .name
    @State private var descending = false

    var body: some View {
        let visible = sorted

        return ScrollView {
            LazyVStack(alignment: .leading, spacing: 0) {
                sortBar

                ForEach(Array(shownPlaylists.enumerated()), id: \.element.id) { offset, playlist in
                    PlaylistRow(playlist: playlist)
                        .padding(.horizontal, 20)
                        .padding(.vertical, 6)

                    if offset < visible.count - 1 {
                        Divider().overlay(Theme.hairline).padding(.leading, 84)
                    }
                }
            }
            .padding(.vertical, 8)

            if let errorMessage {
                ErrorBanner(message: errorMessage).padding(.horizontal, 20)
            }

            if loading && playlists.isEmpty {
                ProgressView().tint(Theme.accent).padding(.vertical, 40)
            }

            if playlists.isEmpty && !loading && errorMessage == nil {
                EmptyStateView(
                    icon: "music.note.list",
                    title: "Keine Playlists",
                    message: "Auf diesem Server gibt es noch keine Playlists."
                )
            }
        }
        .navigationTitle(embedded ? "" : "Playlists")
        .navideckScreen()
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                sortMenu
            }
        }
        .task { await load() }
        .refreshable { await load() }
    }

    private var sortBar: some View {
        HStack(spacing: 8) {
            Text("\(playlists.count) Playlists")
                .font(.caption)
                .foregroundStyle(Theme.muted)

            Spacer()

            Button {
                descending.toggle()
            } label: {
                Label(
                    descending ? "Absteigend" : "Aufsteigend",
                    systemImage: descending ? "arrow.down" : "arrow.up"
                )
                .font(.caption.weight(.medium))
                .foregroundStyle(Theme.accent)
                .animation(.easeOut(duration: 0.15), value: descending)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 20)
        .padding(.bottom, 4)
    }

    private var sortMenu: some View {
        Menu {
            Picker("Sortieren nach", selection: $sort) {
                ForEach(PlaylistSort.allCases) { option in
                    Text(option.label).tag(option)
                }
            }
            Divider()
            Button {
                descending.toggle()
            } label: {
                Label(descending ? "Aufsteigend" : "Absteigend",
                      systemImage: descending ? "arrow.up" : "arrow.down")
            }
        } label: {
            Image(systemName: "arrow.up.arrow.down")
                .font(.system(size: 15, weight: .regular))
                .foregroundStyle(Theme.text)
        }
        .accessibilityLabel("Playlists sortieren")
    }

    private var sorted: [Playlist] {
        let result = playlists.sorted { left, right in
            switch sort {
            case .name:
                return left.name.localizedCaseInsensitiveCompare(right.name) == .orderedAscending
            case .changed:
                return (left.changedDate ?? .distantPast) < (right.changedDate ?? .distantPast)
            case .count:
                return (left.songCount ?? 0) < (right.songCount ?? 0)
            case .duration:
                return (left.duration ?? 0) < (right.duration ?? 0)
            }
        }
        return descending ? result.reversed() : result
    }

    private var shownPlaylists: [Playlist] {
        app.offlineMode ? app.downloadedPlaylists : playlists
    }

    private func load() async {
        if app.offlineMode {
            errorMessage = nil
            loading = false
            return
        }
        guard let client = app.client else { return }
        loading = true
        errorMessage = nil
        do {
            playlists = try await client.playlists()
        } catch {
            if !Format.isCancellation(error) {
                errorMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
            }
        }
        loading = false
    }
}

enum PlaylistTrackSort: String, CaseIterable, Identifiable {
    case playlist
    case title
    case artist
    case duration

    var id: String { rawValue }

    var label: String {
        switch self {
        case .playlist: return "Playlist-Reihenfolge"
        case .title: return "Titel"
        case .artist: return "Interpret"
        case .duration: return "Dauer"
        }
    }
}

struct PlaylistDetailView: View {
    @Environment(AppModel.self) private var app

    @State private var playlist: Playlist
    @State private var loading = false
    @State private var errorMessage: String?
    @State private var sort: PlaylistTrackSort = .playlist
    @State private var descending = false

    init(playlist: Playlist) {
        _playlist = State(initialValue: playlist)
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                header
                actions

                if let progress = app.downloads.progressValue(kind: .playlist, sourceID: playlist.id) {
                    DownloadProgressView(progress: progress)
                        .padding(.horizontal, 20)
                }

                if let errorMessage {
                    ErrorBanner(message: errorMessage).padding(.horizontal, 20)
                }

                sortBar

                if loading && playlist.entries.isEmpty {
                    ProgressView().tint(Theme.accent).padding(.vertical, 30)
                } else {
                    trackList
                }
            }
            .padding(.vertical, 16)
        }
        .navigationTitle(playlist.name)
        .navigationBarTitleDisplayMode(.inline)
        .navideckScreen()
        .task {
            await load()
            #if DEBUG
            // SIMCTL_CHILD_NAVIDECK_DEMO_SORT=1 walks through every sort order,
            // which is how duplicate-heavy playlists are checked for crashes.
            if ProcessInfo.processInfo.environment["NAVIDECK_DEMO_SORT"] == "1",
               !playlist.entries.isEmpty {
                for option in PlaylistTrackSort.allCases {
                    sort = option
                    descending.toggle()
                    try? await Task.sleep(nanoseconds: 350_000_000)
                }
            }
            #endif
        }
    }

    private var header: some View {
        VStack(spacing: 12) {
            CoverArtView(url: app.artworkURL(playlist.coverArt, size: 700), maxPixel: 1000)
                .frame(width: 200, height: 200)
                .shadow(color: .black.opacity(0.4), radius: 20, y: 10)

            VStack(spacing: 4) {
                Text(playlist.name)
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(Theme.text)
                    .multilineTextAlignment(.center)

                Text(metaLine)
                    .font(.caption)
                    .foregroundStyle(Theme.muted)
                    .multilineTextAlignment(.center)

                if let comment = playlist.comment, !comment.isEmpty {
                    Text(comment)
                        .font(.caption)
                        .foregroundStyle(Theme.muted.opacity(0.85))
                        .multilineTextAlignment(.center)
                        .padding(.top, 2)
                }
            }
            .padding(.horizontal, 24)
        }
    }

    private var metaLine: String {
        var parts: [String] = []
        let count = playlist.songCount ?? playlist.entries.count
        if count > 0 { parts.append("\(count) Titel") }
        if let duration = Format.longDuration(playlist.duration) { parts.append(duration) }
        return parts.joined(separator: " · ")
    }

    private var actions: some View {
        ZStack {
            HStack(spacing: 6) {
                SquareIconButton(systemName: "shuffle", accessibilityTitle: "Zufällig abspielen") {
                    guard !playlist.entries.isEmpty else { return }
                    if !app.player.shuffleEnabled { app.player.toggleShuffle() }
                    app.player.play(playlist.entries)
                }

                Spacer(minLength: 0)

                downloadButton

                Menu {
                    Button {
                        app.player.addToQueue(playlist.entries)
                    } label: {
                        Label("Alle zur Warteschlange", systemImage: "text.badge.plus")
                    }
                    Button {
                        app.player.playNext(playlist.entries)
                    } label: {
                        Label("Als Nächstes abspielen", systemImage: "text.line.first.and.arrowtriangle.forward")
                    }
                } label: {
                    Image(systemName: "ellipsis")
                        .font(.system(size: 16, weight: .regular))
                        .foregroundStyle(Theme.text)
                        .frame(width: 40, height: 44)
                        .contentShape(Rectangle())
                }
            }

            PlayCircleButton(isPlaying: isPlaying) {
                if isPlaying {
                    app.player.pause()
                } else {
                    app.player.play(orderedEntries)
                }
            }
            .opacity(playlist.entries.isEmpty ? 0.5 : 1)
        }
        .padding(.horizontal, 20)
    }

    @ViewBuilder
    private var downloadButton: some View {
        if app.downloads.item(kind: .playlist, sourceID: playlist.id) != nil {
            SquareIconButton(systemName: "arrow.down.circle.fill", active: true, accessibilityTitle: "Heruntergeladen") {
                if let item = app.downloads.item(kind: .playlist, sourceID: playlist.id) {
                    app.downloads.delete(item)
                }
            }
        } else if app.downloads.isDownloading(kind: .playlist, sourceID: playlist.id) {
            Button {
                app.downloads.cancel(kind: .playlist, sourceID: playlist.id)
            } label: {
                ProgressView()
                    .tint(Theme.accent)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Download abbrechen")
        } else {
            SquareIconButton(systemName: "arrow.down", accessibilityTitle: "Playlist herunterladen") {
                app.download(playlist)
            }
            .disabled(playlist.entries.isEmpty)
        }
    }

    private var sortBar: some View {
        HStack(spacing: 8) {
            Menu {
                Picker("Sortieren nach", selection: $sort) {
                    ForEach(PlaylistTrackSort.allCases) { option in
                        Text(option.label).tag(option)
                    }
                }
            } label: {
                HStack(spacing: 4) {
                    Image(systemName: "arrow.up.arrow.down")
                        .font(.caption)
                    Text(sort.label)
                        .font(.caption.weight(.medium))
                }
                .foregroundStyle(Theme.accent)
            }

            Button {
                descending.toggle()
            } label: {
                Image(systemName: descending ? "arrow.down" : "arrow.up")
                    .font(.caption.weight(.medium))
                    .foregroundStyle(Theme.accent)
                    .animation(.easeOut(duration: 0.15), value: descending)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(descending ? "Absteigend" : "Aufsteigend")

            Spacer()
        }
        .padding(.horizontal, 20)
    }

    private var trackList: some View {
        // Sort once per body, not once per row.
        let entries = orderedEntries

        return LazyVStack(spacing: 0) {
            // Song ids repeat inside playlists, so the position is the identity.
            ForEach(Array(entries.enumerated()), id: \.offset) { offset, song in
                Button {
                    app.player.play(entries, startingAt: offset)
                } label: {
                    TrackRow(
                        song: song,
                        number: offset + 1,
                        isCurrent: app.player.current?.id == song.id,
                        subtitle: [song.artist, song.album].compactMap { $0 }.joined(separator: " · "),
                        downloaded: app.downloads.contains(songID: song.id),
                        progress: app.downloads.songProgress[song.id]
                    )
                    .padding(.horizontal, 20)
                    .padding(.vertical, 6)
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
                    Button {
                        toggleStar(song: song)
                    } label: {
                        Label(
                            song.starred == nil ? "Zu Favoriten" : "Aus Favoriten",
                            systemImage: "star"
                        )
                    }
                }

                if offset < entries.count - 1 {
                    Divider()
                        .overlay(Theme.hairline)
                        .padding(.leading, 56)
                        .padding(.trailing, 20)
                }
            }
        }
    }

    private var orderedEntries: [Song] {
        guard sort != .playlist else {
            return descending ? playlist.entries.reversed() : playlist.entries
        }
        let result = playlist.entries.sorted { left, right in
            switch sort {
            case .playlist:
                return false
            case .title:
                return left.title.localizedCaseInsensitiveCompare(right.title) == .orderedAscending
            case .artist:
                return (left.artist ?? "").localizedCaseInsensitiveCompare(right.artist ?? "") == .orderedAscending
            case .duration:
                return (left.duration ?? 0) < (right.duration ?? 0)
            }
        }
        return descending ? result.reversed() : result
    }

    private var isPlaying: Bool {
        guard let current = app.player.current else { return false }
        return app.player.isPlaying && playlist.entries.contains { $0.id == current.id }
    }

    /// Song favourites also work from playlist rows.
    private func toggleStar(song: Song) {
        guard let client = app.client,
              let index = playlist.entries.firstIndex(where: { $0.id == song.id }) else { return }
        let willStar = song.starred == nil
        playlist.entries[index].starred = willStar ? ISO8601DateFormatter().string(from: Date()) : nil
        Task {
            do {
                if willStar {
                    try await client.star(id: song.id)
                } else {
                    try await client.unstar(id: song.id)
                }
                app.favoritesRevision += 1
            } catch {
                if let idx = playlist.entries.firstIndex(where: { $0.id == song.id }) {
                    playlist.entries[idx].starred = willStar ? nil : song.starred
                }
                errorMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
            }
        }
    }

    private func load() async {
        guard !app.offlineMode, let client = app.client, playlist.entries.isEmpty else { return }
        loading = true
        do {
            playlist = try await client.playlist(id: playlist.id)
        } catch {
            if !Format.isCancellation(error) {
                errorMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
            }
        }
        loading = false
    }
}
