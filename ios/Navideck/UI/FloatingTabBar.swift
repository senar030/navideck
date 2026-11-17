import SwiftUI

/// Expanding navigation: five entries in a round glass capsule. It slides out
/// above the Start button and collapses as soon as a destination is chosen.
struct FloatingTabBar: View {
    @Binding var selection: Int
    var onSearch: () -> Void
    /// Called after a tab was picked so the bar can slide back in.
    var onSelect: () -> Void

    private let items: [(title: String, icon: String, tab: Int?)] = [
        ("Start", "house", 0),
        ("Musik", "music.note", 1),
        ("Podcast", "waveform", 2),
        ("Suche", "magnifyingglass", nil),
        ("Optionen", "slider.horizontal.3", 3),
    ]

    var body: some View {
        HStack(spacing: 0) {
            ForEach(items.indices, id: \.self) { index in
                Button {
                    if let tab = items[index].tab {
                        selection = tab
                        onSelect()
                    } else {
                        onSearch()
                    }
                } label: {
                    VStack(spacing: 3) {
                        Image(systemName: items[index].icon)
                            .font(.system(size: 17, weight: isSelected(index) ? .semibold : .regular))
                        Text(items[index].title)
                            .font(.system(size: 9, weight: .medium))
                    }
                    .foregroundStyle(isSelected(index) ? Theme.accent : Theme.muted)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 7)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(items[index].title)
                .accessibilityAddTraits(isSelected(index) ? .isSelected : [])
            }
        }
        .padding(.horizontal, 8)
        .background(.ultraThinMaterial, in: Capsule())
        .overlay {
            Capsule().stroke(Color.white.opacity(0.12), lineWidth: 0.5)
        }
        .shadow(color: .black.opacity(0.35), radius: 18, y: 8)
    }

    private func isSelected(_ index: Int) -> Bool {
        items[index].tab == selection
    }
}
