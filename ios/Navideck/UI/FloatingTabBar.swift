import SwiftUI

/// Floating, translucent bar above the home indicator. It overlays the content
/// visually but every stack reserves a matching inset so lists never disappear
/// underneath it.
struct FloatingTabBar: View {
    @Binding var selection: Int

    private let items: [(title: String, icon: String)] = [
        ("Start", "house"),
        ("Musik", "music.note"),
        ("Podcast", "waveform"),
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
        // Square edges by request: the bar lines up with the artwork geometry.
        .background(.ultraThinMaterial)
        .overlay {
            Rectangle().stroke(Color.white.opacity(0.10), lineWidth: 0.5)
        }
        .shadow(color: .black.opacity(0.45), radius: 18, y: 8)
    }
}
