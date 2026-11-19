import SwiftUI

/// Internet radio stations the server knows about. Tapping one starts the
/// stream directly, no queue and no scrobbling.
struct RadioView: View {
    /// Used inside a category shell that already provides the chrome.
    var embedded = false
    @Environment(AppModel.self) private var app

    @AppStorage("navideck.radio-ascending") private var ascending = true
    @State private var stations: [RadioStation] = []
    @State private var loading = false
    @State private var errorMessage: String?

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 0) {
                if let errorMessage {
                    ErrorBanner(message: errorMessage)
                        .padding(.horizontal, 20)
                        .padding(.bottom, 8)
                }

                ForEach(Array(sortedStations.enumerated()), id: \.element.id) { offset, station in
                    row(station)
                        .padding(.horizontal, 20)
                        .padding(.vertical, 6)

                    if offset < stations.count - 1 {
                        Divider().overlay(Theme.hairline).padding(.leading, 76)
                    }
                }
            }
            .padding(.vertical, 10)

            if loading && stations.isEmpty {
                ProgressView().tint(Theme.accent).padding(.vertical, 40)
            }

            if stations.isEmpty && !loading && errorMessage == nil {
                EmptyStateView(
                    icon: "dot.radiowaves.left.and.right",
                    title: "Keine Radiosender",
                    message: "Auf diesem Server sind keine Internet-Radios hinterlegt."
                )
            }
        }
        .navigationTitle(embedded ? "" : "Radio")
        .navideckScreen()
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button {
                    ascending.toggle()
                } label: {
                    Image(systemName: ascending ? "arrow.up" : "arrow.down")
                }
                .accessibilityLabel(ascending ? "A–Z" : "Z–A")
            }
        }
        .task { await load() }
        .refreshable { await load() }
    }

    private var sortedStations: [RadioStation] {
        stations.sorted {
            $0.name.localizedCaseInsensitiveCompare($1.name) == (ascending ? .orderedAscending : .orderedDescending)
        }
    }

    private func row(_ station: RadioStation) -> some View {
        let isCurrent = app.player.current?.title == station.name
            && app.player.isPlaying

        return Button {
            app.playRadio(station)
        } label: {
            HStack(spacing: 12) {
                CoverArtView(url: app.artworkURL(station.coverArt, size: 160))
                    .frame(width: 52, height: 52)

                VStack(alignment: .leading, spacing: 2) {
                    Text(station.name)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(isCurrent ? Theme.accent : Theme.text)
                        .lineLimit(1)
                    Text(isCurrent ? "Läuft" : "Live-Stream")
                        .font(.caption2)
                        .foregroundStyle(isCurrent ? Theme.accent.opacity(0.8) : Theme.muted)
                }

                Spacer()

                Image(systemName: isCurrent ? "pause" : "play")
                    .font(.system(size: 14, weight: .regular))
                    .foregroundStyle(Theme.text)
                    .frame(width: 40, height: 40)
                    .contentShape(Rectangle())
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .contextMenu {
            if let url = URL(string: station.homePageUrl ?? "") {
                Link(destination: url) {
                    Label("Webseite öffnen", systemImage: "safari")
                }
            }
        }
    }

    private func load() async {
        if app.offlineMode {
            stations = []
            errorMessage = "Radio-Streams brauchen eine Verbindung. Im Offline-Modus stehen nur Downloads zur Verfügung."
            loading = false
            return
        }
        guard let client = app.client else { return }
        loading = true
        errorMessage = nil
        do {
            stations = try await client.radioStations()
        } catch let failure as SubsonicFailure where failure.code == 30 || failure.code == 0 {
            // Some servers simply do not implement radio.
            stations = []
        } catch {
            errorMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
        loading = false
    }
}
