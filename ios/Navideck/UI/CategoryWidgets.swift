import SwiftUI

/// Reusable settings sheet for per-category widgets.
struct WidgetConfigView: View {
    struct Entry: Identifiable {
        let id: String
        let title: String
        let icon: String
    }

    let title: String
    let all: [Entry]
    let orderKey: String
    let hiddenKey: String

    @Environment(\.dismiss) private var dismiss
    @AppStorage private var orderRaw: String
    @AppStorage private var hiddenRaw: String

    init(title: String, all: [Entry], orderKey: String, hiddenKey: String) {
        self.title = title
        self.all = all
        self.orderKey = orderKey
        self.hiddenKey = hiddenKey
        _orderRaw = AppStorage(wrappedValue: "", orderKey)
        _hiddenRaw = AppStorage(wrappedValue: "", hiddenKey)
    }

    private var order: [Entry] {
        let ids = orderRaw.split(separator: ",").map(String.init)
        let ordered = ids.compactMap { id in all.first { $0.id == id } }
        let missing = all.filter { !ids.contains($0.id) }
        return ordered + missing
    }

    private var hidden: Set<String> {
        Set(hiddenRaw.split(separator: ",").map(String.init))
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    ForEach(order) { entry in
                        HStack(spacing: 12) {
                            Image(systemName: entry.icon)
                                .font(.system(size: 15))
                                .foregroundStyle(Theme.accent)
                                .frame(width: 24)
                            Text(entry.title)
                                .foregroundStyle(Theme.text)
                            Spacer()
                            Button {
                                toggle(entry.id)
                            } label: {
                                Image(systemName: hidden.contains(entry.id) ? "eye.slash" : "eye")
                                    .font(.system(size: 15))
                                    .foregroundStyle(hidden.contains(entry.id) ? Theme.muted : Theme.accent)
                                    .frame(width: 40, height: 36)
                                    .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                        }
                        .listRowBackground(Theme.surface)
                        .opacity(hidden.contains(entry.id) ? 0.5 : 1)
                    }
                    .onMove(perform: move)
                } header: {
                    Text("Widgets")
                } footer: {
                    Text("Ziehen zum Sortieren, Auge zum Ein- und Ausblenden.")
                }

                Section {
                    Button("Reihenfolge zurücksetzen") {
                        orderRaw = ""
                        hiddenRaw = ""
                    }
                    .foregroundStyle(Theme.accent)
                    .listRowBackground(Theme.surface)
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.background.ignoresSafeArea())
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .environment(\.editMode, .constant(.active))
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Fertig") { dismiss() }
                }
            }
        }
    }

    private func move(from source: IndexSet, to destination: Int) {
        var list = order
        list.move(fromOffsets: source, toOffset: destination)
        orderRaw = list.map(\.id).joined(separator: ",")
    }

    private func toggle(_ id: String) {
        var list = hidden
        if list.contains(id) { list.remove(id) } else { list.insert(id) }
        hiddenRaw = list.map { $0 }.joined(separator: ",")
    }
}

/// Small helper to read a widget configuration.
struct WidgetConfig {
    let orderKey: String
    let hiddenKey: String
    let all: [WidgetConfigView.Entry]

    func order(defaults: [String]) -> [WidgetConfigView.Entry] {
        let ids = UserDefaults.standard.string(forKey: orderKey)?
            .split(separator: ",").map(String.init) ?? []
        let ordered = ids.compactMap { id in all.first { $0.id == id } }
        let missing = all.filter { !ids.contains($0.id) }
        return ordered + missing
    }

    func hidden() -> Set<String> {
        Set(UserDefaults.standard.string(forKey: hiddenKey)?
            .split(separator: ",").map(String.init) ?? [])
    }

    func visible(defaults: [String]) -> [WidgetConfigView.Entry] {
        let hiddenIDs = hidden()
        return order(defaults: defaults).filter { !hiddenIDs.contains($0.id) }
    }
}

// MARK: - Musik widgets

struct MusikWidgetsView: View {
    @Environment(AppModel.self) private var app

    let config: WidgetConfig
    let recent: [Album]
    let newest: [Album]
    let frequent: [Album]
    let random: [Album]

    var body: some View {
        VStack(alignment: .leading, spacing: 26) {
            ForEach(config.visible(defaults: [])) { entry in
                switch entry.id {
                case "recent":
                    row("Zuletzt gespielt", icon: "clock.arrow.circlepath", albums: recent)
                case "newest":
                    row("Neu im Regal", icon: "sparkles", albums: newest)
                case "frequent":
                    row("Meistgespielt", icon: "flame", albums: frequent)
                case "random":
                    row("Zufällig", icon: "shuffle", albums: random)
                case "downloads":
                    let albums = app.downloadedAlbums
                    if !albums.isEmpty {
                        row("Downloads", icon: "arrow.down.circle", albums: albums)
                    }
                default:
                    EmptyView()
                }
            }
        }
    }

    @ViewBuilder
    private func row(_ title: String, icon: String, albums: [Album]) -> some View {
        if !albums.isEmpty {
            WidgetSection(title: title, icon: icon) {
                ScrollView(.horizontal, showsIndicators: false) {
                    LazyHStack(alignment: .top, spacing: 14) {
                        ForEach(albums) { album in
                            AlbumCard(album: album)
                                .frame(width: Theme.cardWidth)
                        }
                    }
                    .padding(.horizontal, 20)
                }
            }
        }
    }
}

extension WidgetConfig {
    static var musik: WidgetConfig {
        WidgetConfig(
            orderKey: "navideck.widgets.musik",
            hiddenKey: "navideck.widgets.musik.hidden",
            all: [
                .init(id: "recent", title: "Zuletzt gespielt", icon: "clock.arrow.circlepath"),
                .init(id: "newest", title: "Neu im Regal", icon: "sparkles"),
                .init(id: "frequent", title: "Meistgespielt", icon: "flame"),
                .init(id: "random", title: "Zufällig", icon: "shuffle"),
                .init(id: "downloads", title: "Downloads", icon: "arrow.down.circle"),
            ]
       )
    }

    static var podcasts: WidgetConfig {
        WidgetConfig(
            orderKey: "navideck.widgets.podcasts.v2",
            hiddenKey: "navideck.widgets.podcasts.v2.hidden",
            all: [
                .init(id: "continue", title: "Weiterhören", icon: "play.circle"),
                .init(id: "newest", title: "Neueste Folgen", icon: "sparkles"),
                .init(id: "shows", title: "Sender", icon: "waveform"),
            ]
       )
    }

    static var books: WidgetConfig {
        WidgetConfig(
            orderKey: "navideck.widgets.books",
            hiddenKey: "navideck.widgets.books.hidden",
            all: [
                .init(id: "continue", title: "Weiterhören", icon: "play.circle"),
                .init(id: "newest", title: "Neue Hörbücher", icon: "sparkles"),
                .init(id: "series", title: "Serien", icon: "square.stack"),
                .init(id: "authors", title: "Autoren", icon: "person"),
            ]
       )
    }
}
