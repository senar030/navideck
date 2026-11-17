import SwiftUI

/// Slim player strip that floats above the tab pill.
struct MiniPlayerBar: View {
    @Environment(AppModel.self) private var app

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
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
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
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(Color.white.opacity(0.08), lineWidth: 0.5)
            }
            .shadow(color: .black.opacity(0.35), radius: 14, y: 6)
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
