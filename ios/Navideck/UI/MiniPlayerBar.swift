import SwiftUI

/// The compact player that sits above the tab bar on every screen.
struct MiniPlayerBar: View {
    @Environment(AppModel.self) private var app

    var body: some View {
        if let song = app.player.current {
            VStack(spacing: 0) {
                GeometryReader { geometry in
                    ZStack(alignment: .leading) {
                        Rectangle().fill(Color.white.opacity(0.06))
                        Rectangle()
                            .fill(Theme.accent)
                            .frame(width: geometry.size.width * fraction)
                    }
                }
                .frame(height: 2)

                HStack(spacing: 12) {
                    CoverArtView(url: app.coverURL(song.coverArt, size: 120), radius: 7)
                        .frame(width: 44, height: 44)

                    VStack(alignment: .leading, spacing: 2) {
                        Text(song.title)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Theme.text)
                            .lineLimit(1)
                        Text(song.artist ?? song.album ?? " ")
                            .font(.caption)
                            .foregroundStyle(Theme.muted)
                            .lineLimit(1)
                    }

                    Spacer(minLength: 4)

                    Button {
                        app.player.toggle()
                    } label: {
                        Image(systemName: app.player.isPlaying ? "pause.fill" : "play.fill")
                            .font(.system(size: 19, weight: .semibold))
                            .foregroundStyle(Theme.text)
                            .frame(width: 40, height: 40)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)

                    Button {
                        app.player.next()
                    } label: {
                        Image(systemName: "forward.fill")
                            .font(.system(size: 17, weight: .semibold))
                            .foregroundStyle(Theme.text)
                            .frame(width: 40, height: 40)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
            }
            .background(Theme.surface)
            .overlay(alignment: .top) {
                Rectangle()
                    .fill(Theme.hairline)
                    .frame(height: 0.5)
            }
            .shadow(color: Color.black.opacity(0.35), radius: 14, y: -4)
            .contentShape(Rectangle())
            .onTapGesture {
                app.player.showNowPlaying = true
            }
            .accessibilityElement(children: .contain)
        }
    }

    private var fraction: Double {
        let player = app.player
        guard player.duration > 0 else { return 0 }
        return min(1, max(0, player.currentTime / player.duration))
    }
}
