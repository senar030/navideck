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
            .compactMap { $0.media.metadata.seriesTitle }
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
                BookCoverView(
                    url: app.absCoverURL(book, width: 700),
                    title: book.media.metadata.title,
                    author: book.media.metadata.resolvedAuthor
                )
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
            return app.absBooks
                .filter { $0.media.metadata.seriesTitle == name }
                .sorted { left, right in
                    // Chronological by volume; books without a number go last.
                    switch (volumeNumber(left), volumeNumber(right)) {
                    case let (l?, r?):
                        if l != r { return l < r }
                    case (nil, _?):
                        return false
                    case (_?, nil):
                        return true
                    default:
                        break
                    }
                    return left.media.metadata.title.localizedCaseInsensitiveCompare(right.media.metadata.title) == .orderedAscending
                }
        case .author(let name):
            return app.absBooks
                .filter { $0.media.metadata.resolvedAuthor == name }
                .sorted { $0.media.metadata.title.localizedCaseInsensitiveCompare($1.media.metadata.title) == .orderedAscending }
        }
    }

    /// Volume numbers can be "1", "01" or "1.5". Anything unparsable sorts last.
    private func volumeNumber(_ book: AbsBook) -> Double? {
        guard let raw = book.media.metadata.seriesVolume?
            .trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty else { return nil }
        let cleaned = raw.replacingOccurrences(of: ",", with: ".")
        if let value = Double(cleaned) { return value }
        let numeric = cleaned.prefix { $0.isNumber || $0 == "." }
        return Double(numeric)
    }

    private func volumeLabel(_ book: AbsBook) -> String? {
        guard let raw = book.media.metadata.seriesVolume?
            .trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty else { return nil }
        return "Band \(raw)"
    }

    /// The title stays the primary label, even after a full item load adds
    /// series metadata.
    private func displayTitle(_ book: AbsBook) -> String {
        let title = book.media.metadata.title.trimmingCharacters(in: .whitespacesAndNewlines)
        if !title.isEmpty { return title }
        return volumeLabel(book) ?? "Unbekannter Titel"
    }

    private var isSeries: Bool {
        if case .series = filter { return true }
        return false
    }

    var body: some View {
        ScrollView {
            if isSeries {
                // Volumes as a list, ordered by series sequence.
                LazyVStack(spacing: 0) {
                    ForEach(Array(books.enumerated()), id: \.element.id) { offset, book in
                        NavigationLink(value: LibraryRoute.audiobook(book)) {
                            HStack(spacing: 12) {
                                BookCoverView(
                                    url: app.absCoverURL(book, width: 400),
                                    title: book.media.metadata.title,
                                    author: book.media.metadata.resolvedAuthor
                                )
                                .frame(width: Theme.rowArtwork, height: Theme.rowArtwork)

                                VStack(alignment: .leading, spacing: 3) {
                                    Text(displayTitle(book))
                                        .font(.body.weight(.medium))
                                        .foregroundStyle(Theme.text)
                                        .lineLimit(2)

                                    let details = [volumeLabel(book), book.media.metadata.resolvedAuthor]
                                        .compactMap { $0 }
                                        .filter { !$0.isEmpty }
                                    if !details.isEmpty {
                                        Text(details.joined(separator: " · "))
                                            .font(.caption)
                                            .foregroundStyle(Theme.muted)
                                            .lineLimit(1)
                                    }
                                }

                                Spacer()

                                Image(systemName: "chevron.right")
                                    .font(.caption2.weight(.semibold))
                                    .foregroundStyle(Theme.muted.opacity(0.7))
                            }
                            .padding(.horizontal, 20)
                            .padding(.vertical, 6)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)

                        if offset < books.count - 1 {
                            Divider().overlay(Theme.hairline).padding(.leading, 20)
                        }
                    }
                }
                .padding(.vertical, 8)
            } else {
                LazyVGrid(columns: columns, spacing: 20) {
                    ForEach(books) { book in
                        AudiobookCard(book: book, width: nil)
                    }
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 12)
            }

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
            BookCoverView(
                url: app.absCoverURL(book, width: 900),
                title: metadata.title,
                author: metadata.resolvedAuthor,
                maxPixel: 1000
            )
            .frame(width: 220, height: 220)
                .shadow(color: .black.opacity(0.4), radius: 22, y: 12)

            VStack(spacing: 4) {
                Text(metadata.title)
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(Theme.text)
                    .multilineTextAlignment(.center)

                if let author = metadata.resolvedAuthor, !author.isEmpty {
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
        if let series = metadata.seriesTitle, !series.isEmpty {
            if let sequence = metadata.seriesVolume, !sequence.isEmpty {
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
                if let progress, progress.currentTime > 5, progress.isFinished != true {
                    SquareIconButton(systemName: "backward.end", accessibilityTitle: "Von vorne") {
                        app.playAudiobook(book, from: 0)
                    }
                }
                Spacer(minLength: 0)
                downloadControl
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

    @ViewBuilder
    private var downloadControl: some View {
        if app.isAudiobookDownloaded(book) {
            SquareIconButton(systemName: "trash", accessibilityTitle: "Hörbuch-Download löschen") {
                app.removeAudiobookDownload(book)
            }
        } else if let progress = app.audiobookDownloadProgress(book) {
            DownloadRing(progress: progress)
                .frame(width: 26, height: 26)
                .padding(.horizontal, 10)
        } else {
            SquareIconButton(systemName: "arrow.down", accessibilityTitle: "Hörbuch herunterladen") {
                app.downloadAudiobook(book)
            }
        }
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
                                .frame(width: 26, alignment: .trailing)

                            VStack(alignment: .leading, spacing: 3) {
                                Text(chapter.title)
                                    .font(.body)
                                    .foregroundStyle(Theme.text)
                                    .lineLimit(2)
                                    .multilineTextAlignment(.leading)
                                Text(Format.duration(chapter.start))
                                    .font(.caption.monospacedDigit())
                                    .foregroundStyle(Theme.muted)
                            }

                            Spacer(minLength: 8)

                            Text(Format.duration(max(0, chapter.end - chapter.start)))
                                .font(.caption.monospacedDigit())
                                .foregroundStyle(Theme.muted)

                            Image(systemName: "play.fill")
                                .font(.caption2)
                                .foregroundStyle(Theme.muted)
                        }
                        .padding(.horizontal, 20)
                        .padding(.vertical, 6)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)

                    if offset < chapters.count - 1 {
                        Divider().overlay(Theme.hairline).padding(.leading, 54)
                    }
                }
            }
        }
    }
}


