import SwiftUI

struct NowPlayingView: View {
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss

    @State private var scrubTime: Double?
    @State private var dragOffset: CGFloat = 0

    var body: some View {
        @Bindable var player = app.player

        if let song = app.player.current {
            ZStack {
                background(for: song)

                VStack(spacing: 0) {
                    topBar
                    Spacer(minLength: 12)
                    artwork(for: song)
                    Spacer(minLength: 12)
                    metadata(for: song)
                    progress
                    controls
                    bottomBar(for: song)
                }
                .padding(.horizontal, 26)
                .padding(.bottom, 14)
            }
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
                            withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                                dragOffset = 0
                            }
                        }
                    }
            )
        } else {
            EmptyStateView(icon: "music.note", title: "Nichts in der Warteschlange")
                .background(Theme.background.ignoresSafeArea())
        }
    }

    // MARK: - Background

    private func background(for song: Song) -> some View {
        ZStack {
            Theme.background
            if let url = app.coverURL(song.coverArt, size: 900) {
                AsyncImage(url: url) { phase in
                    if case .success(let image) = phase {
                        image
                            .resizable()
                            .scaledToFill()
                            .blur(radius: 55)
                            .opacity(0.5)
                    }
                }
            }
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
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(Theme.text)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Schließen")

            Spacer()

            Text("Wiedergabe")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(Theme.muted)

            Spacer()

            Button {
                app.player.showQueue = true
            } label: {
                Image(systemName: "list.bullet")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(Theme.text)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Warteschlange")
        }
        .padding(.top, 4)
    }

    // MARK: - Artwork and metadata

    private func artwork(for song: Song) -> some View {
        CoverArtView(url: app.coverURL(song.coverArt, size: 900), radius: 20)
            .aspectRatio(1, contentMode: .fit)
            .frame(maxWidth: 380)
            .shadow(color: .black.opacity(0.5), radius: 32, y: 18)
            .scaleEffect(app.player.isPlaying ? 1 : 0.94)
            .animation(.spring(response: 0.45, dampingFraction: 0.8), value: app.player.isPlaying)
    }

    private func metadata(for song: Song) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(song.title)
                        .font(.title2.weight(.bold))
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

                if let error = app.player.errorMessage {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundStyle(Theme.danger)
                        .help(error)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, 18)
    }

    // MARK: - Progress

    private var progress: some View {
        VStack(spacing: 4) {
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

            HStack {
                Text(Format.duration(scrubTime ?? app.player.currentTime))
                Spacer()
                Text(Format.duration(app.player.duration))
            }
            .font(.caption2.monospacedDigit())
            .foregroundStyle(Theme.muted)
        }
        .padding(.top, 14)
    }

    // MARK: - Controls

    private var controls: some View {
        HStack(spacing: 26) {
            Button {
                app.player.toggleShuffle()
            } label: {
                Image(systemName: "shuffle")
                    .font(.system(size: 19, weight: .semibold))
                    .foregroundStyle(app.player.shuffleEnabled ? Theme.accent : Theme.muted)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)

            Button {
                app.player.previous()
            } label: {
                Image(systemName: "backward.fill")
                    .font(.system(size: 26, weight: .semibold))
                    .foregroundStyle(Theme.text)
                    .frame(width: 56, height: 56)
            }
            .buttonStyle(.plain)

            Button {
                app.player.toggle()
            } label: {
                ZStack {
                    Circle().fill(Theme.accent)
                    if app.player.isLoading {
                        ProgressView().tint(Theme.background)
                    } else {
                        Image(systemName: app.player.isPlaying ? "pause.fill" : "play.fill")
                            .font(.system(size: 30, weight: .bold))
                            .foregroundStyle(Theme.background)
                            .offset(x: app.player.isPlaying ? 0 : 3)
                    }
                }
                .frame(width: 78, height: 78)
            }
            .buttonStyle(.plain)

            Button {
                app.player.next()
            } label: {
                Image(systemName: "forward.fill")
                    .font(.system(size: 26, weight: .semibold))
                    .foregroundStyle(Theme.text)
                    .frame(width: 56, height: 56)
            }
            .buttonStyle(.plain)

            Button {
                app.player.cycleRepeat()
            } label: {
                Image(systemName: app.player.repeatMode.symbol)
                    .font(.system(size: 19, weight: .semibold))
                    .foregroundStyle(app.player.repeatMode == .off ? Theme.muted : Theme.accent)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(app.player.repeatMode.label)
        }
        .padding(.top, 10)
    }

    private func bottomBar(for song: Song) -> some View {
        HStack {
            Button {
                app.player.toggleStarCurrent()
            } label: {
                Image(systemName: (app.player.current?.starred != nil) ? "star.fill" : "star")
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle((app.player.current?.starred != nil) ? Theme.accent : Theme.muted)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Favorit")

            Spacer()

            Text("\(app.player.index + 1) von \(app.player.queue.count)")
                .font(.caption2)
                .foregroundStyle(Theme.muted)

            Spacer()

            Menu {
                Button {
                    app.player.addToQueue([song])
                } label: {
                    Label("Zur Warteschlange", systemImage: "text.badge.plus")
                }
            } label: {
                Image(systemName: "ellipsis.circle")
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(Theme.muted)
                    .frame(width: 44, height: 44)
            }
        }
        .padding(.top, 8)
    }
}
