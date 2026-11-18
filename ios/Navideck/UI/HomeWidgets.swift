import SwiftUI

/// The widgets on the Start screen. Users can reorder and hide them.
enum HomeWidget: String, CaseIterable, Identifiable {
    case shortcuts
    case musicRecent
    case musicNewest
    case musicFrequent
    case musicRandom
    case audiobooksContinue
    case audiobooksNewest
    case podcastsNewest
    case downloads

    var id: String { rawValue }

    var title: String {
        switch self {
        case .shortcuts: return "Schnellzugriff"
        case .musicRecent: return "Zuletzt gespielt"
        case .musicNewest: return "Neu im Regal"
        case .musicFrequent: return "Meistgespielt"
        case .musicRandom: return "Zufällig"
        case .audiobooksContinue: return "Hörbücher weiterhören"
        case .audiobooksNewest: return "Neue Hörbücher"
        case .podcastsNewest: return "Podcasts"
        case .downloads: return "Downloads"
        }
    }

    var icon: String {
        switch self {
        case .shortcuts: return "square.grid.2x2"
        case .musicRecent: return "clock.arrow.circlepath"
        case .musicNewest: return "sparkles"
        case .musicFrequent: return "flame"
        case .musicRandom: return "shuffle"
        case .audiobooksContinue: return "books.vertical"
        case .audiobooksNewest: return "book"
        case .podcastsNewest: return "waveform"
        case .downloads: return "arrow.down.circle"
        }
    }

    static let defaultOrder: [HomeWidget] = [
        .shortcuts, .musicRecent, .musicNewest, .musicFrequent,
        .audiobooksContinue, .podcastsNewest, .musicRandom, .audiobooksNewest, .downloads,
    ]
}

/// Sheet for reordering and hiding the Start widgets.
struct HomeWidgetSettingsView: View {
    @Environment(\.dismiss) private var dismiss

    @AppStorage("navideck.home-widgets") private var orderRaw = ""
    @AppStorage("navideck.home-widgets-hidden") private var hiddenRaw = ""

    private var order: [HomeWidget] {
        let stored = orderRaw.split(separator: ",").compactMap { HomeWidget(rawValue: String($0)) }
        let missing = HomeWidget.defaultOrder.filter { !stored.contains($0) }
        return stored + missing
    }

    private var hidden: Set<HomeWidget> {
        Set(hiddenRaw.split(separator: ",").compactMap { HomeWidget(rawValue: String($0)) })
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    ForEach(order) { widget in
                        HStack(spacing: 12) {
                            Image(systemName: widget.icon)
                                .font(.system(size: 15))
                                .foregroundStyle(Theme.accent)
                                .frame(width: 24)

                            Text(widget.title)
                                .foregroundStyle(Theme.text)

                            Spacer()

                            Button {
                                toggle(widget)
                            } label: {
                                Image(systemName: hidden.contains(widget) ? "eye.slash" : "eye")
                                    .font(.system(size: 15))
                                    .foregroundStyle(hidden.contains(widget) ? Theme.muted : Theme.accent)
                                    .frame(width: 40, height: 36)
                                    .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                        }
                        .listRowBackground(Theme.surface)
                        .opacity(hidden.contains(widget) ? 0.5 : 1)
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
            .navigationTitle("Start anpassen")
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
        orderRaw = list.map(\.rawValue).joined(separator: ",")
    }

    private func toggle(_ widget: HomeWidget) {
        var list = hidden
        if list.contains(widget) {
            list.remove(widget)
        } else {
            list.insert(widget)
        }
        hiddenRaw = list.map(\.rawValue).joined(separator: ",")
    }
}

/// Small helpers shared by the Start widgets.
struct WidgetSection<Content: View>: View {
    let title: String
    let icon: String
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(Theme.accent)
                Text(title)
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(Theme.text)
            }
            .padding(.horizontal, 20)

            content
        }
    }
}
