import { useMemo, useState } from 'react'
import type { AbsLibraryItem } from '../api/abs'
import { pickRandom, sortBooks, type BookSort } from '../lib/absHelpers'
import { useAbsPlayer } from '../lib/useAbsPlayer'
import { useAuthorList, useBookItems, useCollectionList, useSeriesList } from '../lib/useAbsLibrary'
import { useAccount } from '../state/AccountContext'
import { useNav } from '../state/NavContext'
import {
  AuthorCard,
  BookCard,
  CollectionCard,
  MissingAbs,
  SeriesCard,
  Shelf,
  ShuffleButton,
  SortChips,
} from './AbsParts'

const BOOK_SORTS: { id: BookSort; label: string }[] = [
  { id: 'title', label: 'Titel' },
  { id: 'author', label: 'Autor' },
  { id: 'added', label: 'Hinzugefügt' },
  { id: 'year', label: 'Jahr' },
  { id: 'duration', label: 'Länge' },
]

export function AudiobookHome() {
  const { abs, progress } = useAccount()
  const { go } = useNav()
  const books = useBookItems()
  const authors = useAuthorList()
  const collections = useCollectionList()
  const { playBook } = useAbsPlayer()
  const [seed, setSeed] = useState(0)

  const items = useMemo(() => books.data ?? [], [books.data])
  const byId = useMemo(() => new Map(items.map((item) => [item.id, item])), [items])

  /* Everything started but not finished, most recent first. */
  const continuing = useMemo(
    () =>
      Object.values(progress)
        .filter((entry) => !entry.episodeId && !entry.isFinished && (entry.currentTime ?? 0) > 5)
        .sort((a, b) => (b.lastUpdate ?? 0) - (a.lastUpdate ?? 0))
        .map((entry) => byId.get(entry.libraryItemId))
        .filter((item): item is AbsLibraryItem => Boolean(item))
        .slice(0, 10),
    [byId, progress],
  )

  const randomBooks = useMemo(() => pickRandom(items, 14, seed), [items, seed])
  const randomAuthors = useMemo(() => pickRandom(authors.data ?? [], 12, seed), [authors.data, seed])
  const shelves = collections.data ?? []

  if (!abs?.books) return <MissingAbs noun="Hörbuch" />

  const library = abs.books.name
  const sub = items.length
    ? `${items.length} Bücher${library && library !== 'Hörbücher' ? ` · ${library}` : ''}`
    : library

  return (
    <div className="view abs-view">
      <header className="view-head">
        <div>
          <h2>Hörbücher</h2>
          <p className="muted">{sub}</p>
        </div>
      </header>

      {books.error ? <p className="error">{books.error}</p> : null}
      {books.loading && !books.data ? <p className="muted">Wird geladen …</p> : null}

      {continuing.length ? (
        <Shelf title="Weiterhören" hint="Zuletzt gehört">
          {continuing.map((item) => (
            <BookCard
              key={item.id}
              item={item}
              onOpen={() => go({ name: 'abs-book', id: item.id })}
              onPlay={() => void playBook(item)}
            />
          ))}
        </Shelf>
      ) : null}

      {randomBooks.length ? (
        <Shelf title="Zufällige Bücher" action={<ShuffleButton onClick={() => setSeed((n) => n + 1)} />}>
          {randomBooks.map((item) => (
            <BookCard
              key={item.id}
              item={item}
              onOpen={() => go({ name: 'abs-book', id: item.id })}
            />
          ))}
        </Shelf>
      ) : null}

      {randomAuthors.length ? (
        <Shelf title="Zufällige Autoren" action={<ShuffleButton onClick={() => setSeed((n) => n + 1)} />}>
          {randomAuthors.map((author) => (
            <AuthorCard
              key={author.id}
              author={author}
              onOpen={() => go({ name: 'abs-author', id: author.id })}
            />
          ))}
        </Shelf>
      ) : null}

      {shelves.length ? (
        <Shelf title="Sammlungen">
          {shelves.map((collection) => (
            <CollectionCard
              key={collection.id}
              collection={collection}
              onOpen={() => go({ name: 'abs-collection', id: collection.id })}
            />
          ))}
        </Shelf>
      ) : null}
    </div>
  )
}