// MARK: - Autor

struct AudiobookAuthorView: View {
    @Environment(AppModel.self) private var app
    let name: String

    @State private var bio: String?
    @State private var loadingBio = false

    private let columns = [
        GridItem(.adaptive(minimum: 150, maximum: 220), spacing: 16, alignment: .top)
    ]

    private var books: [AbsBook] {
        app.absBooks
            .filter { $0.media.metadata.resolvedAuthor == name }
            .sorted { $0.media.metadata.title.localizedCaseInsensitiveCompare($1.media.metadata.title) == .orderedAscending }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                header

                if let bio, !bio.isEmpty {
                    Text(bio)
                        .font(.footnote)
                        .foregroundStyle(Theme.muted)
                        .padding(.horizontal, 20)
                } else if loadingBio {
                    ProgressView().tint(Theme.accent)
                        .padding(.horizontal, 20)
                }

                if books.isEmpty {
                    EmptyStateView(
                        icon: "person",
                        title: "Keine Bücher",
                        message: "Für diesen Autor liegen keine Hörbücher vor."
                    )
                    .padding(.top, 20)
                } else {
                    LazyVGrid(columns: columns, spacing: 20) {
                        ForEach(books) { book in
                            AudiobookCard(book: book, width: nil)
                        }
                    }
                    .padding(.horizontal, 20)
                }
            }
            .padding(.vertical, 16)
        }
        .navigationTitle(name)
        .navideckScreen()
        .task {
            await app.loadAudiobooks()
            if bio == nil {
                bio = app.absAuthorDescription(name)
            }
            if bio == nil {
                loadingBio = true
                bio = await app.authorBio(name: name)
                loadingBio = false
            }
        }
    }

    private var authorImage: URL? {
        app.absAuthors.first { $0.name == name }.flatMap { app.authorImageURL($0) }
    }

    private var header: some View {
        HStack(spacing: 14) {
            PersonAvatar(url: authorImage ?? books.first.flatMap { app.absCoverURL($0, width: 400) }, size: 72)

            VStack(alignment: .leading, spacing: 4) {
                Text(name)
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(Theme.text)
                Text("\(books.count) \(books.count == 1 ? "Hörbuch" : "Hörbücher")")
                    .font(.caption)
                    .foregroundStyle(Theme.muted)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 20)
    }
}
