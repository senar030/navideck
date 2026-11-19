import SwiftUI

// MARK: - Artwork

struct CoverArtView: View {
    let url: URL?
    /// Square by design. Kept as a parameter for the few places that still want
    /// a soft edge (e.g. the app icon in the settings).
    var radius: CGFloat = 0
    /// Cap for the decoded bitmap. Lists use the default, full-screen views
    /// pass a larger value.
    var maxPixel: Int = 600

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

            CachedImage(url: url, maxPixel: maxPixel)
        }
        .clipShape(RoundedRectangle(cornerRadius: radius, style: .continuous))
        .contentShape(Rectangle())
    }
}

/// Circular portrait for artists and authors, matching the square artwork
/// direction used for albums, books and podcasts.
struct PersonAvatar: View {
    let url: URL?
    var size: CGFloat = Theme.rowArtwork

    var body: some View {
        CoverArtView(url: url, radius: size / 2)
            .frame(width: size, height: size)
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
                Rectangle().fill(Theme.accent)
                Image(systemName: isPlaying ? "pause.fill" : "play.fill")
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundStyle(Theme.background)
                    .offset(x: isPlaying ? 0 : 2)
            }
            .frame(width: 58, height: 52)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(isPlaying ? "Pause" : "Abspielen")
    }
}

/// Slim square icon button used for shuffle, star, menu and download.
struct SquareIconButton: View {
    let systemName: String
    var active: Bool = false
    var size: CGFloat = 44
    var accessibilityTitle: String?
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.system(size: 17, weight: .medium))
                .foregroundStyle(active ? Theme.accent : Theme.text)
                .frame(width: size, height: size)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(accessibilityTitle ?? systemName)
    }
}

struct StarButton: View {
    let starred: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: starred ? "star.fill" : "star")
                .font(.system(size: 17, weight: .medium))
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
    var downloaded: Bool = false
    /// Set while this song is being downloaded.
    var progress: Double?

    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                if isCurrent {
                    Image(systemName: "waveform")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(Theme.accent)
                } else if let number {
                    Text("\(number)")
                        .font(.caption.monospacedDigit())
                        .foregroundStyle(Theme.muted)
                }
            }
            .frame(width: 22)

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

            if let progress, progress < 0.999 {
                DownloadRing(progress: progress)
                    .frame(width: 13, height: 13)
                    .accessibilityLabel("Download \(Int(progress * 100)) Prozent")
            } else if downloaded || progress != nil {
                Image(systemName: "arrow.down.circle.fill")
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.muted)
            }

            if song.starred != nil {
                Image(systemName: "star.fill")
                    .font(.caption2)
                    .foregroundStyle(Theme.accent.opacity(0.8))
            }

            Text(song.durationText)
                .font(.caption.monospacedDigit())
                .foregroundStyle(Theme.muted)
        }
        .padding(.vertical, 5)
        .contentShape(Rectangle())
    }
}

/// Standard song row used by album and playlist track lists (and the queue):
/// no dividers, inset rounded highlight for the current track, a star for each
/// entry and the same proportions everywhere.
struct SongRow: View {
    let song: Song
    var number: Int?
    var isCurrent: Bool = false
    var subtitle: String?
    /// Download progress ring while the song is being saved.
    var progress: Double?
    var downloaded: Bool = false
    var showsCover: Bool = false
    var coverURL: URL?
    var onPlay: () -> Void
    var onStar: () -> Void

