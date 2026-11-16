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
                    List {
                        ForEach(Array(app.player.queue.enumerated()), id: \.offset) { offset, song in
                            Button {
                                app.player.jump(to: offset)
                            } label: {
                                TrackRow(
                                    song: song,
                                    number: offset + 1,
                                    isCurrent: offset == app.player.index,
                                    subtitle: [song.artist, song.album].compactMap { $0 }.joined(separator: " · ")
                                )
                            }
                            .buttonStyle(.plain)
                            .listRowBackground(
                                offset == app.player.index
                                    ? Theme.surface.opacity(0.85)
                                    : Color.clear
                            )
                            .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                                Button(role: .destructive) {
                                    app.player.removeFromQueue(at: IndexSet(integer: offset))
                                } label: {
                                    Label("Entfernen", systemImage: "trash")
                                }
                            }
                        }
                    }
                    .listStyle(.plain)
                    .scrollContentBackground(.hidden)
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
}
