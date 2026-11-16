import SwiftUI

// MARK: - Artwork

struct CoverArtView: View {
    let url: URL?
    var radius: CGFloat = 10

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Theme.surfaceHigh, Theme.surface],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            Image(systemName: "music.note")
                .font(.system(size: 26, weight: .semibold))
                .foregroundStyle(Theme.muted.opacity(0.45))

            if let url {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().scaledToFill()
                    case .empty:
                        ProgressView().tint(Theme.muted)
                    default:
                        EmptyView()
                    }
                }
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: radius, style: .continuous))
        .contentShape(RoundedRectangle(cornerRadius: radius, style: .continuous))
    }
}

// MARK: - Headers and buttons

struct SectionHeader: View {
    let title: String
    var actionTitle: String?
    var action: (() -> Void)?

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(title)
                .font(.title3.weight(.semibold))
                .foregroundStyle(Theme.text)
            Spacer()
            if let actionTitle, let action {
                Button(actionTitle, action: action)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Theme.accent)
            }
        }
        .padding(.horizontal, 20)
    }
}

struct PlayCircleButton: View {
    let isPlaying: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            ZStack {
                Circle().fill(Theme.accent)
                Image(systemName: isPlaying ? "pause.fill" : "play.fill")
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(Theme.background)
                    .offset(x: isPlaying ? 0 : 2)
            }
            .frame(width: 56, height: 56)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(isPlaying ? "Pause" : "Abspielen")
    }
}

struct StarButton: View {
    let starred: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: starred ? "star.fill" : "star")
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(starred ? Theme.accent : Theme.muted)
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(starred ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen")
    }
}

// MARK: - Rows

struct TrackRow: View {
    let song: Song
    var number: Int?
    var isCurrent: Bool = false
    var subtitle: String?

    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                if isCurrent {
                    Image(systemName: "waveform")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Theme.accent)
                } else if let number {
                    Text("\(number)")
                        .font(.footnote.monospacedDigit())
                        .foregroundStyle(Theme.muted)
                }
            }
            .frame(width: 24)

            VStack(alignment: .leading, spacing: 2) {
                Text(song.title)
                    .font(.body.weight(isCurrent ? .semibold : .regular))
                    .foregroundStyle(isCurrent ? Theme.accent : Theme.text)
                    .lineLimit(1)
                if let subtitle, !subtitle.isEmpty {
                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(Theme.muted)
                        .lineLimit(1)
                }
            }

            Spacer(minLength: 8)

            if song.starred != nil {
                Image(systemName: "star.fill")
                    .font(.caption2)
                    .foregroundStyle(Theme.accent.opacity(0.8))
            }

            Text(song.durationText)
                .font(.footnote.monospacedDigit())
                .foregroundStyle(Theme.muted)
        }
        .padding(.vertical, 4)
        .contentShape(Rectangle())
    }
}

struct AlbumCard: View {
    let album: Album
    @Environment(AppModel.self) private var app

    var body: some View {
        NavigationLink(value: album) {
            VStack(alignment: .leading, spacing: 7) {
                CoverArtView(url: app.coverURL(album.coverArt), radius: 10)
                    .aspectRatio(1, contentMode: .fit)

                Text(album.name)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.text)
                    .lineLimit(1)

                Text(album.artist ?? " ")
                    .font(.caption)
                    .foregroundStyle(Theme.muted)
                    .lineLimit(1)
            }
        }
        .buttonStyle(.plain)
    }
}

struct ArtistRow: View {
    let artist: Artist
    @Environment(AppModel.self) private var app

    var body: some View {
        NavigationLink(value: artist) {
            HStack(spacing: 12) {
                CoverArtView(url: app.coverURL(artist.coverArt, size: 120), radius: 22)
                    .frame(width: 46, height: 46)

                VStack(alignment: .leading, spacing: 2) {
                    Text(artist.name)
                        .font(.body.weight(.medium))
                        .foregroundStyle(Theme.text)
                        .lineLimit(1)
                    if let count = artist.albumCount {
                        Text("\(count) \(count == 1 ? "Album" : "Alben")")
                            .font(.caption)
                            .foregroundStyle(Theme.muted)
                    }
                }

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Theme.muted.opacity(0.7))
            }
            .padding(.vertical, 4)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

struct PlaylistRow: View {
    let playlist: Playlist
    @Environment(AppModel.self) private var app

    var body: some View {
        NavigationLink(value: playlist) {
            HStack(spacing: 12) {
                CoverArtView(url: app.coverURL(playlist.coverArt, size: 160), radius: 8)
                    .frame(width: 52, height: 52)

                VStack(alignment: .leading, spacing: 2) {
                    Text(playlist.name)
                        .font(.body.weight(.medium))
                        .foregroundStyle(Theme.text)
                        .lineLimit(1)
                    Text(Self.meta(playlist))
                        .font(.caption)
                        .foregroundStyle(Theme.muted)
                        .lineLimit(1)
                }

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Theme.muted.opacity(0.7))
            }
            .padding(.vertical, 4)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private static func meta(_ playlist: Playlist) -> String {
        var parts: [String] = []
        if let count = playlist.songCount { parts.append("\(count) Titel") }
        if let duration = Format.longDuration(playlist.duration) { parts.append(duration) }
        return parts.joined(separator: " · ")
    }
}

// MARK: - States

struct ErrorBanner: View {
    let message: String

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(Theme.danger)
            Text(message)
                .font(.footnote)
                .foregroundStyle(Theme.text)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .padding(12)
        .background(Theme.danger.opacity(0.12), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
    }
}

struct EmptyStateView: View {
    let icon: String
    let title: String
    var message: String?

    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: icon)
                .font(.system(size: 34, weight: .light))
                .foregroundStyle(Theme.muted)
            Text(title)
                .font(.headline)
                .foregroundStyle(Theme.text)
            if let message {
                Text(message)
                    .font(.footnote)
                    .foregroundStyle(Theme.muted)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
        .padding(.horizontal, 24)
    }
}
