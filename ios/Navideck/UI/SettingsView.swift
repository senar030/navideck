import SwiftUI

struct SettingsView: View {
    @Environment(AppModel.self) private var app

    @State private var showDisconnectConfirm = false
    @State private var showABSAdd = false
    @State private var absURL = ""
    @State private var absToken = ""
    @State private var absError: String?
    @State private var absConnecting = false
    @State private var removeCandidate: ServerProfile?
    @State private var showDeleteDownloads = false

    var body: some View {
        @Bindable var prefs = app.prefs

        Form {
            if let active = app.servers.active {
                activeServerSection(active)
            }

            serversSection
            audiobookServersSection
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

                Text("Gilt für das Streamen vom Server. Heruntergeladene Titel werden immer in der Originalqualität abgespielt.")
                    .font(.caption)
                    .foregroundStyle(Theme.muted)
                    .listRowBackground(Theme.surface)
            }

            downloadsSection
            playbackSection
            aboutSection
        }
        .scrollContentBackground(.hidden)
        .background(Theme.background.ignoresSafeArea())
        .navigationTitle("Einstellungen")
        .confirmationDialog(
            "Verbindung trennen?",
            isPresented: $showDisconnectConfirm,
            titleVisibility: .visible
        ) {
            Button("Trennen", role: .destructive) {
                app.disconnect()
            }
            Button("Abbrechen", role: .cancel) {}
        } message: {
            Text("Die gespeicherten Server bleiben erhalten.")
        }
        .confirmationDialog(
            "Server entfernen?",
            isPresented: Binding(
                get: { removeCandidate != nil },
                set: { if !$0 { removeCandidate = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("Entfernen", role: .destructive) {
                if let profile = removeCandidate {
                    app.remove(profile: profile)
                }
                removeCandidate = nil
            }
            Button("Abbrechen", role: .cancel) { removeCandidate = nil }
        } message: {
            Text("Zugangsdaten und Warteschlange dieses Servers werden gelöscht.")
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
    }

    // MARK: - Sections

    private func activeServerSection(_ profile: ServerProfile) -> some View {
        Section("Verbunden mit") {
            VStack(alignment: .leading, spacing: 4) {
                Text(profile.displayName)
                    .font(.headline)
                    .foregroundStyle(Theme.text)
                Text(profile.baseURL)
                    .font(.caption)
                    .foregroundStyle(Theme.muted)
                Text("Benutzer: \(profile.username)")
                    .font(.caption)
                    .foregroundStyle(Theme.muted)
            }
            .padding(.vertical, 4)
            .listRowBackground(Theme.surface)

            Button("Verbindung trennen", role: .destructive) {
                showDisconnectConfirm = true
            }
            .listRowBackground(Theme.surface)
        }
    }

    private var serversSection: some View {
        Section("Server") {
            ForEach(app.servers.profiles.filter { $0.kind == .subsonic }) { profile in
                Button {
                    app.activate(profile)
                } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(profile.displayName)
                                .foregroundStyle(Theme.text)
                            Text(profile.username)
                                .font(.caption)
                                .foregroundStyle(Theme.muted)
                        }
                        Spacer()
                        if profile.id == app.servers.activeID {
                            Image(systemName: "checkmark")
                                .foregroundStyle(Theme.accent)
                        }
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
            .listRowBackground(Theme.surface)

            Button {
                app.disconnect()
            } label: {
                Label("Server hinzufügen", systemImage: "plus")
                    .foregroundStyle(Theme.accent)
            }
            .listRowBackground(Theme.surface)
        }
    }

    private var audiobookServersSection: some View {
        Section("Hörbuch-Server") {
            if let active = app.servers.activeABS {
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(active.displayName)
                            .font(.headline)
                            .foregroundStyle(Theme.text)
                        Spacer()
                        Text("Verbunden")
                            .font(.caption)
                            .foregroundStyle(Theme.accent)
                    }
                    Text(active.baseURL)
                        .font(.caption)
                        .foregroundStyle(Theme.muted)
                }
                .padding(.vertical, 4)
                .listRowBackground(Theme.surface)
            }

            ForEach(app.servers.audiobookServers) { profile in
                Button {
                    app.activateAudiobookshelf(profile)
                } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(profile.displayName)
                                .foregroundStyle(Theme.text)
                            Text("Audiobookshelf")
                                .font(.caption)
                                .foregroundStyle(Theme.muted)
                        }
                        Spacer()
                        if profile.id == app.servers.absID {
                            Image(systemName: "checkmark")
                                .foregroundStyle(Theme.accent)
                        }
                    }
                }
                .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                    Button(role: .destructive) {
                        app.removeAudiobookshelf(profile)
                    } label: {
                        Label("Entfernen", systemImage: "trash")
                    }
                }
            }
            .listRowBackground(Theme.surface)

            Button {
                absURL = ""
                absToken = ""
                absError = nil
                showABSAdd = true
            } label: {
                Label("Audiobookshelf hinzufügen", systemImage: "plus")
                    .foregroundStyle(Theme.accent)
            }
            .listRowBackground(Theme.surface)
        }
        .sheet(isPresented: $showABSAdd) { audiobookshelfSheet }
    }

    private var sourcesSection: some View {
        Section("Quellen") {
            sourceRow("Musik", category: .music, options: [.auto, .subsonic, .off])
            sourceRow("Podcasts", category: .podcasts, options: [.auto, .subsonic, .off])
            sourceRow("Hörbücher", category: .audiobooks, options: [.auto, .audiobookshelf, .off])

            Text("Automatisch nutzt den verbundenen Server der passenden Art. Kategorien ohne Quelle werden ausgeblendet.")
                .font(.caption)
                .foregroundStyle(Theme.muted)
                .listRowBackground(Theme.surface)
        }
    }

    private func sourceRow(
        _ title: String,
        category: AppModel.Category,
        options: [CategorySource]
    ) -> some View {
        Picker(title, selection: Binding(
            get: { app.preference(for: category) },
            set: { app.setPreference($0, for: category) }
        )) {
            ForEach(options) { option in
                Text(option.label).tag(option)
            }
        }
        .listRowBackground(Theme.surface)
    }

    private var audiobookshelfSheet: some View {
        NavigationStack {
            Form {
                Section("Server") {
                    TextField("https://books.example.com", text: $absURL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .keyboardType(.URL)

                    SecureField("API-Token", text: $absToken)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                }

                if let absError {
                    Section {
                        Text(absError)
                            .font(.caption)
                            .foregroundStyle(Theme.danger)
                    }
                }

                Section {
                    Text("Den Token erzeugst du in Audiobookshelf unter Einstellungen → Benutzer → API-Token.")
                        .font(.caption)
                        .foregroundStyle(Theme.muted)
                }
            }
            .navigationTitle("Audiobookshelf")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen") { showABSAdd = false }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        connectABS()
                    } label: {
                        if absConnecting {
                            ProgressView()
                        } else {
                            Text("Verbinden")
                        }
                    }
                    .disabled(absConnecting || absURL.isEmpty || absToken.isEmpty)
                }
            }
        }
    }

    private func connectABS() {
        absConnecting = true
        absError = nil
        Task {
            do {
                try await app.connectAudiobookshelf(urlText: absURL, token: absToken)
                await app.loadAudiobooks(force: true)
                showABSAdd = false
            } catch {
                absError = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
            }
            absConnecting = false
        }
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
