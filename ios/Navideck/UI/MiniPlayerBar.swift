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
                    .frame(width: 38, height: 38)

                VStack(alignment: .leading, spacing: 1) {
                    Text(song.title)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(Theme.text)
                        .lineLimit(1)
                    Text(song.artist ?? song.album ?? " ")
                        .font(.caption2)
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
                        .frame(width: 38, height: 38)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(app.player.isPlaying ? "Pause" : "Abspielen")
            }
            .padding(.leading, 7)
            .padding(.trailing, 5)
            .padding(.vertical, 7)
            .navideckGlass(Capsule())
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
}
