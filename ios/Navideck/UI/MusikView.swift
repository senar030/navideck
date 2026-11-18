import SwiftUI

/// Second tab: everything that belongs to the music library in one place.
/// The entries can be reordered and hidden, and shown as tiles or as a list.
struct MusikView: View {
    @Environment(AppModel.self) private var app

    @AppStorage("navideck.music-layout") private var layout = "grid"
    @AppStorage("navideck.music-order") private var orderRaw = ""
    @AppStorage("navideck.music-hidden") private var hiddenRaw = ""

    @State private var editing = false
    @State private var layoutBeforeEdit: String?

    private let columns = [
        GridItem(.flexible(), spacing: 12, alignment: .top),
        GridItem(.flexible(), spacing: 12, alignment: .top),
    ]

    var body: some View {
        Group {
            if app.offlineMode {
                OfflineLibraryView()
            } else {
                Group {
                    if editing {
                        editableList
                    } else if layout == "list" {
                        sectionList
                    } else {
                        grid
                    }
                }
                .navideckScreen()
            }
        }
        .navigationTitle("Musik")
        .offlineModeToolbar()
        .task {
            #if DEBUG
            let env = ProcessInfo.processInfo.environment
            if let demo = env["NAVIDECK_DEMO_MUSIC_LAYOUT"], !demo.isEmpty {
                layout = demo
            }
            if env["NAVIDECK_DEMO_MUSIC_EDIT"] == "1" {
                beginEditing()
            }
            #endif
        }
        .toolbar {
            if !app.offlineMode {
                ToolbarItemGroup(placement: .topBarTrailing) {
                    if editing {
                        Button {
                            orderRaw = ""
                            hiddenRaw = ""
                        } label: {
                            Image(systemName: "arrow.counterclockwise")
                        }
                        .accessibilityLabel("Reihenfolge zurücksetzen")

                        Button("Fertig") { endEditing() }
                            .fontWeight(.medium)
                    } else {
                        Button {
                            withAnimation(.easeOut(duration: 0.18)) {
                                layout = layout == "grid" ? "list" : "grid"
                            }
                        } label: {
                            Image(systemName: layout == "grid" ? "list.bullet" : "square.grid.2x2")
                        }
                        .accessibilityLabel(layout == "grid" ? "Listenansicht" : "Kachelansicht")

                        Button("Bearbeiten") { beginEditing() }
                    }
                }
            }
        }
    }

    // MARK: - Grid

    private var grid: some View {
        ScrollView {
            LazyVGrid(columns: columns, spacing: 12) {
                ForEach(visibleSections) { section in
                    NavigationLink(value: section.route) {
                        tileView(section)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 12)

            if visibleSections.isEmpty {
                EmptyStateView(
                    icon: "eye.slash",
                    title: "Keine Bereiche",
                    message: "Tippe auf „Bearbeiten“, um Bereiche wieder einzublenden."
                )
                .padding(.top, 30)
            }
        }
    }

    private func tileView(_ section: MusicSection) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Image(systemName: section.icon)
                .font(.system(size: 18, weight: .regular))
                .foregroundStyle(Theme.accent)
                .frame(height: 24)

            VStack(alignment: .leading, spacing: 2) {
                Text(section.title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.text)
                    .lineLimit(1)
                    .minimumScaleFactor(0.85)
                Text(subtitle(for: section))
                    .font(.caption2)
                    .foregroundStyle(Theme.muted)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
            }
        }
        .frame(maxWidth: .infinity, minHeight: 96, alignment: .topLeading)
        .padding(14)
        .background(Theme.surface)
        .overlay {
            Rectangle().stroke(Theme.hairline, lineWidth: 0.5)
        }
        .contentShape(Rectangle())
    }

    // MARK: - List

    private var sectionList: some View {
        List {
            ForEach(visibleSections) { section in
                NavigationLink(value: section.route) {
                    rowView(section)
                }
                .listRowInsets(EdgeInsets(top: 4, leading: 20, bottom: 4, trailing: 20))
                .listRowBackground(Color.clear)
                .listRowSeparatorTint(Theme.hairline)
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
    }

    /// Same list, but every entry can be dragged and switched on or off.
    private var editableList: some View {
        List {
            ForEach(orderedSections) { section in
                editableRow(section)
                    .listRowInsets(EdgeInsets(top: 4, leading: 20, bottom: 4, trailing: 20))
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)
            }
            .onMove(perform: move)
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .environment(\.editMode, .constant(.active))
    }

    /// The list adds the disclosure chevron itself, so the row only carries the
    /// icon and the labels.
    private func rowView(_ section: MusicSection) -> some View {
        HStack(spacing: 12) {
            iconBadge(section)
            titleStack(section)
            Spacer(minLength: 8)
        }
        .padding(.vertical, 6)
        .contentShape(Rectangle())
    }

    private func editableRow(_ section: MusicSection) -> some View {
        let isHidden = hidden.contains(section)

        return HStack(spacing: 12) {
            // The trailing edge belongs to the drag handle in edit mode, so the
            // visibility switch replaces the icon on the leading edge.
            Button {
                toggleHidden(section)
            } label: {
                Image(systemName: isHidden ? "eye.slash" : "eye")
                    .font(.system(size: 16, weight: .regular))
                    .foregroundStyle(isHidden ? Theme.muted : Theme.accent)
                    .frame(width: 40, height: 40)
                    .background(Theme.surface)
                    .overlay {
                        Rectangle().stroke(Theme.hairline, lineWidth: 0.5)
                    }
            }
            .buttonStyle(.plain)
            .accessibilityLabel(isHidden ? "\(section.title) einblenden" : "\(section.title) ausblenden")

            titleStack(section)

            Spacer(minLength: 8)
        }
        .padding(.vertical, 6)
        .opacity(isHidden ? 0.5 : 1)
        .contentShape(Rectangle())
    }

    private func iconBadge(_ section: MusicSection) -> some View {
        ZStack {
            Rectangle().fill(Theme.surface)
            Image(systemName: section.icon)
                .font(.system(size: 16, weight: .regular))
                .foregroundStyle(Theme.accent)
        }
        .frame(width: 40, height: 40)
        .overlay {
            Rectangle().stroke(Theme.hairline, lineWidth: 0.5)
        }
    }

    private func titleStack(_ section: MusicSection) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(section.title)
                .font(.subheadline.weight(.medium))
                .foregroundStyle(Theme.text)
                .lineLimit(1)
            Text(subtitle(for: section))
                .font(.caption2)
                .foregroundStyle(Theme.muted)
                .lineLimit(1)
        }
    }

