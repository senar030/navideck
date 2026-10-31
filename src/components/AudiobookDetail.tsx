import { useMemo, useState } from 'react'
import type { AbsLibraryItem } from '../api/abs'
import {
  authorRefOf,
  bookOf,
  formatDate,
  formatHours,
  heardShare,
  progressOf,
  seriesOf,
  sortBooks,
  type BookSort,
} from '../lib/absHelpers'
import { useAsync } from '../lib/useAsync'
import { useAbsPlayer } from '../lib/useAbsPlayer'
import { stripHtml } from '../lib/format'
import { useAccount } from '../state/AccountContext'
import { useNav } from '../state/NavContext'
import { usePrefs } from '../state/PrefsContext'
import { AbsCover, BookCard, MissingAbs, Notice, ProgressBar } from './AbsParts'
import { LayoutToggle } from './LayoutToggle'
import { MarqueeText } from './MarqueeText'
import { PlayGlyph } from './PlayGlyph'
import { SortMenu } from './SortMenu'

/* -------------------------------------------------------------------- books */

/* Huge books can carry hundreds of chapters; render the first page only. */
const CHAPTER_PAGE = 80

/* The author page starts at the earliest book, not at the alphabet. */
const AUTHOR_BOOK_SORTS: { id: BookSort; label: string; defaultDesc?: boolean }[] = [
  { id: 'year', label: 'Chronologisch' },
  { id: 'title', label: 'Titel' },
  { id: 'added', label: 'Hinzugefügt', defaultDesc: true },
  { id: 'duration', label: 'Länge' },
]

