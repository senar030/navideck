import SwiftUI

struct ArtistsView: View {
    @Environment(AppModel.self) private var app

    @State private var indexes: [ArtistIndex] = []
    @State private var loading = false
    @State private var errorMessage: String?

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 0) {
                ForEach(sections, id: \.name) { section in
                    Text(section.name ?? "#")
                        .font(.footnote.weight(.bold))
                        .foregroundStyle(Theme.accent)
                        .padding(.horizontal, 20)
                        .padding(.top, 18)
                        .padding(.bottom, 6)

                    ForEach(section.artists) { artist in
                        ArtistRow(artist: artist)
                            .padding(.horizontal, 20)
                            .padding(.vertical, 6)

                        if artist.id != section.artists.last?.id {
                            Divider()
                                .overlay(Theme.hairline)
                                .padding(.leading, 78)
                        }
                    }
                }
            }
            .padding(.bottom, 12)

            if let errorMessage {
                ErrorBanner(message: errorMessage)
                    .padding(.horizontal, 20)
                    .padding(.top, 12)
            }

            if loading && indexes.isEmpty {
                ProgressView().tint(Theme.accent).padding(.vertical, 40)
            }
        }
        .navigationTitle("Interpreten")
        .navideckScreen()
        .task { await load() }
        .refreshable { await load() }
    }

    private var sections: [ArtistIndex] {
        indexes.filter { !$0.artists.isEmpty }
    }

    private func load() async {
        guard let client = app.client else { return }
        loading = true
        errorMessage = nil
        do {
            indexes = try await client.artistIndexes()
            let artists = indexes.flatMap(\.artists).prefix(20)
            await ImageStore.shared.prefetch(artists.compactMap { app.artworkURL($0.coverArt) }, limit: 20)
        } catch {
            errorMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
        loading = false
    }
}
