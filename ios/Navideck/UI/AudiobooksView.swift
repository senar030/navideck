import SwiftUI

// MARK: - Library

/// Third category: audiobooks from Audiobookshelf. Shows what is in progress,
/// the newest additions, series, authors and the whole library.
struct AudiobooksView: View {
    @Environment(AppModel.self) private var app

    private let coverColumns = [
        GridItem(.adaptive(minimum: 150, maximum: 220), spacing: 14, alignment: .top)
    ]

    private var inProgress: [AbsBook] { app.audiobooksInProgress }
    private var newest: [AbsBook] { Array(app.absBooks.prefix(12)) }

    private var seriesNames: [String] {
        var seen = Set<String>()
        return app.absBooks
            .compactMap { $0.media.metadata.seriesName }
            .filter { !$0.isEmpty && seen.insert($0).inserted }
            .sorted { $0.localizedCaseInsensitiveCompare($1) == .orderedAscending }
    }

    private var authorNames: [String] {
        var seen = Set<String>()
        return app.absBooks
            .compactMap { $0.media.metadata.authorName }
            .filter { !$0.isEmpty && seen.insert($0).inserted }
            .sorted { $0.localizedCaseInsensitiveCompare($1) == .orderedAscending }
    }

    var body: some View {
        Group {
            if app.offlineMode {
                EmptyStateView(
                    icon: "books.vertical",
                    title: "Hörbücher nur online",
                    message: "Hörbuch-Downloads folgen in einem späteren Update. Schalte den Offline-Modus aus, um deine Bibliothek zu sehen."
                )
                .frame(maxHeight: .infinity)
            } else if !app.audiobooksAvailable {
                EmptyStateView(
                    icon: "books.vertical",
                    title: "Keine Hörbuch-Quelle",
                    message: "Verbinde in den Optionen einen Audiobookshelf-Server oder wähle ihn als Quelle für Hörbücher."
                )
                .frame(maxHeight: .infinity)
            } else {
                library
            }
        }
        .navigationTitle("Hörbücher")
        .navideckScreen()
        .offlineModeToolbar()
        .task { await app.loadAudiobooks() }
        .refreshable { await app.loadAudiobooks(force: true) }
    }

    private var library: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 26) {
                if let error = app.absError {
                    ErrorBanner(message: error)
                        .padding(.horizontal, 20)
                }

                if let playerError = app.player.errorMessage {
                    ErrorBanner(message: playerError)
                        .padding(.horizontal, 20)
                }

                if app.absLoading && app.absBooks.isEmpty {
                    ProgressView("Hörbücher werden geladen …")
                        .tint(Theme.accent)
                        .foregroundStyle(Theme.muted)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 40)
                }

                if !inProgress.isEmpty {
                    section("Weiterhören") {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(alignment: .top, spacing: 14) {
                                ForEach(inProgress) { book in
                                    AudiobookCard(book: book, width: Theme.cardWidth, showsProgress: true)
                                }
                            }
                            .padding(.horizontal, 20)
                        }
                    }
                }

                if !newest.isEmpty {
                    section("Zuletzt hinzugefügt") {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(alignment: .top, spacing: 14) {
                                ForEach(newest) { book in
                                    AudiobookCard(book: book, width: Theme.cardWidth)
                                }
                            }
                            .padding(.horizontal, 20)
                        }
                    }
                }

                if !seriesNames.isEmpty {
                    section("Serien") {
                        chips(seriesNames, icon: "square.stack") { name in
                            LibraryRoute.audioSeries(name)
                        }
                    }
                }

                if !authorNames.isEmpty {
                    section("Autoren") {
                        chips(authorNames, icon: "person") { name in
                            LibraryRoute.audioAuthor(name)
                        }
                    }
                }

                section("Alle Hörbücher") {
                    LazyVGrid(columns: coverColumns, spacing: 20) {
                        ForEach(app.absBooks) { book in
                            AudiobookCard(book: book, width: nil)
                        }
                    }
                    .padding(.horizontal, 20)
                }

                if app.absBooks.isEmpty && !app.absLoading && app.absError == nil {
                    EmptyStateView(
                        icon: "books.vertical",
                        title: "Keine Hörbücher",
                        message: "Der Audiobookshelf-Server hat noch keine Buchbibliothek oder sie ist leer."
                    )
                }
            }
            .padding(.vertical, 12)
        }
    }

    private func section<Content: View>(
        _ title: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: title)
                .padding(.horizontal, 20)
            content()
        }
    }

    private func chips(
        _ names: [String],
        icon: String,
        route: @escaping (String) -> LibraryRoute
    ) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(names, id: \.self) { name in
                    NavigationLink(value: route(name)) {
                        HStack(spacing: 6) {
                            Image(systemName: icon)
                                .font(.caption2)
                            Text(name)
                                .font(.caption.weight(.medium))
                                .lineLimit(1)
                        }
                        .foregroundStyle(Theme.text)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(Theme.surface)
                        .overlay {
                            Rectangle().stroke(Theme.hairline, lineWidth: 0.5)
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 20)
        }
    }
}

