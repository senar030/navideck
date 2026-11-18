import SwiftUI

/// The expanded navigation. It slides up out of the Start button as a stack of
/// glass capsules instead of a horizontal bar, so it reads as a menu that
/// belongs to that button.
struct FloatingTabBar: View {
    @Binding var selection: Int
    /// Called after a tab was picked so the menu can slide back in.
    var onSelect: () -> Void

    private let items: [(title: String, icon: String, tab: Int)] = [
        ("Start", "house", 0),
        ("Musik", "music.note", 1),
        ("Podcast", "waveform", 2),
        ("Optionen", "slider.horizontal.3", 3),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(items.indices, id: \.self) { index in
                Button {
                    selection = items[index].tab
                    onSelect()
                } label: {
                    HStack(spacing: 10) {
                        Image(systemName: items[index].icon)
                            .font(.system(size: 15, weight: isSelected(index) ? .semibold : .regular))
                            .frame(width: 20)

                        Text(items[index].title)
                            .font(.subheadline.weight(.medium))

                        Spacer(minLength: 0)
                    }
                    .foregroundStyle(isSelected(index) ? Theme.accent : Theme.text)
                    .padding(.horizontal, 14)
                    .frame(width: 188, height: 44)
                    .navideckGlass(
                        Capsule(),
                        tint: isSelected(index) ? Theme.accent.opacity(0.16) : nil
                    )
                    .contentShape(Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(items[index].title)
                .accessibilityAddTraits(isSelected(index) ? .isSelected : [])
            }
        }
    }

    private func isSelected(_ index: Int) -> Bool {
        items[index].tab == selection
    }
}
