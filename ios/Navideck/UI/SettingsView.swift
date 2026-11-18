import SwiftUI

struct SettingsView: View {
    @Environment(AppModel.self) private var app

    @State private var renameCandidate: ServerProfile?
    @State private var renameText = ""
    @State private var showAddConnection = false
    @State private var refreshingLibraries = false
    @State private var removeCandidate: ServerProfile?
    @State private var showDeleteDownloads = false

    var body: some View {
        @Bindable var prefs = app.prefs

        Form {
            connectionsSection
            sourcesSection

            Section("Sofortmix") {
                Stepper(value: $prefs.mixSize, in: 5...200, step: 5) {
                    HStack {
                        Text("Titel pro Mix")
                        Spacer()
                        Text("\(prefs.mixSize)")
                            .foregroundStyle(Theme.muted)
                            .monospacedDigit()
                    }
                }
                .listRowBackground(Theme.surface)

                NavigationLink {
                    GenreExclusionView()
                } label: {
                    HStack {
                        Text("Genres ausschließen")
                        Spacer()
                        Text(prefs.excludedGenres.isEmpty
                             ? "Keine"
                             : "\(prefs.excludedGenres.count)")
                            .foregroundStyle(Theme.muted)
                    }
                }
                .listRowBackground(Theme.surface)
            }

            Section("Streaming") {
                Picker("Qualität", selection: $prefs.maxBitRate) {
                    ForEach(StreamQuality.allCases) { quality in
                        Text(quality.label).tag(quality.rawValue)
                    }
                }
                .listRowBackground(Theme.surface)
            }

            downloadsSection
            playbackSection
            aboutSection
        }
        .scrollContentBackground(.hidden)
        .background(Theme.background.ignoresSafeArea())
        .navigationTitle("Einstellungen")
        .sheet(isPresented: $showAddConnection) {
            AddConnectionView()
        }
        .onChange(of: showAddConnection) { _, open in
            if !open {
                Task { await app.refreshLibraries() }
            }
        }
        .alert(
            "Verbindung umbenennen",
            isPresented: Binding(
                get: { renameCandidate != nil },
                set: { if !$0 { renameCandidate = nil } }
            )
        ) {
            TextField("Name", text: $renameText)
            Button("Speichern") {
                if let profile = renameCandidate {
                    app.servers.rename(profile, to: renameText)
                }
                renameCandidate = nil
            }
            Button("Abbrechen", role: .cancel) { renameCandidate = nil }
        } message: {
            Text("Der Name erscheint bei den Verbindungen und in der Quellenauswahl.")
        }
        .confirmationDialog(
            "Verbindung entfernen?",
            isPresented: Binding(
                get: { removeCandidate != nil },
                set: { if !$0 { removeCandidate = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("Entfernen", role: .destructive) {
                if let profile = removeCandidate {
                    app.remove(profile: profile)
                    Task { await app.refreshLibraries() }
                }
                removeCandidate = nil
            }
            Button("Abbrechen", role: .cancel) { removeCandidate = nil }
        } message: {
            Text("Zugangsdaten dieses Servers werden vom Gerät gelöscht.")
        }
        .confirmationDialog(
            "Alle Downloads löschen?",
            isPresented: $showDeleteDownloads,
            titleVisibility: .visible
        ) {
            Button("Löschen", role: .destructive) {
                app.downloads.deleteEverything()
            }
            Button("Abbrechen", role: .cancel) {}
        } message: {
            Text("Heruntergeladene Titel und Cover werden vom Gerät entfernt.")
        }
        .task {
            if app.libraries.isEmpty {
                await app.refreshLibraries()
            }
        }
    }

    // MARK: - Verbindungen

    private var connectionsSection: some View {
        Section {
            ForEach(app.servers.profiles) { profile in
                Button {
                    activate(profile)
                } label: {
                    HStack(spacing: 12) {
                        Image(systemName: profile.kind == .audiobookshelf ? "books.vertical" : "music.note.house")
                            .font(.system(size: 15, weight: .regular))
                            .foregroundStyle(Theme.accent)
                            .frame(width: 24)

                        VStack(alignment: .leading, spacing: 2) {
                            Text(profile.displayName)
                                .foregroundStyle(Theme.text)
                                .lineLimit(1)
                            Text("\(profile.flavor.label) · \(profile.baseURL)")
                                .font(.caption2)
                                .foregroundStyle(Theme.muted)
                                .lineLimit(1)
                        }

                        Spacer(minLength: 8)

                        if isActive(profile) {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundStyle(Theme.accent)
                        }
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .listRowBackground(Theme.surface)
                .contextMenu {
                    Button {
                        renameCandidate = profile
                        renameText = profile.name
                    } label: {
                        Label("Umbenennen", systemImage: "pencil")
                    }
                    Button(role: .destructive) {
                        removeCandidate = profile
                    } label: {
                        Label("Entfernen", systemImage: "trash")
                    }
                }
                .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                    Button(role: .destructive) {
                        removeCandidate = profile
                    } label: {
                        Label("Entfernen", systemImage: "trash")
                    }
                }
            }

            Button {
                showAddConnection = true
            } label: {
                Label("Verbindung hinzufügen", systemImage: "plus")
                    .foregroundStyle(Theme.accent)
            }
            .listRowBackground(Theme.surface)

            if !app.servers.profiles.isEmpty {
                Button {
                    refreshingLibraries = true
                    Task {
                        await app.refreshLibraries()
                        refreshingLibraries = false
                    }
                } label: {
                    HStack {
                        Label("Bibliotheken aktualisieren", systemImage: "arrow.clockwise")
                            .foregroundStyle(Theme.accent)
                        Spacer()
                        if refreshingLibraries {
                            ProgressView().tint(Theme.accent)
                        }
                    }
                }
                .disabled(refreshingLibraries)
                .listRowBackground(Theme.surface)
            }
        } header: {
            Text("Verbindungen")
        } footer: {
            Text("Navidrome/Subsonic und Audiobookshelf laufen parallel. Nach dem Hinzufügen werden die Bibliotheken eingelesen und können unten den Kategorien zugeordnet werden.")
            Text("DEBUG src=\(app.sourceValue(for: .music)) folder=\(app.selectedMusicFolderID ?? "-") libs=\(app.libraries.count)")
                .font(.caption2)
        }
    }

    private func isActive(_ profile: ServerProfile) -> Bool {
        profile.kind == .audiobookshelf
            ? app.servers.absID == profile.id
            : app.servers.activeID == profile.id
    }

    private func activate(_ profile: ServerProfile) {
        switch profile.kind {
        case .subsonic: app.activate(profile)
        case .audiobookshelf: app.activateAudiobookshelf(profile)
        }
    }

    // MARK: - Quellen

    private var sourcesSection: some View {
        Section {
            sourceRow("Musik", category: .music)
            sourceRow("Podcasts", category: .podcasts)
            sourceRow("Hörbücher", category: .audiobooks)
        } header: {
            Text("Quellen")
        } footer: {
            Text("Jede Kategorie nutzt genau eine Bibliothek. „Automatisch“ nimmt die erste passende Bibliothek einer verbundenen Quelle, „Aus“ blendet die Kategorie aus.")
        }
    }

    @ViewBuilder
    private func sourceRow(_ title: String, category: AppModel.Category) -> some View {
        let options = app.libraries(for: category)
        let value = app.sourceValue(for: category)

        HStack {
            Text(title)
                .foregroundStyle(Theme.text)

            Spacer(minLength: 12)

            if options.isEmpty {
                Text("Keine Bibliothek")
                    .font(.caption)
                    .foregroundStyle(Theme.muted)
            } else {
                Menu {
                    Button("Automatisch") { app.setSourceValue("", for: category) }
                    ForEach(options) { library in
                        Button(optionLabel(library)) {
                            app.setSourceValue(library.key, for: category)
                        }
                    }
                    Divider()
                    Button("Aus") { app.setSourceValue("off", for: category) }
                } label: {
                    HStack(spacing: 4) {
                        Text(currentSourceLabel(value, options: options))
                            .foregroundStyle(value == "off" ? Theme.muted : Theme.accent)
                            .lineLimit(1)
                        Image(systemName: "chevron.up.chevron.down")
                            .font(.caption2)
                            .foregroundStyle(Theme.muted)
                    }
                }
            }
        }
        .listRowBackground(Theme.surface)
    }

    private func currentSourceLabel(_ value: String, options: [MediaLibrary]) -> String {
        if value == "off" { return "Aus" }
        if value.isEmpty { return "Automatisch" }
        if let library = options.first(where: { $0.key == value }) {
            return optionLabel(library)
        }
        return "Automatisch"
    }

    private func optionLabel(_ library: MediaLibrary) -> String {
        let server = app.servers.profiles.first(where: { $0.id == library.serverID })?.displayName
        guard let server, !server.isEmpty else { return library.name }
        return "\(server) · \(library.name)"
    }

    private var downloadsSection: some View {
        Section("Downloads") {
            NavigationLink {
                DownloadsView()
            } label: {
                HStack {
                    Text("Offline-Bibliothek")
                    Spacer()
                    Text("\(app.downloads.items.count)")
                        .foregroundStyle(Theme.muted)
                }
            }
            .listRowBackground(Theme.surface)

            HStack {
                Text("Belegter Speicher")
                Spacer()
                Text(app.downloads.totalText)
                    .foregroundStyle(Theme.muted)
            }
            .listRowBackground(Theme.surface)

            Button("Alle Downloads löschen", role: .destructive) {
                showDeleteDownloads = true
            }
            .disabled(app.downloads.items.isEmpty)
            .listRowBackground(Theme.surface)
        }
    }

    private var playbackSection: some View {
        Section("Wiedergabe") {
            HStack {
                Text("Titel in der Warteschlange")
                Spacer()
                Text("\(app.player.queue.count)")
                    .foregroundStyle(Theme.muted)
            }
            .listRowBackground(Theme.surface)

            Button("Warteschlange leeren") {
                app.player.clearQueue()
            }
            .foregroundStyle(Theme.danger)
            .disabled(app.player.queue.isEmpty)
            .listRowBackground(Theme.surface)
        }
    }

    private var aboutSection: some View {
        Section("App") {
            HStack(spacing: 12) {
                NavideckMark(size: 42)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Navideck")
                        .font(.headline)
                        .foregroundStyle(Theme.text)
                    Text("Version \(app.appVersion)")
                        .font(.caption)
                        .foregroundStyle(Theme.muted)
                }
            }
            .padding(.vertical, 4)
            .listRowBackground(Theme.surface)

            Link(destination: URL(string: "https://github.com/senar030/navideck")!) {
                HStack {
                    Text("Projekt auf GitHub")
                    Spacer()
                    Image(systemName: "arrow.up.right")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Theme.muted)
                }
                .foregroundStyle(Theme.text)
            }
            .listRowBackground(Theme.surface)

            Text("Native iOS-App für Navidrome und andere Subsonic-Server. Web, Windows, Linux und iOS teilen dieselbe Bibliothek.")
                .font(.caption)
                .foregroundStyle(Theme.muted)
                .listRowBackground(Theme.surface)
        }
    }
}

enum StreamQuality: Int, CaseIterable, Identifiable {
    case original = 0
    case high = 320
    case medium = 256
    case standard = 192
    case low = 128

    var id: Int { rawValue }

    var label: String {
        switch self {
        case .original: return "Original"
        case .high: return "320 kbit/s"
        case .medium: return "256 kbit/s"
        case .standard: return "192 kbit/s"
        case .low: return "128 kbit/s"
        }
    }

    static func label(for value: Int) -> String {
        StreamQuality(rawValue: value)?.label ?? "\(value) kbit/s"
    }
}

/// Multi-select list for the genres the instant mix should skip.
struct GenreExclusionView: View {
    @Environment(AppModel.self) private var app

    @State private var genres: [Genre] = []
    @State private var loading = false
    @State private var errorMessage: String?

    var body: some View {
        List {
            if loading && genres.isEmpty {
                HStack {
                    ProgressView().tint(Theme.accent)
                    Text("Genres werden geladen …")
                        .foregroundStyle(Theme.muted)
                }
                .listRowBackground(Theme.surface)
            }

            if let errorMessage {
                ErrorBanner(message: errorMessage)
                    .listRowBackground(Theme.surface)
            }

            ForEach(genres) { genre in
                Button {
                    toggle(genre.value)
                } label: {
                    HStack {
                        Text(genre.value)
                            .foregroundStyle(Theme.text)
                        Spacer()
                        if app.prefs.excludedGenres.contains(genre.value) {
                            Image(systemName: "checkmark")
                                .foregroundStyle(Theme.accent)
                        }
                    }
                }
                .listRowBackground(Theme.surface)
            }
        }
        .scrollContentBackground(.hidden)
        .background(Theme.background.ignoresSafeArea())
        .navigationTitle("Genres ausschließen")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    private func toggle(_ value: String) {
        if app.prefs.excludedGenres.contains(value) {
            app.prefs.excludedGenres.remove(value)
        } else {
            app.prefs.excludedGenres.insert(value)
        }
    }

    private func load() async {
        guard genres.isEmpty, let client = app.client else { return }
        loading = true
        do {
            genres = try await client.genres()
        } catch {
            errorMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
        loading = false
    }
}
