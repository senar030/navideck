import SwiftUI

/// Round glass pill in the middle of the bottom row. Swiping it left or right
/// clears the queue, tapping opens Now Playing.
struct MiniPlayerBar: View {
    @Environment(AppModel.self) private var app

    @State private var dragOffset: CGFloat = 0
    @State private var clearing = false

    var body: some View {
        if let song = app.player.current {
            HStack(spacing: 8) {
                CoverArtView(url: app.artworkURL(song.coverArt, size: 160))
                    .frame(width: 32, height: 32)

                VStack(alignment: .leading, spacing: 1) {
                    Text(song.title)
                        .font(.caption.weight(.medium))
                        .foregroundStyle(Theme.text)
                        .lineLimit(1)
                    Text(song.artist ?? song.album ?? " ")
                        .font(.system(size: 9))
                        .foregroundStyle(Theme.muted)
                        .lineLimit(1)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                Button {
                    app.player.toggle()
                } label: {
                    Image(systemName: app.player.isPlaying ? "pause.fill" : "play.fill")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(Theme.text)
                        .frame(width: 32, height: 32)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(app.player.isPlaying ? "Pause" : "Abspielen")
            }
            .padding(.leading, 7)
            .padding(.trailing, 5)
            .padding(.vertical, 7)
            .navideckGlass(Capsule(), interactive: true)
            .overlay(alignment: .bottom) {
                GeometryReader { geometry in
                    ZStack(alignment: .leading) {
                        Capsule().fill(Color.white.opacity(0.08))
                        Capsule()
                            .fill(Theme.accent.opacity(0.9))
                            .frame(width: geometry.size.width * fraction)
                    }
                }
                .frame(height: 1.5)
                .padding(.horizontal, 12)
                .padding(.bottom, 2)
            }
            .shadow(color: .black.opacity(0.25), radius: 12, y: 5)
            .contentShape(Capsule())
            .offset(x: dragOffset)
            .opacity(1 - min(0.85, abs(dragOffset) / 280))
            .onTapGesture {
                app.player.showNowPlaying = true
            }
            .gesture(swipeToClear)
            .contextMenu {
                Button(role: .destructive) {
                    app.player.clearQueue()
                } label: {
                    Label("Warteschlange leeren", systemImage: "trash")
                }
            }
            .accessibilityElement(children: .contain)
            .accessibilityAction(named: "Warteschlange leeren") {
                app.player.clearQueue()
            }
        }
    }

    /// Horizontal swipe in either direction empties the queue. A short drag
    /// springs back, a long one throws the pill off screen.
    private var swipeToClear: some Gesture {
        DragGesture(minimumDistance: 12)
            .onChanged { value in
                guard !clearing else { return }
                let horizontal = value.translation.width
                guard abs(horizontal) > abs(value.translation.height) else { return }
                dragOffset = horizontal
            }
            .onEnded { value in
                guard !clearing else { return }
                guard abs(value.translation.width) > 80 else {
                    withAnimation(.spring(response: 0.28, dampingFraction: 0.85)) {
                        dragOffset = 0
                    }
                    return
                }
                clearing = true
                withAnimation(.easeIn(duration: 0.16)) {
                    dragOffset = value.translation.width > 0 ? 420 : -420
                }
                Task {
                    try? await Task.sleep(nanoseconds: 160_000_000)
                    app.player.clearQueue()
                    dragOffset = 0
                    clearing = false
                }
            }
    }

    private var fraction: Double {
        let player = app.player
        guard player.duration > 0 else { return 0 }
        return min(1, max(0, player.currentTime / player.duration))
    }
}
