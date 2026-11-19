import SwiftUI

struct QueueView: View {
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Group {
                if app.player.queue.isEmpty {
                    EmptyStateView(
                        icon: "music.note.list",
                        title: "Warteschlange ist leer",
                        message: "Spiele ein Album oder eine Playlist, um Titel hier zu sammeln."
                    )
                } else {
                    ScrollView {
                        LazyVStack(spacing: 4) {
                            ForEach(Array(app.player.queue.enumerated()), id: \.offset) { offset, song in
                                row(offset: offset, song: song)
                            }
                        }
                        .padding(.vertical, 10)
                    }
                }
            }
            .background(Theme.background.ignoresSafeArea())
            .navigationTitle("Warteschlange")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Fertig") { dismiss() }
                        .foregroundStyle(Theme.accent)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Leeren") {
                        app.player.clearQueue()
                    }
                    .foregroundStyle(Theme.danger)
                    .disabled(app.player.queue.isEmpty)
                }
            }
        }
        .preferredColorScheme(.dark)
    }

    private func row(offset: Int, song: Song) -> some View {
        let isCurrent = offset == app.player.index

        return HStack(spacing: 10) {
            Button {
                app.player.jump(to: offset)
            } label: {
                HStack(spacing: 12) {
                    ZStack {
                        if isCurrent {
                            Image(systemName: "waveform")
                                .font(.system(size: 13, weight: .medium))
                                .foregroundStyle(Theme.accent)
                        } else {
                            Text("\(offset + 1)")
                                .font(.caption.monospacedDigit())
                                .foregroundStyle(Theme.muted)
                        }
                    }
                    .frame(width: 26)

                    VStack(alignment: .leading, spacing: 3) {
                        Text(song.title)
                            .font(.body.weight(isCurrent ? .semibold : .regular))
                            .foregroundStyle(isCurrent ? Theme.accent : Theme.text)
                            .lineLimit(1)
                        Text([song.artist, song.album].compactMap { $0 }.joined(separator: " · "))
                            .font(.caption)
                            .foregroundStyle(Theme.muted)
                            .lineLimit(1)
                    }

                    Spacer(minLength: 8)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            Button {
                app.player.toggleStar(at: offset)
            } label: {
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
        .padding(.vertical, 8)
        .background {
            if isCurrent {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(Theme.surface)
            }
        }
        .padding(.horizontal, 14)
        .contentShape(Rectangle())
        .contextMenu {
            Button {
                app.player.playNext([song])
            } label: {
                Label("Als Nächstes", systemImage: "text.line.first.and.arrowtriangle.forward")
            }
            Button {
                app.player.toggleStar(at: offset)
            } label: {
                Label(song.starred != nil ? "Aus Favoriten" : "Zu Favoriten", systemImage: "star")
            }
            Button(role: .destructive) {
                app.player.removeFromQueue(at: IndexSet(integer: offset))
            } label: {
                Label("Entfernen", systemImage: "trash")
            }
        }
    }
}
