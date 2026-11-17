import SwiftUI

/// Floating, translucent pill above the home indicator. It overlays the content
/// visually but a matching safe-area inset keeps lists from disappearing
/// underneath it.
struct FloatingTabBar: View {
    @Binding var selection: Int

    private let items: [(title: String, icon: String)] = [
        ("Start", "house"),
        ("Alben", "square.stack"),
        ("Interpreten", "music.mic"),
        ("Suche", "magnifyingglass"),
        ("Optionen", "slider.horizontal.3"),
    ]

    var body: some View {
        HStack(spacing: 0) {
            ForEach(items.indices, id: \.self) { index in
                Button {
                    if selection == index {
                        return
                    }
                    withAnimation(.easeOut(duration: 0.18)) {
                        selection = index
                    }
                } label: {
                    VStack(spacing: 3) {
                        Image(systemName: items[index].icon)
                            .font(.system(size: 17, weight: selection == index ? .semibold : .regular))
                        Text(items[index].title)
                            .font(.system(size: 9, weight: .medium))
                    }
                    .foregroundStyle(selection == index ? Theme.accent : Theme.muted)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 7)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(items[index].title)
                .accessibilityAddTraits(selection == index ? .isSelected : [])
            }
        }
        .padding(.horizontal, 8)
        .background(.ultraThinMaterial, in: Capsule())
        .overlay {
            Capsule().stroke(Color.white.opacity(0.10), lineWidth: 0.5)
        }
        .shadow(color: .black.opacity(0.45), radius: 18, y: 8)
    }
}
