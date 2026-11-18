import SwiftUI

/// The expanded navigation. A single glass capsule grows straight up out of the
/// menu button; it only carries symbols, so it stays as narrow as the button.
struct FloatingTabBar: View {
    let items: [(title: String, icon: String, tab: Int)]
    @Binding var selection: Int
    /// Called after a tab was picked so the menu can slide back in.
    var onSelect: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            ForEach(items.indices, id: \.self) { index in
                Button {
                    selection = items[index].tab
                    onSelect()
                } label: {
                    Image(systemName: items[index].icon)
                        .font(.system(size: 18, weight: isSelected(index) ? .semibold : .regular))
                        .foregroundStyle(isSelected(index) ? Theme.accent : Theme.muted)
                        .frame(width: Theme.controlSize, height: 50)
                        .background {
                            if isSelected(index) {
                                Circle()
                                    .fill(Theme.accent.opacity(0.16))
                                    .frame(width: 34, height: 34)
                            }
                        }
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(items[index].title)
                .accessibilityAddTraits(isSelected(index) ? .isSelected : [])
            }
        }
        .padding(.vertical, 5)
        .frame(width: Theme.controlSize)
        .navideckGlass(Capsule())
    }

    private func isSelected(_ index: Int) -> Bool {
        items[index].tab == selection
    }
}
