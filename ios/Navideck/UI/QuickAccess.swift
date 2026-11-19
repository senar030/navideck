import SwiftUI

/// All sub-sections of all categories, as a configurable band on the Start page.
enum QuickLink: String, CaseIterable, Identifiable {
    case albums, artists, genres, playlists, favorites, radio, downloads
    case audiobooks, series, authors, podcasts, newestPodcasts

    var id: String { rawValue }

    var title: String {
        switch self {
        case .albums: return "Alben"
        case .artists: return "Künstler"
        case .genres: return "Genres"
        case .playlists: return "Playlists"
        case .favorites: return "Favoriten"
        case .radio: return "Radio"
        case .downloads: return "Downloads"
        case .audiobooks: return "Hörbücher"
        case .series: return "Serien"
        case .authors: return "Autoren"
        case .podcasts: return "Podcasts"
        case .newestPodcasts: return "Neueste Folgen"
        }
    }

    var icon: String {
        switch self {
        case .albums: return "square.stack"
        case .artists: return "music.mic"
        case .genres: return "guitars"
        case .playlists: return "music.note.list"
        case .favorites: return "star"
        case .radio: return "dot.radiowaves.left.and.right"
        case .downloads: return "arrow.down.circle"
        case .audiobooks: return "books.vertical"
        case .series: return "square.stack"
        case .authors: return "person"
        case .podcasts: return "waveform"
        case .newestPodcasts: return "sparkles"
        }
    }

    var route: LibraryRoute? {
        switch self {
        case .albums: return .albums
        case .artists: return .artists
        case .genres: return .genres
        case .playlists: return .playlists
        case .favorites: return .favorites
        case .radio: return .radio
        case .downloads: return .downloads
        default: return nil
        }
    }

    var tab: Int? {
        switch self {
        case .audiobooks, .series, .authors: return 3
        case .podcasts, .newestPodcasts: return 2
        default: return nil
        }
    }

    static let defaults: [QuickLink] = [
        .albums, .artists, .playlists, .favorites, .genres, .downloads,
        .audiobooks, .podcasts,
    ]
}

struct QuickAccessBand: View {
    @Environment(AppModel.self) private var app

    private var order: [QuickLink] {
        let stored = UserDefaults.standard.string(forKey: "navideck.quicklinks")?
            .split(separator: ",").compactMap { QuickLink(rawValue: String($0)) } ?? []
        let missing = QuickLink.defaults.filter { !stored.contains($0) }
        return stored + missing
    }

    private var hidden: Set<QuickLink> {
        Set(
            UserDefaults.standard.string(forKey: "navideck.quicklinks.hidden")?
                .split(separator: ",").compactMap { QuickLink(rawValue: String($0)) } ?? []
        )
    }

    private var visible: [QuickLink] {
        let hiddenIDs = hidden
        return order.filter { link in
            guard !hiddenIDs.contains(link) else { return false }
            if let tab = link.tab {
                return tab == 3 ? app.audiobooksAvailable : app.podcastsAvailable
            }
            return app.musicAvailable
        }
    }

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(visible) { link in
                    if let route = link.route {
                        NavigationLink(value: route) {
                            pill(link)
                        }
                        .buttonStyle(.plain)
                    } else {
                        Button {
                            if let tab = link.tab {
                                app.pendingTab = tab
                            }
                        } label: {
                            pill(link)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .padding(.horizontal, 20)
        }
    }

    private func pill(_ link: QuickLink) -> some View {
        HStack(spacing: 6) {
            Image(systemName: link.icon)
                .font(.system(size: 13, weight: .medium))
            Text(link.title)
                .font(.subheadline.weight(.medium))
        }
        .foregroundStyle(Theme.text)
        .padding(.horizontal, 14)
        .frame(height: 38)
        .background(Theme.surface, in: Capsule())
    }
}

struct QuickAccessSettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @AppStorage("navideck.quicklinks") private var orderRaw = ""
    @AppStorage("navideck.quicklinks.hidden") private var hiddenRaw = ""

    private var order: [QuickLink] {
        let stored = orderRaw.split(separator: ",").compactMap { QuickLink(rawValue: String($0)) }
        let missing = QuickLink.defaults.filter { !stored.contains($0) }
        return stored + missing
    }

    private var hidden: Set<QuickLink> {
        Set(hiddenRaw.split(separator: ",").compactMap { QuickLink(rawValue: String($0)) })
    }

    var body: some View {
        List {
            Section {
                ForEach(order) { link in
                    HStack(spacing: 12) {
                        Image(systemName: link.icon)
                            .font(.system(size: 15))
                            .foregroundStyle(Theme.accent)
                            .frame(width: 24)
                        Text(link.title)
                            .foregroundStyle(Theme.text)
                        Spacer()
                        Button {
                            toggle(link)
                        } label: {
                            Image(systemName: hidden.contains(link) ? "eye.slash" : "eye")
                                .font(.system(size: 15))
                                .foregroundStyle(hidden.contains(link) ? Theme.muted : Theme.accent)
                                .frame(width: 40, height: 36)
                                .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                    }
                    .listRowBackground(Theme.surface)
                    .opacity(hidden.contains(link) ? 0.5 : 1)
                }
                .onMove(perform: move)
            } header: {
                Text("Schnellzugriff")
            } footer: {
                Text("Links zu allen Unterpunkten aller Kategorien. Ziehen zum Sortieren, Auge zum Ausblenden.")
            }

            Section {
                Button("Zurücksetzen") {
                    orderRaw = ""
                    hiddenRaw = ""
                }
                .foregroundStyle(Theme.accent)
                .listRowBackground(Theme.surface)
            }
        }
        .scrollContentBackground(.hidden)
        .background(Theme.background.ignoresSafeArea())
        .navigationTitle("Schnellzugriff")
        .navigationBarTitleDisplayMode(.inline)
        .environment(\.editMode, .constant(.active))
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button("Fertig") { dismiss() }
            }
        }
    }

    private func move(from source: IndexSet, to destination: Int) {
        var list = order
        list.move(fromOffsets: source, toOffset: destination)
        orderRaw = list.map(\.rawValue).joined(separator: ",")
    }

    private func toggle(_ link: QuickLink) {
        var list = hidden
        if list.contains(link) { list.remove(link) } else { list.insert(link) }
        hiddenRaw = list.map(\.rawValue).joined(separator: ",")
    }
}
