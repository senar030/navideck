import { useMemo, useState } from 'react'
import { sortBooks, type BookSort } from '../lib/absHelpers'
import { useAbsPlayer } from '../lib/useAbsPlayer'
import { useAuthorList, useBookItems, useCollectionList, useSeriesList } from '../lib/useAbsLibrary'
import { useAccount } from '../state/AccountContext'
import { useNav } from '../state/NavContext'
import { usePrefs } from '../state/PrefsContext'
import {
  AuthorCard,
  BookCard,
  CollectionCard,
  MissingAbs,
  SeriesCard,
} from './AbsParts'
import { SortMenu } from './SortMenu'
import { LayoutToggle } from './LayoutToggle'
import { DashboardBoard } from './DashboardBoard'

const BOOK_SORTS: { id: BookSort; label: string }[] = [
  { id: 'title', label: 'Titel' },
  { id: 'author', label: 'Autor' },
  { id: 'added', label: 'Hinzugefügt' },
  { id: 'year', label: 'Jahr' },
  { id: 'duration', label: 'Länge' },
]

const AUTHOR_SORTS: { id: 'name' | 'books'; label: string; defaultDesc?: boolean }[] = [
  { id: 'name', label: 'Name' },
  { id: 'books', label: 'Anzahl Bücher', defaultDesc: true },
]

export function AudiobookHome() {
  const { abs } = useAccount()

  if (!abs?.books) return <MissingAbs noun="Hörbuch" />

  return (
    <div className="view abs-view">
      <DashboardBoard
        storageKey="navideck.dashboard.books.v1"
        scope="books"
        renderHead={({ edit, toggle }) => (
          <header className="view-head">
            <h2>Hörbücher</h2>
            <button type="button" className={`chip ${edit ? 'is-on' : ''}`} onClick={toggle}>
              {edit ? 'Fertig' : 'Anpassen'}
            </button>
          </header>
        )}
      />
    </div>
  )
}

export function BooksView() {
  const { abs } = useAccount()
  const { go } = useNav()
  const { layout } = usePrefs()
  const { playBook } = useAbsPlayer()
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
        <div className="view-head-tools">
          <SortMenu
            options={BOOK_SORTS}
            value={sort}
            desc={desc}
            onChange={(next, nextDesc) => {
              setSort(next)
              setDesc(nextDesc)
            }}
          />
          <LayoutToggle section="books" />
        </div>
      </header>

      {books.error ? <p className="error">{books.error}</p> : null}
      {books.loading && !books.data ? <p className="muted">Wird geladen …</p> : null}
      {!books.loading && !books.error && !list.length ? <p className="muted">Noch keine Bücher.</p> : null}

      <div className={`album-grid ${layout.books === 'list' ? 'is-list' : ''}`}>
        {list.map((item) => (
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

export function AuthorsView() {
  const { abs } = useAccount()
  const { go } = useNav()
  const { layout } = usePrefs()
  const authors = useAuthorList()
  const [sort, setSort] = useState<'name' | 'books'>('name')
  const [desc, setDesc] = useState(false)

  const list = useMemo(() => {
    const copy = [...(authors.data ?? [])]
    copy.sort((a, b) => {
      if (sort === 'books') {
        const diff = (a.numBooks ?? 0) - (b.numBooks ?? 0)
        if (diff !== 0) return desc ? -diff : diff
      }
      const cmp = a.name.localeCompare(b.name, 'de', { sensitivity: 'base', numeric: true })
      return sort === 'name' && desc ? -cmp : cmp
    })
    return copy
  }, [authors.data, sort, desc])

  if (!abs?.books) return <MissingAbs noun="Hörbuch" />

  return (
    <div className="view abs-view">
      <header className="view-head">
        <div>
          <h2>Autoren</h2>
          <p className="muted">{list.length ? `${list.length} Autoren` : abs.books.name}</p>
        </div>
        <div className="view-head-tools">
          <SortMenu
            options={AUTHOR_SORTS}
            value={sort}
            desc={desc}
            onChange={(next, nextDesc) => {
              setSort(next)
              setDesc(nextDesc)
            }}
          />
          <LayoutToggle section="absAuthors" />
        </div>
      </header>

      {authors.error ? <p className="error">{authors.error}</p> : null}
      {authors.loading && !authors.data ? <p className="muted">Wird geladen …</p> : null}
      {!authors.loading && !authors.error && !list.length ? <p className="muted">Noch keine Autoren.</p> : null}

      <div className={`artist-list abs-authors ${layout.absAuthors === 'grid' ? 'is-grid' : ''}`}>
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
  const { layout } = usePrefs()
  const collections = useCollectionList()
  const series = useSeriesList()
  const [tab, setTab] = useState<'collections' | 'series'>('collections')

  if (!abs?.books) return <MissingAbs noun="Hörbuch" />

  const gridClass = `album-grid abs-collections ${layout.absCollections === 'list' ? 'is-list' : ''}`

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
          <LayoutToggle section="absCollections" />
        </div>
      </header>

      {tab === 'collections' ? (
        <>
          {collections.error ? <p className="error">{collections.error}</p> : null}
          {collections.loading && !collections.data ? <p className="muted">Wird geladen …</p> : null}
          {!collections.loading && !collections.data?.length ? (
            <p className="muted">Noch keine Sammlungen.</p>
          ) : null}
          <div className={gridClass}>
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
          <div className={gridClass}>
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