export function BookDetail({ id }: { id: string }) {
  const { abs, progress } = useAccount()
  const { go } = useNav()
  const { playBookAt } = useAbsPlayer()
  const [busy, setBusy] = useState(false)
  const [allChaptersFor, setAllChaptersFor] = useState<string | null>(null)
  const client = abs?.client ?? null
  const result = useAsync(client ? () => client.getItem(id) : null, [client, id])

  const full = result.data
  const book = full ? bookOf(full) : null
  const entry = progressOf(progress, id)
  const share = heardShare(entry)
  const series = book ? seriesOf(book) : null
  const author = book ? authorRefOf(book) : null

  if (!abs) return <MissingAbs noun="Hörbuch" />
  if (result.error) return <p className="error">{result.error}</p>
  if (!full || !book) return <p className="muted">Buch wird geladen …</p>

  const cover = abs.client.coverUrl(id)
  const chapters = book.chapters ?? []
  const showAllChapters = allChaptersFor === id
  const shownChapters = showAllChapters ? chapters : chapters.slice(0, CHAPTER_PAGE)
  const resumeAt = entry && !entry.isFinished ? (entry.currentTime ?? 0) : 0
  const left = Math.max(0, (entry?.duration ?? book.duration ?? 0) - resumeAt)
  const canResume = Boolean(entry && !entry.isFinished && resumeAt > 0)

  async function start(at?: number) {
    setBusy(true)
    try {
      await playBookAt(full as AbsLibraryItem, at ?? resumeAt)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="view detail abs-detail">
      <div className="hero-banner">
        <img className="hero-bg" src={cover} alt="" />
        <div className="hero-veil" />
        <div className="hero">
          <AbsCover src={cover} className="hero-cover" />
          <div className="hero-copy">
            <p className="eyebrow">{series ? `Serie · ${series.name}` : 'Hörbuch'}</p>
            <h2>{book.metadata.title}</h2>
            {book.metadata.subtitle ? <p className="hero-sub">{book.metadata.subtitle}</p> : null}
            {author ? (
              <button
                type="button"
                className="link-btn hero-artist"
                onClick={() => go({ name: 'abs-author', id: author.id })}
              >
                {author.name || book.metadata.authorName}
              </button>
            ) : (
              <p className="hero-artist">{book.metadata.authorName || 'Unbekannte Autorin'}</p>
            )}
            {book.metadata.narratorName || book.metadata.publisher || book.metadata.publishedYear ? (
              <p className="hero-facts muted">
                {[
                  book.metadata.narratorName ? `Gelesen von ${book.metadata.narratorName}` : null,
                  book.metadata.publisher,
                  book.metadata.publishedYear,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            ) : null}
            <p className="hero-meta muted">
              {[
                formatHours(book.duration),
                book.numTracks ? `${book.numTracks} ${book.numTracks === 1 ? 'Datei' : 'Dateien'}` : null,
                book.metadata.genres?.slice(0, 2).join(', '),
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            <div className="hero-actions">
              <button type="button" className="primary-btn" disabled={busy} onClick={() => void start()}>
                <PlayGlyph size={22} match={(song) => song.abs?.itemId === id} />
                {canResume ? 'Weiterhören' : 'Abspielen'}
              </button>
              {canResume ? (
                <button type="button" className="text-btn" disabled={busy} onClick={() => void start(0)}>
                  Von vorn
                </button>
              ) : null}
              {canResume ? (
                <span className="muted abs-left">
                  {Math.round(share * 100)} % · noch {formatHours(left)}
                </span>
              ) : null}
            </div>
            <ProgressBar value={share} className="abs-hero-bar" />
          </div>
        </div>
      </div>

      {book.metadata.description ? (
        <section className="abs-section">
          <h3>Über das Buch</h3>
          <p className="abs-description">{stripHtml(book.metadata.description)}</p>
        </section>
      ) : null}

      {chapters.length ? (
        <section className="abs-section">
          <h3>Kapitel</h3>
          <div className="abs-chapters">
            {shownChapters.map((chapter, index) => (
              <button
                key={`${chapter.start}-${index}`}
                type="button"
                className="abs-chapter"
                onClick={() => void start(chapter.start)}
              >
                <span className="abs-chapter-index">{index + 1}</span>
                <MarqueeText className="abs-chapter-title">{chapter.title || `Kapitel ${index + 1}`}</MarqueeText>
                <span className="abs-chapter-time muted">{formatHours(chapter.end - chapter.start)}</span>
              </button>
            ))}
          </div>
          {chapters.length > CHAPTER_PAGE ? (
            <button
              type="button"
              className="text-btn abs-chapters-more"
              onClick={() => setAllChaptersFor(showAllChapters ? null : id)}
            >
              {showAllChapters ? 'Weniger anzeigen' : `Weitere ${chapters.length - CHAPTER_PAGE} Kapitel anzeigen`}
            </button>
          ) : null}
        </section>
      ) : null}

      {series ? (
        <section className="abs-section">
          <button
            type="button"
            className="text-btn abs-series-link"
            onClick={() => go({ name: 'abs-series', id: series.id })}
          >
            Alle Bände der Serie „{series.name}“ ansehen
          </button>
        </section>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ authors */

export function AuthorDetail({ id }: { id: string }) {
  const { abs, progress } = useAccount()
  const { go } = useNav()
  const { layout } = usePrefs()
  const { playBook } = useAbsPlayer()
  const [busy, setBusy] = useState(false)
  const [sort, setSort] = useState<BookSort>('year')
  const [desc, setDesc] = useState(false)
  const client = abs?.client ?? null
  const result = useAsync(client ? () => client.getAuthor(id) : null, [client, id])
  const author = result.data?.author
  const books = useMemo(() => result.data?.libraryItems ?? [], [result.data])
  const ordered = useMemo(() => sortBooks(books, sort, desc), [books, sort, desc])

  if (!abs) return <MissingAbs noun="Hörbuch" />
  if (result.error) return <p className="error">{result.error}</p>
  if (!author) return <p className="muted">Autor wird geladen …</p>

  const image = author.imagePath ? abs.client.authorImageUrl(author.id) : undefined

  /* The hero starts the book this listener dipped into most recently. */
  let startBook: AbsLibraryItem | null = books[0] ?? null
  let latest = 0
  for (const item of books) {
    const entry = progressOf(progress, item.id)
    if (!entry || entry.isFinished) continue
    const at = entry.currentTime ?? 0
    if (at <= 0) continue
    if ((entry.lastUpdate ?? 0) >= latest) {
      latest = entry.lastUpdate ?? 0
      startBook = item
    }
  }
  const resumeEntry = startBook ? progressOf(progress, startBook.id) : undefined
  const resume = Boolean(resumeEntry && !resumeEntry.isFinished && (resumeEntry.currentTime ?? 0) > 0)
  const hours = books.reduce((sum, item) => sum + (bookOf(item).duration ?? 0), 0)

  async function start() {
    if (!startBook) return
    setBusy(true)
    try {
      await playBook(startBook)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="view abs-detail">
      <div className="hero-banner">
        {image ? <img className="hero-bg" src={image} alt="" /> : null}
        <div className="hero-veil" />
        <div className="hero">
          <AbsCover src={image} className="hero-cover avatar" />
          <div className="hero-copy">
            <p className="eyebrow">Autor</p>
            <h2>{author.name}</h2>
            <p className="hero-meta muted">
              {books.length} {books.length === 1 ? 'Buch' : 'Bücher'}
              {hours > 0 ? ` · ${formatHours(hours)}` : ''}
            </p>
            {startBook ? (
              <div className="hero-actions">
                <button type="button" className="primary-btn" disabled={busy} onClick={() => void start()}>
                  <PlayGlyph size={22} match={(song) => song.abs?.itemId === startBook?.id} />
                  {resume ? 'Weiterhören' : 'Hören'}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {author.description ? <p className="artist-bio">{stripHtml(author.description)}</p> : null}

      <section className="block">
        <div className="block-head">
          <h3>Bücher</h3>
          <div className="view-head-tools">
            <SortMenu
              options={AUTHOR_BOOK_SORTS}
              value={sort}
              desc={desc}
              onChange={(next, nextDesc) => {
                setSort(next)
                setDesc(nextDesc)
              }}
            />
            <LayoutToggle section="books" />
          </div>
        </div>
        {!books.length ? <Notice title="Noch keine Bücher" /> : null}
        <div className={`album-grid ${layout.books === 'list' ? 'is-list' : ''}`}>
          {ordered.map((item) => (
            <BookCard
              key={item.id}
              item={item}
              onOpen={() => go({ name: 'abs-book', id: item.id })}
              onPlay={() => void playBook(item)}
            />
          ))}
        </div>
      </section>
    </div>
  )
}

/* -------------------------------------------------------------- collections */

export function CollectionDetail({ id }: { id: string }) {
  const { abs } = useAccount()
  const { go } = useNav()
  const { layout } = usePrefs()
  const { playBook } = useAbsPlayer()
  const client = abs?.client ?? null
  const result = useAsync(client ? () => client.getCollection(id) : null, [client, id])
  const collection = result.data

  if (!abs) return <MissingAbs noun="Hörbuch" />
  if (result.error) return <p className="error">{result.error}</p>
  if (!collection) return <p className="muted">Sammlung wird geladen …</p>

  const books = collection.books ?? []

  return (
    <div className="view abs-detail">
      <header className="view-head">
        <div>
          <p className="eyebrow">Sammlung</p>
          <h2>{collection.name}</h2>
          <p className="muted">
            {books.length} {books.length === 1 ? 'Buch' : 'Bücher'}
            {collection.lastUpdate ? ` · zuletzt ${formatDate(collection.lastUpdate)}` : ''}
          </p>
        </div>
      </header>
      {collection.description ? <p className="abs-description">{stripHtml(collection.description)}</p> : null}
      {!books.length ? <Notice title="Diese Sammlung ist noch leer" /> : null}
      <div className={`album-grid ${layout.books === 'list' ? 'is-list' : ''}`}>
        {books.map((item) => (
          <BookCard
            key={item.id}
            item={item}
            onOpen={() => go({ name: 'abs-book', id: item.id })}
            onPlay={() => void playBook(item)}
          />
        ))}
      </div>
    </div>
  )
}

export function SeriesDetail({ id }: { id: string }) {
  const { abs } = useAccount()
  const { go } = useNav()
  const { layout } = usePrefs()
  const { playBook } = useAbsPlayer()
  const client = abs?.client ?? null
  const result = useAsync(client ? () => client.getSeriesById(id) : null, [client, id])
  const series = result.data

  const books = useMemo(() => {
    const list = [...(series?.books ?? [])]
    list.sort((a, b) => {
      const left = Number(seriesOf(bookOf(a))?.sequence ?? 0) || 0
      const right = Number(seriesOf(bookOf(b))?.sequence ?? 0) || 0
      return left - right || bookOf(a).metadata.title.localeCompare(bookOf(b).metadata.title, 'de')
    })
    return list
  }, [series])

  if (!abs) return <MissingAbs noun="Hörbuch" />
  if (result.error) return <p className="error">{result.error}</p>
  if (!series) return <p className="muted">Serie wird geladen …</p>

  return (
    <div className="view abs-detail">
      <header className="view-head">
        <div>
          <p className="eyebrow">Serie</p>
          <h2>{series.name}</h2>
          <p className="muted">
            {books.length} {books.length === 1 ? 'Band' : 'Bände'}
          </p>
        </div>
      </header>
      <div className={`album-grid ${layout.books === 'list' ? 'is-list' : ''}`}>
        {books.map((item) => (
          <BookCard
            key={item.id}
            item={item}
            onOpen={() => go({ name: 'abs-book', id: item.id })}
            onPlay={() => void playBook(item)}
          />
        ))}
      </div>
    </div>
  )
}