// MARK: - Card

struct AudiobookCard: View {
    @Environment(AppModel.self) private var app
    let book: AbsBook
    var width: CGFloat?
    var showsProgress: Bool = false

    var body: some View {
        NavigationLink(value: LibraryRoute.audiobook(book)) {
            VStack(alignment: .leading, spacing: 6) {
                CoverArtView(url: app.absCoverURL(book, width: 400), radius: Theme.artworkRadius)
                    .aspectRatio(1, contentMode: .fit)
                    .frame(maxWidth: width)

                Text(book.media.metadata.title)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(Theme.text)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)

                if let author = book.media.metadata.authorName, !author.isEmpty {
                    Text(author)
                        .font(.caption2)
                        .foregroundStyle(Theme.muted)
                        .lineLimit(1)
                }

                if showsProgress {
                    let progress = app.audiobookProgress(book)
                    VStack(alignment: .leading, spacing: 2) {
                        DownloadProgressView(progress: progress)
                        if let stored = app.absProgress[book.id] {
                            Text("Noch \(Format.longDuration(Int(max(0, stored.duration - stored.currentTime))) ?? "")")
                                .font(.caption2.monospacedDigit())
                                .foregroundStyle(Theme.accent)
                        }
                    }
                }
            }
            .frame(width: width, alignment: .leading)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Series / author

enum AudiobookFilter {
    case series(String)
    case author(String)
}

struct AudiobookCollectionView: View {
    @Environment(AppModel.self) private var app
    let title: String
    let filter: AudiobookFilter

    private let columns = [
        GridItem(.adaptive(minimum: 150, maximum: 220), spacing: 14, alignment: .top)
    ]

    private var books: [AbsBook] {
        switch filter {
        case .series(let name):
            return app.absBooks.filter { $0.media.metadata.seriesName == name }
        case .author(let name):
            return app.absBooks.filter { $0.media.metadata.authorName == name }
        }
    }

    var body: some View {
        ScrollView {
            LazyVGrid(columns: columns, spacing: 20) {
                ForEach(books) { book in
                    AudiobookCard(book: book, width: nil)
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 12)

            if books.isEmpty {
                EmptyStateView(
                    icon: "books.vertical",
                    title: "Nichts gefunden",
                    message: "Für diese Auswahl liegen keine Hörbücher vor."
                )
            }
        }
        .navigationTitle(title)
        .navideckScreen()
        .task { await app.loadAudiobooks() }
    }
}

// MARK: - Detail

struct AudiobookDetailView: View {
    @Environment(AppModel.self) private var app
    @State private var book: AbsBook

    init(book: AbsBook) {
        _book = State(initialValue: book)
    }

    private var metadata: AbsMetadata { book.media.metadata }
    private var progress: AbsProgress? { app.absProgress[book.id] }

    private var isPlaying: Bool {
        guard let current = app.player.current else { return false }
        return app.player.isPlaying && current.id.hasPrefix("abs:\(book.id):")
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                header
                actions
                if let progress, progress.currentTime > 5, progress.isFinished != true {
                    resumeLine(progress)
                }
                if let description = metadata.description, !description.isEmpty {
                    Text(description)
                        .font(.footnote)
                        .foregroundStyle(Theme.muted)
                        .padding(.horizontal, 20)
                }
                chapters
            }
            .padding(.vertical, 16)
        }
        .navigationTitle(metadata.title)
        .navigationBarTitleDisplayMode(.inline)
        .navideckScreen()
        .task {
            await app.loadAudiobooks()
            // The library list may omit chapters and tracks.
            if let full = await app.fullBook(book) {
                book = full
            }
        }
    }

    private var header: some View {
        VStack(spacing: 12) {
            CoverArtView(url: app.absCoverURL(book, width: 900), radius: 16, maxPixel: 1000)
                .frame(width: 220, height: 220)
                .shadow(color: .black.opacity(0.4), radius: 22, y: 12)

            VStack(spacing: 4) {
                Text(metadata.title)
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(Theme.text)
                    .multilineTextAlignment(.center)

                if let author = metadata.authorName, !author.isEmpty {
                    Text(author)
                        .font(.subheadline)
                        .foregroundStyle(Theme.accent)
                }

                Text(metaLine)
                    .font(.caption)
                    .foregroundStyle(Theme.muted)
            }
            .padding(.horizontal, 24)
        }
    }

    private var metaLine: String {
        var parts: [String] = []
        if let narrator = metadata.narratorName, !narrator.isEmpty {
            parts.append("Gelesen von \(narrator)")
        }
        if let series = metadata.seriesName, !series.isEmpty {
            if let sequence = metadata.seriesSequence, !sequence.isEmpty {
                parts.append("\(series) \(sequence)")
            } else {
                parts.append(series)
            }
        }
        if let duration = Format.longDuration(Int(book.media.duration)) {
            parts.append(duration)
        }
        return parts.joined(separator: " · ")
    }

    private var actions: some View {
        ZStack {
            HStack(spacing: 6) {
                Spacer(minLength: 0)
                if let progress, progress.currentTime > 5, progress.isFinished != true {
                    Button {
                        app.playAudiobook(book)
                    } label: {
                        Label("Weiterhören", systemImage: "arrow.clockwise")
                            .font(.caption.weight(.medium))
                            .foregroundStyle(Theme.accent)
                    }
                    .buttonStyle(.plain)
                }
            }

            PlayCircleButton(isPlaying: isPlaying) {
                if isPlaying {
                    app.player.pause()
                } else {
                    app.playAudiobook(book)
                }
            }
        }
        .padding(.horizontal, 20)
    }

    private func resumeLine(_ progress: AbsProgress) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            DownloadProgressView(progress: app.audiobookProgress(book))
            HStack {
                Text("\(Format.duration(progress.currentTime)) gehört")
                Spacer()
                Text("Noch \(Format.longDuration(Int(max(0, progress.duration - progress.currentTime))) ?? "")")
            }
            .font(.caption2.monospacedDigit())
            .foregroundStyle(Theme.muted)
        }
        .padding(.horizontal, 20)
    }

    @ViewBuilder
    private var chapters: some View {
        let chapters = book.media.chapters
        if !chapters.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                SectionHeader(title: "Kapitel")
                    .padding(.horizontal, 20)

                ForEach(Array(chapters.enumerated()), id: \.element.id) { offset, chapter in
                    Button {
                        app.playAudiobook(book, from: chapter.start)
                    } label: {
                        HStack(spacing: 12) {
                            Text("\(offset + 1)")
                                .font(.caption.monospacedDigit())
                                .foregroundStyle(Theme.muted)
                                .frame(width: 24, alignment: .trailing)

                            VStack(alignment: .leading, spacing: 2) {
                                Text(chapter.title)
                                    .font(.subheadline)
                                    .foregroundStyle(Theme.text)
                                    .lineLimit(2)
                                    .multilineTextAlignment(.leading)
                                Text(Format.duration(chapter.start))
                                    .font(.caption2.monospacedDigit())
                                    .foregroundStyle(Theme.muted)
                            }

                            Spacer(minLength: 8)

                            Image(systemName: "play.fill")
                                .font(.caption2)
                                .foregroundStyle(Theme.muted)
                        }
                        .padding(.horizontal, 20)
                        .padding(.vertical, 8)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)

                    if offset < chapters.count - 1 {
                        Divider().overlay(Theme.hairline).padding(.leading, 56)
                    }
                }
            }
        }
    }
}