    private func subtitle(for section: MusicSection) -> String {
        if section == .downloads {
            let count = app.downloads.items.count
            return count == 0 ? "Offline verfügbar" : "\(count) offline verfügbar"
        }
        return section.subtitle
    }

    // MARK: - Editing

    private func beginEditing() {
        layoutBeforeEdit = layout
        layout = "list"
        withAnimation(.easeOut(duration: 0.18)) {
            editing = true
        }
    }

    private func endEditing() {
        withAnimation(.easeOut(duration: 0.18)) {
            editing = false
        }
        if let previous = layoutBeforeEdit {
            layout = previous
            layoutBeforeEdit = nil
        }
    }

    private func move(from source: IndexSet, to destination: Int) {
        var order = orderedSections
        order.move(fromOffsets: source, toOffset: destination)
        orderRaw = order.map(\.rawValue).joined(separator: ",")
    }

    private func toggleHidden(_ section: MusicSection) {
        var list = hidden
        if list.contains(section) {
            list.remove(section)
        } else {
            list.insert(section)
        }
        hiddenRaw = list.map(\.rawValue).joined(separator: ",")
    }

    // MARK: - Stored order

    private var orderedSections: [MusicSection] {
        let stored = orderRaw
            .split(separator: ",")
            .compactMap { MusicSection(rawValue: String($0)) }
        let missing = MusicSection.defaultOrder.filter { !stored.contains($0) }
        return stored + missing
    }

    private var hidden: Set<MusicSection> {
        Set(hiddenRaw.split(separator: ",").compactMap { MusicSection(rawValue: String($0)) })
    }

    private var visibleSections: [MusicSection] {
        orderedSections.filter { !hidden.contains($0) }
    }
}

/// One entry of the music hub. The raw values are persisted.
enum MusicSection: String, CaseIterable, Identifiable, Hashable {
    case newest
    case recent
    case frequent
    case albums
    case artists
    case playlists
    case genres
    case favorites
    case radio
    case downloads

    static let defaultOrder: [MusicSection] = [
        .newest, .recent, .frequent,
        .albums, .artists, .playlists, .genres, .favorites, .radio, .downloads,
    ]

    var id: String { rawValue }

    var title: String {
        switch self {
        case .newest: return "Kürzlich hinzugefügt"
        case .recent: return "Kürzlich gespielt"
        case .frequent: return "Häufig gespielt"
        case .albums: return "Alben"
        case .artists: return "Interpreten"
        case .playlists: return "Playlists"
        case .genres: return "Genres"
        case .favorites: return "Favoriten"
        case .radio: return "Radio"
        case .downloads: return "Downloads"
        }
    }

    var subtitle: String {
        switch self {
        case .newest: return "Frisch im Regal"
        case .recent: return "Zuletzt gehört"
        case .frequent: return "Deine Dauerbrenner"
        case .albums: return "Alle Alben der Bibliothek"
        case .artists: return "Nach Künstler sortiert"
        case .playlists: return "Eigene und geteilte Listen"
        case .genres: return "Nach Stilrichtung stöbern"
        case .favorites: return "Markierte Titel und Alben"
        case .radio: return "Internetradios des Servers"
        case .downloads: return "Offline verfügbar"
        }
    }

    var icon: String {
        switch self {
        case .newest: return "sparkles"
        case .recent: return "clock.arrow.circlepath"
        case .frequent: return "flame"
        case .albums: return "square.stack"
        case .artists: return "music.mic"
        case .playlists: return "music.note.list"
        case .genres: return "guitars"
        case .favorites: return "star"
        case .radio: return "dot.radiowaves.left.and.right"
        case .downloads: return "arrow.down"
        }
    }

    var route: LibraryRoute {
        switch self {
        case .newest: return .albumCollection(.newest)
        case .recent: return .albumCollection(.recent)
        case .frequent: return .albumCollection(.frequent)
        case .albums: return .albums
        case .artists: return .artists
        case .playlists: return .playlists
        case .genres: return .genres
        case .favorites: return .favorites
        case .radio: return .radio
        case .downloads: return .downloads
        }
    }
}
