import SwiftUI

struct ConnectView: View {
    @Environment(AppModel.self) private var app

    @State private var serverName = ""
    @State private var serverURL = ""
    @State private var username = ""
    @State private var password = ""
    @State private var usePasswordAuth = false
    @State private var busy = false
    @State private var errorMessage: String?

    @FocusState private var focusedField: Field?

    private enum Field {
        case server, user, password
    }

    var body: some View {
        ZStack {
            background

            ScrollView {
                VStack(spacing: 22) {
                    header
                    form

                    if let errorMessage {
                        ErrorBanner(message: errorMessage)
                            .padding(.horizontal, 24)
                    }

                    if !app.servers.profiles.isEmpty {
                        knownServers
                    }

                    Text("Die App spricht die Subsonic-API. Navidrome, Nextcloud Music, Airsonic und Gonic funktionieren. Der Server muss vom iPhone aus erreichbar sein – im WLAN oder über Tailscale.")
                        .font(.caption)
                        .foregroundStyle(Theme.muted)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 32)
                        .padding(.bottom, 24)
                }
                .padding(.top, 44)
            }
            .scrollDismissesKeyboard(.interactively)
        }
        .onAppear(perform: prefill)
    }

    private var background: some View {
        LinearGradient(
            colors: [Theme.backgroundLift, Theme.background],
            startPoint: .top,
            endPoint: .bottom
       )
        .ignoresSafeArea()
    }

    private var header: some View {
        VStack(spacing: 14) {
            NavideckMark(size: 84)
            Text("Navideck")
                .font(.largeTitle.weight(.bold))
                .foregroundStyle(Theme.text)
            Text("Deine Musik, nativ auf dem iPhone.")
                .font(.subheadline)
                .foregroundStyle(Theme.muted)
        }
    }

    private var form: some View {
        VStack(spacing: 14) {
            field {
                TextField("Name (optional)", text: $serverName)

                TextField("Server, z. B. http://192.168.1.10:4533", text: $serverURL)
                    .keyboardType(.URL)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .textContentType(.URL)
                    .focused($focusedField, equals: .server)
                    .submitLabel(.next)
                    .onSubmit { focusedField = .user }
            }

            field {
                TextField("Benutzername", text: $username)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .textContentType(.username)
                    .focused($focusedField, equals: .user)
                    .submitLabel(.next)
                    .onSubmit { focusedField = .password }
            }

            field {
                SecureField("Passwort", text: $password)
                    .textContentType(.password)
                    .focused($focusedField, equals: .password)
                    .submitLabel(.go)
                    .onSubmit(connect)
            }

            Toggle(isOn: $usePasswordAuth) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Nextcloud Music")
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(Theme.text)
                    Text("Passwort-Anmeldung statt Token (nötig für Nextcloud Music)")
                        .font(.caption2)
                        .foregroundStyle(Theme.muted)
                }
            }
            .tint(Theme.accentDeep)

            Button(action: connect) {
                HStack(spacing: 8) {
                    if busy {
                        ProgressView().tint(Theme.background)
                    }
                    Text(busy ? "Verbinde …" : "Verbinden")
                        .font(.headline)
                }
                .frame(maxWidth: .infinity)
                .frame(height: 50)
                .background(Theme.accent)
                .foregroundStyle(Theme.background)
            }
            .buttonStyle(.plain)
            .disabled(busy)
            .opacity(canConnect ? 1 : 0.45)
        }
        .padding(18)
        .background(Theme.surface.opacity(0.7))
        .overlay { Rectangle().stroke(Theme.hairline, lineWidth: 0.5) }
        .padding(.horizontal, 20)
    }

    private var knownServers: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Bekannte Server")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(Theme.muted)
                .padding(.horizontal, 24)

            VStack(spacing: 0) {
                ForEach(app.servers.profiles) { profile in
                    Button {
                        app.activate(profile)
                    } label: {
                        HStack(spacing: 12) {
                            Image(systemName: "server.rack")
                                .foregroundStyle(Theme.accent)
                                .frame(width: 24)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(profile.displayName)
                                    .font(.subheadline.weight(.medium))
                                    .foregroundStyle(Theme.text)
                                Text(profile.username)
                                    .font(.caption)
                                    .foregroundStyle(Theme.muted)
                            }
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(Theme.muted)
                        }
                        .padding(14)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)

                    if profile.id != app.servers.profiles.last?.id {
                        Divider().overlay(Theme.hairline).padding(.leading, 50)
                    }
                }
            }
            .background(Theme.surface)
            .overlay { Rectangle().stroke(Theme.hairline, lineWidth: 0.5) }
            .padding(.horizontal, 20)
        }
    }

    private func field<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        content()
            .font(.body)
            .foregroundStyle(Theme.text)
            .padding(14)
            .background(Color.black.opacity(0.18))
    }

    private var canConnect: Bool {
        !serverURL.trimmingCharacters(in: .whitespaces).isEmpty
            && !username.trimmingCharacters(in: .whitespaces).isEmpty
            && !password.isEmpty
    }

    private func prefill() {
        guard serverURL.isEmpty, let profile = app.servers.profiles.first else { return }
        serverURL = profile.baseURL
        username = profile.username
        usePasswordAuth = profile.auth == .password
    }

    private func connect() {
        guard canConnect, !busy else { return }
        focusedField = nil
        errorMessage = nil
        busy = true

        Task {
            do {
                try await app.connect(
                    urlText: serverURL,
                    username: username,
                    password: password,
                    auth: usePasswordAuth ? .password : .token
               )
                password = ""
            } catch {
                errorMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
            }
            busy = false
        }
    }
}
