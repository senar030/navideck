import SwiftUI

/// Slim player strip that floats above the tab bar. Swiping it left or right
/// clears the queue, tapping opens Now Playing.
struct MiniPlayerBar: View {
    @Environment(AppModel.self) private var app

    @State private var dragOffset: CGFloat = 0
    @State private var clearing = false

    var body: some View {
        if let song = app.player.current {
            HStack(spacing: 10) {
                CoverArtView(url: app.artworkURL(song.coverArt, size: 160))
                    .frame(width: 36, height: 36)

                VStack(alignment: .leading, spacing: 1) {
                    Text(song.title)
                        .font(.footnote.weight(.medium))
                        .foregroundStyle(Theme.text)
                        .lineLimit(1)
                    Text(song.artist ?? song.album ?? " ")
                        .font(.caption2)
                        .foregroundStyle(Theme.muted)
                        .lineLimit(1)
                }

                Spacer(minLength: 4)

                Button {
                    app.player.toggle()
                } label: {
                    Image(systemName: app.player.isPlaying ? "pause.fill" : "play.fill")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(Theme.text)
                        .frame(width: 32, height: 32)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(app.player.isPlaying ? "Pause" : "Abspielen")

                Button {
                    app.player.next()
                } label: {
                    Image(systemName: "forward.end.fill")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(Theme.muted)
                        .frame(width: 30, height: 32)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Nächster Titel")
            }
            .padding(.leading, 8)
            .padding(.trailing, 6)
            .padding(.vertical, 6)
            .background(.ultraThinMaterial)
            .overlay(alignment: .bottom) {
                GeometryReader { geometry in
                    ZStack(alignment: .leading) {
                        Rectangle().fill(Color.white.opacity(0.05))
                        Rectangle()
                            .fill(Theme.accent.opacity(0.9))
                            .frame(width: geometry.size.width * fraction)
                    }
                }
                .frame(height: 1.5)
                .padding(.horizontal, 14)
                .padding(.bottom, 1)
            }
            .overlay {
                Rectangle()
                    .stroke(Color.white.opacity(0.08), lineWidth: 0.5)
            }
            .shadow(color: .black.opacity(0.35), radius: 14, y: 6)
            .contentShape(Rectangle())
            .offset(x: dragOffset)
            .opacity(1 - min(0.85, abs(dragOffset) / 280))
            .onTapGesture {
                app.player.showNowPlaying = true
            }
            .gesture(swipeToClear)
            .accessibilityElement(children: .contain)
            .accessibilityAction(named: "Warteschlange leeren") {
                app.player.clearQueue()
            }
        }
    }

    /// Horizontal swipe in either direction empties the queue. A short drag
    /// springs back, a long one throws the bar off screen.
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
                guard abs(value.translation.width) > 90 else {
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
                    // Let the strip slide out before the queue disappears.
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
