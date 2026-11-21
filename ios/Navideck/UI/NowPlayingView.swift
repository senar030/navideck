import SwiftUI

struct NowPlayingView: View {
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss

    @State private var scrubTime: Double?
    @State private var dragOffset: CGFloat = 0

    var body: some View {
        @Bindable var player = app.player

        Group {
            if let song = app.player.current {
                VStack(spacing: 0) {
                    topBar
                    Spacer(minLength: 6)

                    CoverArtView(url: app.artworkURL(song.coverArt, size: 900), maxPixel: 1200)
                        .aspectRatio(1, contentMode: .fit)
                        .frame(maxWidth: 380, maxHeight: 380)
                        .shadow(color: .black.opacity(0.45), radius: 24, y: 16)
                        .scaleEffect(app.player.isPlaying ? 1 : 0.965)
                        .animation(.spring(response: 0.45, dampingFraction: 0.85), value: app.player.isPlaying)

                    Spacer(minLength: 12)
                    metadata(for: song)
                    progress
                    controls
                    bottomBar(for: song)
                }
                .padding(.horizontal, 26)
                .padding(.bottom, 10)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(background(for: song))
                .offset(y: dragOffset)
                .sheet(isPresented: $player.showQueue) {
                    QueueView()
                }
                .gesture(
                    DragGesture()
                        .onChanged { value in
                            dragOffset = max(0, value.translation.height)
                        }
                        .onEnded { value in
                            if value.translation.height > 120 {
                                dismiss()
                            } else {
                                withAnimation(.spring(response: 0.3, dampingFraction: 0.85)) {
                                    dragOffset = 0
                                }
                            }
                        }
               )
            } else {
                EmptyStateView(icon: "music.note", title: "Nichts in der Warteschlange")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Theme.background.ignoresSafeArea())
            }
        }
    }

    // MARK: - Background

    private func background(for song: Song) -> some View {
        ZStack {
            Theme.background
            CachedImage(url: app.artworkURL(song.coverArt, size: 900))
                .blur(radius: 55)
                .opacity(0.45)
            LinearGradient(
                colors: [Theme.background.opacity(0.35), Theme.background.opacity(0.9), Theme.background],
                startPoint: .top,
                endPoint: .bottom
           )
        }
        .ignoresSafeArea()
    }

    // MARK: - Header

    private var topBar: some View {
        HStack {
            Button {
                dismiss()
            } label: {
                Image(systemName: "chevron.down")
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(Theme.text)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Schließen")

            Spacer()

            Text("Wiedergabe")
                .font(.caption.weight(.medium))
                .foregroundStyle(Theme.muted)

            Spacer()

            Button {
                app.player.showQueue = true
            } label: {
                Image(systemName: "list.bullet")
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(Theme.text)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Warteschlange")
        }
        .padding(.top, 4)
    }

    // MARK: - Metadata

    private func metadata(for song: Song) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(song.title)
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(Theme.text)
                        .lineLimit(2)
                    Text(song.artist ?? "Unbekannter Interpret")
                        .font(.subheadline)
                        .foregroundStyle(Theme.muted)
                        .lineLimit(1)
                    if let album = song.album, !album.isEmpty {
                        Text(album)
                            .font(.caption)
                            .foregroundStyle(Theme.muted.opacity(0.8))
                            .lineLimit(1)
                    }
                }

                Spacer(minLength: 12)

                if app.player.errorMessage != nil {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundStyle(Theme.danger)
                        .accessibilityLabel("Wiedergabefehler")
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, 16)
    }

    // MARK: - Progress

    private var progress: some View {
        VStack(spacing: 2) {
            Slider(
                value: Binding(
                    get: { scrubTime ?? app.player.currentTime },
                    set: { scrubTime = $0 }
               ),
                in: 0...max(app.player.duration, 1),
                onEditingChanged: { editing in
                    if !editing, let time = scrubTime {
                        app.player.seek(to: time)
                        scrubTime = nil
                    }
                }
           )
            .tint(Theme.accent)
            .controlSize(.mini)
            .frame(maxWidth: .infinity)

            HStack {
                Text(Format.duration(scrubTime ?? app.player.currentTime))
                Spacer(minLength: 8)
                Text(Format.duration(app.player.duration))
            }
            .font(.caption2.monospacedDigit())
            .foregroundStyle(Theme.muted)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 10)
    }

    // MARK: - Controls

    private var controls: some View {
        HStack(spacing: 22) {
            Button {
                app.player.toggleShuffle()
            } label: {
                Image(systemName: "shuffle")
                    .font(.system(size: 15, weight: .regular))
                    .foregroundStyle(app.player.shuffleEnabled ? Theme.accent : Theme.muted)
                    .frame(width: 40, height: 40)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Zufällige Wiedergabe")

            Button {
                app.player.previous()
            } label: {
                Image(systemName: "backward.end")
                    .font(.system(size: 20, weight: .regular))
                    .foregroundStyle(Theme.text)
                    .frame(width: 48, height: 48)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Vorheriger Titel")

            Button {
                app.player.toggle()
            } label: {
                ZStack {
                    Rectangle().fill(Theme.accent)
                    if app.player.isLoading {
                        ProgressView().tint(Theme.background)
                    } else {
                        Image(systemName: app.player.isPlaying ? "pause.fill" : "play.fill")
                            .font(.system(size: 22, weight: .medium))
                            .foregroundStyle(Theme.background)
                            .offset(x: app.player.isPlaying ? 0 : 2)
                    }
                }
                .frame(width: 64, height: 64)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(app.player.isPlaying ? "Pause" : "Abspielen")

            Button {
                app.player.next()
            } label: {
                Image(systemName: "forward.end")
                    .font(.system(size: 20, weight: .regular))
                    .foregroundStyle(Theme.text)
                    .frame(width: 48, height: 48)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Nächster Titel")

            Button {
                app.player.cycleRepeat()
            } label: {
                Image(systemName: app.player.repeatMode.symbol)
                    .font(.system(size: 15, weight: .regular))
                    .foregroundStyle(app.player.repeatMode == .off ? Theme.muted : Theme.accent)
                    .frame(width: 40, height: 40)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(app.player.repeatMode.label)
        }
        .padding(.top, 6)
    }

    // MARK: - Bottom bar

    private func bottomBar(for song: Song) -> some View {
        HStack {
            Button {
                app.player.toggleStarCurrent()
            } label: {
                Image(systemName: (app.player.current?.starred != nil) ? "star.fill" : "star")
                    .font(.system(size: 16, weight: .regular))
                    .foregroundStyle((app.player.current?.starred != nil) ? Theme.accent : Theme.muted)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Favorit")

            Spacer()

            Text("\(app.player.index + 1) von \(app.player.queue.count)")
                .font(.caption2)
                .foregroundStyle(Theme.muted)
                .monospacedDigit()

            Spacer()

            Menu {
                if let book = app.audiobook(for: song) {
                    Button {
                        app.openAudiobookAuthor(book)
                    } label: {
                        Label("Zum Autor", systemImage: "person")
                    }
                    .disabled(book.media.metadata.resolvedAuthor == nil)

                    if let series = book.media.metadata.seriesTitle, !series.isEmpty {
                        Button {
                            app.openAudiobookSeries(book)
                        } label: {
                            Label("Zur Serie", systemImage: "square.stack")
                        }
                    }
                } else {
                    Button {
                        app.openAlbum(id: song.albumId, name: song.album, artist: song.artist)
                    } label: {
                        Label("Zum Album", systemImage: "square.stack")
                    }
                    .disabled(song.albumId == nil)

                    Button {
                        app.openArtist(id: song.artistId, name: song.artist)
                    } label: {
                        Label("Zum Interpreten", systemImage: "music.mic")
                    }
                    .disabled(song.artistId == nil)
                }

                Divider()

                Button {
                    app.player.addToQueue([song])
                } label: {
                    Label("Zur Warteschlange", systemImage: "text.badge.plus")
                }

                if app.downloads.contains(songID: song.id) {
                    Button(role: .destructive) {
                        if let item = app.downloads.items.first(where: { $0.songs.contains(where: { $0.id == song.id }) }) {
                            app.downloads.delete(item)
                        }
                    } label: {
                        Label("Download entfernen", systemImage: "trash")
                    }
                } else {
                    Button {
                        app.download(song, from: song.album, artist: song.artist)
                    } label: {
                        Label("Titel herunterladen", systemImage: "arrow.down")
                    }
                }
            } label: {
                Image(systemName: "ellipsis")
                    .font(.system(size: 16, weight: .regular))
                    .foregroundStyle(Theme.text)
                    .frame(width: 44, height: 44)
            }
            .accessibilityLabel("Mehr Optionen")
        }
        .padding(.top, 6)
    }
}