export function BooksView() {
  const { abs } = useAccount()
  const { go } = useNav()
  const books = useBookItems()
  const [sort, setSort] = useState<BookSort>('title')
  const [desc, setDesc] = useState(false)

  const list = useMemo(() => sortBooks(books.data ?? [], sort, desc), [books.data, sort, desc])

  if (!abs?.books) return <MissingAbs noun="Hörbuch" />

  return (
    <div className="view abs-view">
      <header className="view-head">
        <div>
          <h2>Bücher</h2>
          <p className="muted">{list.length ? `${list.length} Hörbücher` : abs.books.name}</p>
        </div>
        <SortChips
          options={BOOK_SORTS}
          value={sort}
          desc={desc}
          onChange={setSort}
          onDesc={() => setDesc((d) => !d)}
          ascLabel="↑ Aufsteigend"
          descLabel="↓ Absteigend"
        />
      </header>

      {books.error ? <p className="error">{books.error}</p> : null}
      {books.loading && !books.data ? <p className="muted">Wird geladen …</p> : null}
      {!books.loading && !books.error && !list.length ? <p className="muted">Noch keine Bücher.</p> : null}

      <div className="album-grid">
        {list.map((item) => (
          <BookCard key={item.id} item={item} onOpen={() => go({ name: 'abs-book', id: item.id })} />
        ))}
      </div>
    </div>
  )
}

export function AuthorsView() {
  const { abs } = useAccount()
  const { go } = useNav()
  const authors = useAuthorList()
  const [byCount, setByCount] = useState(false)

  const list = useMemo(() => {
    const copy = [...(authors.data ?? [])]
    copy.sort((a, b) =>
      byCount
        ? (b.numBooks ?? 0) - (a.numBooks ?? 0) || a.name.localeCompare(b.name, 'de', { sensitivity: 'base' })
        : a.name.localeCompare(b.name, 'de', { sensitivity: 'base', numeric: true }),
    )
    return copy
  }, [authors.data, byCount])

  if (!abs?.books) return <MissingAbs noun="Hörbuch" />

  return (
    <div className="view abs-view">
      <header className="view-head">
        <div>
          <h2>Autoren</h2>
          <p className="muted">{list.length ? `${list.length} Autoren` : abs.books.name}</p>
        </div>
        <div className="view-head-tools">
          <div className="chip-row">
            <button type="button" className={`chip ${byCount ? '' : 'is-on'}`} onClick={() => setByCount(false)}>
              A–Z
            </button>
            <button type="button" className={`chip ${byCount ? 'is-on' : ''}`} onClick={() => setByCount(true)}>
              Meiste Bücher
            </button>
          </div>
        </div>
      </header>

      {authors.error ? <p className="error">{authors.error}</p> : null}
      {authors.loading && !authors.data ? <p className="muted">Wird geladen …</p> : null}
      {!authors.loading && !authors.error && !list.length ? <p className="muted">Noch keine Autoren.</p> : null}

      <div className="artist-list is-grid abs-authors">
        {list.map((author) => (
          <AuthorCard
            key={author.id}
            author={author}
            onOpen={() => go({ name: 'abs-author', id: author.id })}
          />
        ))}
      </div>
    </div>
  )
}

export function CollectionsView() {
  const { abs } = useAccount()
  const { go } = useNav()
  const collections = useCollectionList()
  const series = useSeriesList()
  const [tab, setTab] = useState<'collections' | 'series'>('collections')

  if (!abs?.books) return <MissingAbs noun="Hörbuch" />

  return (
    <div className="view abs-view">
      <header className="view-head">
        <div>
          <h2>Sammlungen</h2>
          <p className="muted">
            Sammlungen stellst du selbst zusammen, Serien kommen aus den Buchdaten.
          </p>
        </div>
        <div className="view-head-tools">
          <div className="chip-row">
            <button
              type="button"
              className={`chip ${tab === 'collections' ? 'is-on' : ''}`}
              onClick={() => setTab('collections')}
            >
              Sammlungen
            </button>
            <button
              type="button"
              className={`chip ${tab === 'series' ? 'is-on' : ''}`}
              onClick={() => setTab('series')}
            >
              Serien
            </button>
          </div>
        </div>
      </header>

      {tab === 'collections' ? (
        <>
          {collections.error ? <p className="error">{collections.error}</p> : null}
          {collections.loading && !collections.data ? <p className="muted">Wird geladen …</p> : null}
          {!collections.loading && !collections.data?.length ? (
            <p className="muted">Noch keine Sammlungen.</p>
          ) : null}
          <div className="abs-collections">
            {(collections.data ?? []).map((collection) => (
              <CollectionCard
                key={collection.id}
                collection={collection}
                onOpen={() => go({ name: 'abs-collection', id: collection.id })}
              />
            ))}
          </div>
        </>
      ) : (
        <>
          {series.error ? <p className="error">{series.error}</p> : null}
          {series.loading && !series.data ? <p className="muted">Wird geladen …</p> : null}
          {!series.loading && !series.data?.length ? <p className="muted">Noch keine Serien.</p> : null}
          <div className="abs-collections">
            {(series.data ?? []).map((entry) => (
              <SeriesCard
                key={entry.id}
                series={entry}
                onOpen={() => go({ name: 'abs-series', id: entry.id })}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
