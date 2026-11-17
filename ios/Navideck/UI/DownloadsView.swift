import SwiftUI

/// Everything that lives on the device: browsable and playable without a
/// connection.
struct DownloadsView: View {
    @Environment(AppModel.self) private var app

    @State private var filter: DownloadKind?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                summary

                if !app.downloads.items.isEmpty {
                    filterBar
                }

                if !app.downloads.progress.isEmpty {
                    activeDownloads
                }

                if filtered.isEmpty && app.downloads.items.isEmpty {
                    EmptyStateView(
                        icon: "arrow.down.circle",
                        title: "Noch keine Downloads",
                        message: "Lade Alben, Playlists oder Interpreten herunter, um sie ohne Verbindung zu hören."
                    )
                } else {
                    LazyVStack(alignment: .leading, spacing: 0) {
                        ForEach(Array(filtered.enumerated()), id: \.element.id) { offset, item in
                            row(item)
                                .padding(.horizontal, 20)
                                .padding(.vertical, 6)

                            if offset < filtered.count - 1 {
                                Divider().overlay(Theme.hairline).padding(.leading, 76)
                            }
                        }
                    }
                }
            }
            .padding(.vertical, 12)
        }
        .navigationTitle("Downloads")
        .navideckScreen()
    }

    private var summary: some View {
        HStack(spacing: 10) {
            Image(systemName: "internaldrive")
                .font(.system(size: 14, weight: .regular))
                .foregroundStyle(Theme.accent)
            VStack(alignment: .leading, spacing: 1) {
                Text("\(app.downloads.items.count) Sammlungen offline")
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Theme.text)
                Text(app.downloads.totalText)
                    .font(.caption2)
                    .foregroundStyle(Theme.muted)
            }
            Spacer()
        }
        .padding(14)
        .background(Theme.surface)
        .overlay {
            Rectangle().stroke(Theme.hairline, lineWidth: 0.5)
        }
        .padding(.horizontal, 20)
    }

    private var filterBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                chip(nil, label: "Alle")
                ForEach(DownloadKind.allCases, id: \.self) { kind in
                    if app.downloads.items.contains(where: { $0.kind == kind }) {
                        chip(kind, label: kind.label)
                    }
                }
            }
            .padding(.horizontal, 20)
        }
    }

    private func chip(_ kind: DownloadKind?, label: String) -> some View {
        Button {
            filter = kind
        } label: {
            Text(label)
                .font(.caption.weight(.medium))
                .foregroundStyle(filter == kind ? Theme.background : Theme.text)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(filter == kind ? Theme.accent : Theme.surface)
        }
        .buttonStyle(.plain)
    }

    private var activeDownloads: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Läuft gerade")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Theme.muted)
                .padding(.horizontal, 20)

            ForEach(app.downloads.progress.keys.sorted(), id: \.self) { key in
                if let value = app.downloads.progress[key] {
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text(label(for: key))
                                .font(.caption)
                                .foregroundStyle(Theme.text)
                                .lineLimit(1)
                            Spacer()
                            Text("\(Int(value * 100)) %")
                                .font(.caption2.monospacedDigit())
                                .foregroundStyle(Theme.muted)
                        }
                        DownloadProgressView(progress: value)
                    }
                    .padding(.horizontal, 20)
                }
            }
        }
    }

    private func row(_ item: DownloadItem) -> some View {
        let isPlaying = app.player.isPlaying && item.songs.contains { $0.id == app.player.current?.id }

        return Button {
            if isPlaying {
                app.player.pause()
            } else {
                app.player.play(item.songs)
            }
        } label: {
            HStack(spacing: 12) {
                CoverArtView(url: app.downloads.localCoverURL(coverArt: item.coverArt)
                             ?? app.artworkURL(item.coverArt))
                    .frame(width: 52, height: 52)
                    .overlay(alignment: .bottomTrailing) {
                        Image(systemName: item.kind.symbol)
                            .font(.system(size: 8, weight: .semibold))
                            .foregroundStyle(Theme.text)
                            .padding(3)
                            .background(Theme.background.opacity(0.75))
                            .padding(3)
                    }

                VStack(alignment: .leading, spacing: 2) {
                    Text(item.title)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(isPlaying ? Theme.accent : Theme.text)
                        .lineLimit(1)
                    Text(item.metaText)
                        .font(.caption2)
                        .foregroundStyle(Theme.muted)
                        .lineLimit(1)
                }

                Spacer()

                Image(systemName: isPlaying ? "pause" : "play")
                    .font(.system(size: 14, weight: .regular))
                    .foregroundStyle(Theme.text)
                    .frame(width: 36, height: 40)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .contextMenu {
            Button {
                app.player.play(item.songs)
            } label: {
                Label("Abspielen", systemImage: "play")
            }
            Button {
                app.player.playNext(item.songs)
            } label: {
                Label("Als Nächstes", systemImage: "text.line.first.and.arrowtriangle.forward")
            }
            Button {
                app.player.addToQueue(item.songs)
            } label: {
                Label("Zur Warteschlange", systemImage: "text.badge.plus")
            }
            Divider()
            Button(role: .destructive) {
                app.downloads.delete(item)
            } label: {
                Label("Download löschen", systemImage: "trash")
            }
        }
    }

    private var filtered: [DownloadItem] {
        guard let filter else { return app.downloads.items }
        return app.downloads.items.filter { $0.kind == filter }
    }

    private func label(for key: String) -> String {
        guard let item = app.downloads.items.first(where: { $0.id == key }) else {
            return key.split(separator: ":").last.map(String.init) ?? key
        }
        return item.title
    }
}
