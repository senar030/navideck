import SwiftUI

/// Toolbar switch that hides everything except downloaded content.
struct OfflineModeButton: View {
    @Environment(AppModel.self) private var app

    var body: some View {
        Button {
            withAnimation(.easeOut(duration: 0.18)) {
                app.offlineMode.toggle()
            }
        } label: {
            Image(systemName: app.offlineMode ? "arrow.down.circle.fill" : "arrow.down.circle")
                .foregroundStyle(app.offlineMode ? Theme.accent : Theme.text)
        }
        .accessibilityLabel(app.offlineMode ? "Offline-Modus ausschalten" : "Offline-Modus einschalten")
        .accessibilityValue(app.offlineMode ? "An" : "Aus")
    }
}

extension View {
    /// Adds the offline switch to a screen's top right corner.
    func offlineModeToolbar() -> some View {
        toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                OfflineModeButton()
            }
        }
    }
}

/// What Start and Musik show while offline mode is on: only what is stored on
/// the device, with a pointer to the download manager when it is empty.
struct OfflineLibraryView: View {
    @Environment(AppModel.self) private var app

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                banner

                if !app.hasDownloads {
                    EmptyStateView(
                        icon: "arrow.down.circle",
                        title: "Nichts heruntergeladen",
                        message: "Im Offline-Modus erscheint hier nur, was auf dem Gerät liegt. Schalte ihn aus oder lade Alben und Interpreten herunter."
                    )
                    .padding(.top, 20)

                    NavigationLink(value: LibraryRoute.downloads) {
                        Text("Downloads öffnen")
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(Theme.accent)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                            .background(Theme.surface)
                            .overlay {
                                Rectangle().stroke(Theme.hairline, lineWidth: 0.5)
                            }
                    }
                    .buttonStyle(.plain)
                    .padding(.horizontal, 20)
                } else {
                    albums
                    artists
                    playlists
                }
            }
            .padding(.vertical, 12)
        }
        .navideckScreen()
    }

    private var banner: some View {
        HStack(spacing: 8) {
            Image(systemName: "arrow.down.circle.fill")
                .font(.system(size: 14))
                .foregroundStyle(Theme.accent)
            Text("Offline-Modus — nur Downloads")
                .font(.caption.weight(.medium))
                .foregroundStyle(Theme.muted)
            Spacer()
        }
        .padding(.horizontal, 20)
    }

    private var albums: some View {
        Group {
            let list = app.downloadedAlbums
            if !list.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    SectionHeader(title: "Alben")
                        .padding(.horizontal, 20)
                    ForEach(list) { album in
                        AlbumRow(album: album)
                            .padding(.horizontal, 20)
                    }
                }
            }
        }
    }

    private var artists: some View {
        Group {
            let list = app.downloadedArtists
            if !list.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    SectionHeader(title: "Interpreten")
                        .padding(.horizontal, 20)
                    ForEach(list) { artist in
                        ArtistRow(artist: artist)
                            .padding(.horizontal, 20)
                    }
                }
            }
        }
    }

    private var playlists: some View {
        Group {
            let list = app.downloadedPlaylists
            if !list.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    SectionHeader(title: "Playlists")
                        .padding(.horizontal, 20)
                    ForEach(list) { playlist in
                        PlaylistRow(playlist: playlist)
                            .padding(.horizontal, 20)
                    }
                }
            }
        }
    }
}

/// Podcast tab while offline: the episodes that were downloaded.
struct OfflineEpisodesView: View {
    @Environment(AppModel.self) private var app

    private var episodes: [DownloadItem] {
        app.downloads.items.filter { $0.kind == .song }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 8) {
                    Image(systemName: "arrow.down.circle.fill")
                        .font(.system(size: 14))
                        .foregroundStyle(Theme.accent)
                    Text("Offline-Modus — nur Downloads")
                        .font(.caption.weight(.medium))
                        .foregroundStyle(Theme.muted)
                    Spacer()
                }
                .padding(.horizontal, 20)

                if episodes.isEmpty {
                    EmptyStateView(
                        icon: "waveform",
                        title: "Keine Folgen offline",
                        message: "Lade einzelne Folgen herunter, um sie ohne Verbindung zu hören."
                    )
                    .padding(.top, 24)
                } else {
                    ForEach(Array(episodes.enumerated()), id: \.element.id) { offset, item in
                        Button {
                            app.player.play(item.songs)
                        } label: {
                            HStack(spacing: 12) {
                                CoverArtView(url: app.downloads.localCoverURL(coverArt: item.coverArt))
                                    .frame(width: 52, height: 52)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(item.title)
                                        .font(.subheadline.weight(.medium))
                                        .foregroundStyle(Theme.text)
                                        .lineLimit(1)
                                    Text(item.subtitle ?? item.metaText)
                                        .font(.caption2)
                                        .foregroundStyle(Theme.muted)
                                        .lineLimit(1)
                                }
                                Spacer()
                                Image(systemName: "play")
                                    .font(.system(size: 14))
                                    .foregroundStyle(Theme.text)
                            }
                            .padding(.horizontal, 20)
                            .padding(.vertical, 6)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)

                        if offset < episodes.count - 1 {
                            Divider().overlay(Theme.hairline).padding(.leading, 84)
                        }
                    }
                }
            }
            .padding(.vertical, 12)
        }
        .navideckScreen()
    }
}
