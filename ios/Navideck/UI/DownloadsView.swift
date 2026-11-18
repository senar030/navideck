import SwiftUI

/// Everything that lives on the device. Rows open the downloaded album or
/// artist; playback happens in those screens, not here.
struct DownloadsView: View {
    @Environment(AppModel.self) private var app

    @State private var filter: DownloadKind?
    @State private var confirmDeleteAll = false

    var body: some View {
        List {
            Section {
                summary
                    .listRowInsets(EdgeInsets(top: 6, leading: 20, bottom: 6, trailing: 20))
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)
            }

            if !app.downloads.progress.isEmpty {
                Section {
                    ForEach(activeIDs, id: \.self) { key in
                        activeRow(key)
                            .listRowInsets(EdgeInsets(top: 4, leading: 20, bottom: 4, trailing: 20))
                            .listRowBackground(Color.clear)
                            .listRowSeparator(.hidden)
                    }
                } header: {
                    Text("Läuft gerade")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Theme.muted)
                }
            }

            Section {
                if filtered.isEmpty {
                    EmptyStateView(
                        icon: "arrow.down.circle",
                        title: app.downloads.items.isEmpty ? "Noch keine Downloads" : "Nichts in diesem Filter",
                        message: "Lade Alben, Playlists oder Interpreten herunter, um sie ohne Verbindung zu hören."
                    )
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)
                } else {
                    ForEach(filtered) { item in
                        row(item)
                            .listRowInsets(EdgeInsets(top: 2, leading: 20, bottom: 2, trailing: 20))
                            .listRowBackground(Color.clear)
                            .listRowSeparatorTint(Theme.hairline)
                            .swipeActions(edge: .trailing) {
                                Button(role: .destructive) {
                                    app.downloads.delete(item)
                                } label: {
                                    Label("Löschen", systemImage: "trash")
                                }
                            }
                    }
                }
            } header: {
                if !app.downloads.items.isEmpty {
                    filterBar
                }
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .navigationTitle("Downloads")
        .navideckScreen()
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    confirmDeleteAll = true
                } label: {
                    Image(systemName: "trash")
                        .foregroundStyle(Theme.text)
                }
                .disabled(app.downloads.items.isEmpty)
                .accessibilityLabel("Alle Downloads löschen")
            }
        }
        .confirmationDialog(
            "Alle Downloads löschen?",
            isPresented: $confirmDeleteAll,
            titleVisibility: .visible
        ) {
            Button("Alle löschen", role: .destructive) {
                app.downloads.deleteEverything()
            }
            Button("Abbrechen", role: .cancel) {}
        } message: {
            Text("Entfernt \(app.downloads.items.count) \(app.downloads.items.count == 1 ? "Sammlung" : "Sammlungen") (\(app.downloads.totalText)) vom Gerät.")
        }
    }

    // MARK: - Summary

    private var summary: some View {
        HStack(spacing: 10) {
            Image(systemName: "internaldrive")
                .font(.system(size: 14, weight: .regular))
                .foregroundStyle(Theme.accent)
            VStack(alignment: .leading, spacing: 1) {
                Text("\(app.downloads.items.count) \(app.downloads.items.count == 1 ? "Sammlung" : "Sammlungen") offline")
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
    }

    // MARK: - Filter

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
            .padding(.vertical, 4)
        }
        .textCase(nil)
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

    // MARK: - Active downloads

    private var activeIDs: [String] {
        app.downloads.progress.keys.sorted()
    }

    private func activeRow(_ key: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(label(for: key))
                    .font(.caption)
                    .foregroundStyle(Theme.text)
                    .lineLimit(1)
                Spacer()
                Text("\(Int((app.downloads.progress[key] ?? 0) * 100)) %")
                    .font(.caption2.monospacedDigit())
                    .foregroundStyle(Theme.muted)
            }
            DownloadProgressView(progress: app.downloads.progress[key] ?? 0)
        }
    }

    private func label(for key: String) -> String {
        guard let item = app.downloads.items.first(where: { $0.id == key }) else {
            let parts = key.split(separator: ":")
            return parts.count > 1 ? String(parts[1]) : key
        }
        return item.title
    }

    // MARK: - Rows

    @ViewBuilder
    private func row(_ item: DownloadItem) -> some View {
        if let route = route(for: item) {
            // Albums and artists open their detail screen; the trash lives in
            // the swipe action so the whole row can navigate.
            NavigationLink(value: route) {
                rowContent(item, showsTrash: false)
            }
            .buttonStyle(.plain)
            .contextMenu { deleteButton(item) }
        } else {
            HStack(spacing: 8) {
                rowContent(item, showsTrash: true)
            }
        }
    }

    private func rowContent(_ item: DownloadItem, showsTrash: Bool) -> some View {
        HStack(spacing: 12) {
            CoverArtView(url: app.downloads.localCoverURL(coverArt: item.coverArt) ?? app.artworkURL(item.coverArt))
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
                    .foregroundStyle(Theme.text)
                    .lineLimit(1)
                Text(item.subtitle ?? item.metaText)
                    .font(.caption2)
                    .foregroundStyle(Theme.muted)
                    .lineLimit(1)
            }

            Spacer(minLength: 8)

            if showsTrash {
                Button {
                    app.downloads.delete(item)
                } label: {
                    Image(systemName: "trash")
                        .font(.system(size: 14, weight: .regular))
                        .foregroundStyle(Theme.muted)
                        .frame(width: 40, height: 40)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Download löschen")
            }

        }
        .contentShape(Rectangle())
        .padding(.vertical, 4)
    }

    @ViewBuilder
    private func deleteButton(_ item: DownloadItem) -> some View {
        Button(role: .destructive) {
            app.downloads.delete(item)
        } label: {
            Label("Download löschen", systemImage: "trash")
        }
    }

    /// Albums and artists have a detail screen that also works offline.
    private func route(for item: DownloadItem) -> LibraryRoute? {
        switch item.kind {
        case .album:
            return .album(
                Album(
                    id: item.sourceID,
                    name: item.title,
                    artist: item.subtitle,
                    coverArt: item.coverArt,
                    songCount: item.songs.count,
                    songs: item.songs
                )
            )
        case .artist:
            return .artist(Artist(id: item.sourceID, name: item.title, coverArt: item.coverArt))
        default:
            return nil
        }
    }

    private var filtered: [DownloadItem] {
        guard let filter else { return app.downloads.items }
        return app.downloads.items.filter { $0.kind == filter }
    }
}
