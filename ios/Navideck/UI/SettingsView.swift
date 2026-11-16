import SwiftUI

struct SettingsView: View {
    @Environment(AppModel.self) private var app

    @State private var showDisconnectConfirm = false
    @State private var removeCandidate: ServerProfile?

    var body: some View {
        Form {
            if let active = app.servers.active {
                activeServerSection(active)
            }

            serversSection
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
            ForEach(app.servers.profiles) { profile in
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
                            Image(systemName: "checkmark.circle.fill")
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
                Label("Server hinzufügen", systemImage: "plus.circle")
                    .foregroundStyle(Theme.accent)
            }
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
