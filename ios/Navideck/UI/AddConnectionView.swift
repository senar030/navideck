import SwiftUI

/// Guided flow for adding a server connection: first the kind of server, then
/// the details. Keeps the naming consistent so the source picker stays clear.
struct AddConnectionView: View {
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss

    @State private var flavor: ServerFlavor?

    var body: some View {
        NavigationStack {
            List {
                Section {
                    ForEach(ServerFlavor.allCases, id: \.self) { option in
                        Button {
                            flavor = option
                        } label: {
                            HStack(alignment: .top, spacing: 12) {
                                Image(systemName: option == .audiobookshelf ? "books.vertical" : "music.note.house")
                                    .font(.system(size: 16, weight: .regular))
                                    .foregroundStyle(Theme.accent)
                                    .frame(width: 24)

                                VStack(alignment: .leading, spacing: 3) {
                                    Text(option.label)
                                        .font(.subheadline.weight(.medium))
                                        .foregroundStyle(Theme.text)
                                    Text(option.detail)
                                        .font(.caption)
                                        .foregroundStyle(Theme.muted)
                                        .fixedSize(horizontal: false, vertical: true)
                                }

                                Spacer(minLength: 0)

                                Image(systemName: "chevron.right")
                                    .font(.caption2.weight(.semibold))
                                    .foregroundStyle(Theme.muted.opacity(0.7))
                                    .padding(.top, 4)
                            }
                            .padding(.vertical, 4)
                        }
                        .listRowBackground(Theme.surface)
                    }
                } header: {
                    Text("Server-Art")
                } footer: {
                    Text("Navidrome und Subsonic liefern Musik und Podcasts. Audiobookshelf liefert Hörbücher und Podcasts.")
                }
            }
            .navigationTitle("Verbindung hinzufügen")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen") { dismiss() }
                }
            }
            .navigationDestination(item: $flavor) { option in
                ConnectionFormView(flavor: option) { dismiss() }
            }
        }
    }
}

struct ConnectionFormView: View {
    @Environment(AppModel.self) private var app
    let flavor: ServerFlavor
    var onFinished: () -> Void

    @State private var name = ""
    @State private var url = ""
    @State private var username = ""
    @State private var secret = ""
    @State private var useAccountLogin = false
    @State private var busy = false
    @State private var errorMessage: String?

    private var isAudiobookshelf: Bool { flavor == .audiobookshelf }

    private var canSubmit: Bool {
        guard !busy, !url.isEmpty else { return false }
        if isAudiobookshelf, useAccountLogin {
            return !username.isEmpty && !secret.isEmpty
        }
        if isAudiobookshelf {
            return !secret.isEmpty
        }
        return !username.isEmpty && !secret.isEmpty
    }

    var body: some View {
        Form {
            Section {
                TextField("Name (optional)", text: $name)
                TextField("https://…", text: $url)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .keyboardType(.URL)
            } header: {
                Text("Server")
            } footer: {
                Text("Der Name erscheint später in der Quellenauswahl. Ohne Namen wird der Hostname verwendet.")
            }

            if isAudiobookshelf {
                Section("Anmeldung") {
                    Picker("Methode", selection: $useAccountLogin) {
                        Text("API-Token").tag(false)
                        Text("Konto").tag(true)
                    }
                    .pickerStyle(.segmented)

                    if useAccountLogin {
                        TextField("Benutzername", text: $username)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                        SecureField("Passwort", text: $secret)
                    } else {
                        TextField("API-Token", text: $secret)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                    }
                }
            } else {
                Section("Zugang") {
                    TextField("Benutzername", text: $username)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()

                    SecureField(
                        flavor == .subsonicLegacy ? "Passwort" : "Passwort (wird nicht gespeichert übertragen)",
                        text: $secret
                   )
                }
            }

            if let errorMessage {
                Section {
                    Text(errorMessage)
                        .font(.caption)
                        .foregroundStyle(Theme.danger)
                }
            }

            Section {
                Button {
                    connect()
                } label: {
                    HStack {
                        Spacer()
                        if busy {
                            ProgressView().tint(Theme.accent)
                        } else {
                            Text("Verbindung testen & speichern")
                                .fontWeight(.medium)
                        }
                        Spacer()
                    }
                }
                .disabled(!canSubmit)
            } footer: {
                if flavor == .subsonicLegacy {
                    Text("Legacy: der Server erwartet das Passwort direkt statt eines Tokens.")
                }
            }
        }
        .navigationTitle(flavor.label)
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            if name.isEmpty {
                name = ""
            }
        }
    }

    private func connect() {
        busy = true
        errorMessage = nil
        Task {
            do {
                if isAudiobookshelf, useAccountLogin {
                    try await app.addAudiobookshelfLogin(
                        name: name,
                        urlText: url,
                        username: username,
                        password: secret
                   )
                } else {
                    try await app.addConnection(
                        flavor: flavor,
                        name: name,
                        urlText: url,
                        username: username,
                        secret: secret
                   )
                }
                if isAudiobookshelf {
                    await app.loadAudiobooks(force: true)
                    await app.loadPodcasts(force: true)
                }
                onFinished()
            } catch {
                errorMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
            }
            busy = false
        }
    }
}