    var body: some View {
        HStack(spacing: 10) {
            Button(action: onPlay) {
                HStack(spacing: 12) {
                    if showsCover, let coverURL {
                        CoverArtView(url: coverURL, radius: 8)
                            .frame(width: 44, height: 44)
                    } else {
                        ZStack {
                            if isCurrent {
                                Image(systemName: "waveform")
                                    .font(.system(size: 13, weight: .medium))
                                    .foregroundStyle(Theme.accent)
                            } else if let number {
                                Text("\(number)")
                                    .font(.caption.monospacedDigit())
                                    .foregroundStyle(Theme.muted)
                            }
                        }
                        .frame(width: 26)
                    }

                    VStack(alignment: .leading, spacing: 3) {
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
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            if let progress, progress < 0.999 {
                DownloadRing(progress: progress)
                    .frame(width: 20, height: 20)
                    .frame(width: 32, height: 36)
            } else if downloaded || progress != nil {
                Image(systemName: "arrow.down.circle.fill")
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.muted)
                    .frame(width: 32, height: 36)
            }

            Button(action: onStar) {
                Image(systemName: song.starred != nil ? "star.fill" : "star")
                    .font(.system(size: 15))
                    .foregroundStyle(song.starred != nil ? Theme.accent : Theme.muted)
                    .frame(width: 36, height: 36)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(song.starred != nil ? "Aus Favoriten" : "Zu Favoriten")

            Text(song.durationText)
                .font(.caption.monospacedDigit())
                .foregroundStyle(Theme.muted)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 6)
        .background {
            if isCurrent {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(Theme.surface)
            }
        }
        .padding(.horizontal, 14)
        .contentShape(Rectangle())
    }
}

struct AlbumCard: View {
    let album: Album
    @Environment(AppModel.self) private var app

    var body: some View {
        NavigationLink(value: LibraryRoute.album(album)) {
            VStack(alignment: .leading, spacing: 6) {
                CoverArtView(url: app.artworkURL(album.coverArt))
                    .aspectRatio(1, contentMode: .fit)
                    .overlay(alignment: .bottomTrailing) {
                        if app.downloads.item(kind: .album, sourceID: album.id) != nil {
                            Image(systemName: "arrow.down.circle.fill")
                                .font(.caption)
                                .foregroundStyle(Theme.text)
                                .padding(6)
                                .background(Theme.background.opacity(0.7))
                                .padding(6)
                        }
                    }

                Text(album.name)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.text)
                    .lineLimit(1)

                Text(album.artist ?? " ")
                    .font(.caption2)
                    .foregroundStyle(Theme.muted)
                    .lineLimit(1)
            }
        }
        .buttonStyle(.plain)
    }
}

struct AlbumRow: View {
    let album: Album
    @Environment(AppModel.self) private var app

    var body: some View {
        NavigationLink(value: LibraryRoute.album(album)) {
            AlbumRowContent(album: album)
        }
        .buttonStyle(.plain)
    }
}

/// The visual part of an album row, for places without a navigation stack
/// (search overlay) that open the album themselves.
struct AlbumRowContent: View {
    let album: Album
    @Environment(AppModel.self) private var app

    var body: some View {
        HStack(spacing: 12) {
            CoverArtView(url: app.artworkURL(album.coverArt, size: 200))
                .frame(width: Theme.rowArtwork, height: Theme.rowArtwork)

            VStack(alignment: .leading, spacing: 3) {
                Text(album.name)
                    .font(.body.weight(.medium))
                    .foregroundStyle(Theme.text)
                    .lineLimit(1)

                Text(albumSubtitle)
                    .font(.caption)
                    .foregroundStyle(Theme.muted)
                    .lineLimit(1)
            }

            Spacer(minLength: 8)

            if app.downloads.item(kind: .album, sourceID: album.id) != nil {
                Image(systemName: "arrow.down.circle.fill")
                    .font(.caption)
                    .foregroundStyle(Theme.muted)
            }

            Image(systemName: "chevron.right")
                .font(.caption2.weight(.semibold))
                .foregroundStyle(Theme.muted.opacity(0.7))
        }
        .padding(.vertical, 5)
        .contentShape(Rectangle())
    }

    private var albumSubtitle: String {
        var parts: [String] = []
        if let artist = album.artist, !artist.isEmpty { parts.append(artist) }
        if let year = album.year { parts.append(String(year)) }
        if let count = album.songCount { parts.append("\(count) Titel") }
        return parts.joined(separator: " · ")
    }
}

struct ArtistRow: View {
    let artist: Artist
    @Environment(AppModel.self) private var app

    var body: some View {
        NavigationLink(value: LibraryRoute.artist(artist)) {
            HStack(spacing: 12) {
                PersonAvatar(url: app.artworkURL(artist.coverArt, size: 200))

                VStack(alignment: .leading, spacing: 3) {
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
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(Theme.muted.opacity(0.7))
            }
            .padding(.vertical, 5)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

struct PlaylistRow: View {
    let playlist: Playlist
    @Environment(AppModel.self) private var app

    var body: some View {
        NavigationLink(value: LibraryRoute.playlist(playlist)) {
            HStack(spacing: 12) {
                CoverArtView(url: app.artworkURL(playlist.coverArt, size: 200))
                    .frame(width: Theme.rowArtwork, height: Theme.rowArtwork)

                VStack(alignment: .leading, spacing: 3) {
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
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(Theme.muted.opacity(0.7))
            }
            .padding(.vertical, 5)
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
        .background(Theme.danger.opacity(0.12))
    }
}

struct EmptyStateView: View {
    let icon: String
    let title: String
    var message: String?

    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: icon)
                .font(.system(size: 32, weight: .ultraLight))
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

// MARK: - Download state

/// Small ring that fills while a song is being downloaded. It also spins
/// slowly, so it stays visibly alive while a large file is buffering.
/// Sits exactly where the "downloaded" symbol appears afterwards.
struct DownloadRing: View {
    let progress: Double

    @State private var spinning = false

    private var fill: Double {
        // Always leave a visible arc, otherwise the first percent looks dead.
        min(1, max(0.16, progress))
    }

    var body: some View {
        ZStack {
            Circle()
                .stroke(Color.white.opacity(0.22), lineWidth: 1.8)

            Circle()
                .trim(from: 0, to: fill)
                .stroke(Theme.accent, style: StrokeStyle(lineWidth: 1.6, lineCap: .round))
                .rotationEffect(.degrees(spinning ? 270 : -90))
                .animation(.linear(duration: 1.3).repeatForever(autoreverses: false), value: spinning)
                .animation(.easeOut(duration: 0.3), value: fill)
        }
        .onAppear { spinning = true }
    }
}

struct DownloadProgressView: View {
    let progress: Double

    var body: some View {
        GeometryReader { proxy in
            ZStack(alignment: .leading) {
                Rectangle().fill(Color.white.opacity(0.1))
                Rectangle()
                    .fill(Theme.accent)
                    .frame(width: proxy.size.width * min(1, max(0, progress)))
            }
        }
        .frame(height: 3)
    }
}
