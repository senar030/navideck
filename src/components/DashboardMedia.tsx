import { useMemo, type ReactNode } from 'react'
import { pickRandom } from '../lib/absHelpers'
import { useSessionSeed } from '../lib/sessionRandom'
import { useAbsPlayer } from '../lib/useAbsPlayer'
import {
  useAuthorList,
  useBookItems,
  useCollectionList,
  usePodcastItems,
  useProgressEpisodes,
  useRecentEpisodes,
  type EpisodeRef,
} from '../lib/useAbsLibrary'
import { useAccount } from '../state/AccountContext'
import { episodeView, useNav } from '../state/NavContext'
import { AuthorCard, BookCard, CollectionCard, EpisodeCard, PodcastCard } from './AbsParts'
import { DashBlock, Empty, ReshuffleButton, TileRow, type SectionProps } from './DashboardParts'

/*
 * The blocks that come from the audiobook and podcast servers. They read the
 * same hooks the rubric pages use, so every start page can show them without a
 * second set of views.
 */

function ContinueBooksSection(props: SectionProps) {
  const { progress } = useAccount()
  const books = useBookItems()
  const { playBook } = useAbsPlayer()
  const { go } = useNav()

  const cards: ReactNode[] = useMemo(() => {
    const byId = new Map((books.data ?? []).map((item) => [item.id, item]))
    return Object.values(progress)
      .filter((entry) => !entry.episodeId && !entry.isFinished && (entry.currentTime ?? 0) > 5)
      .sort((a, b) => (b.lastUpdate ?? 0) - (a.lastUpdate ?? 0))
      .slice(0, 12)
      .flatMap((entry) => {
        const book = byId.get(entry.libraryItemId)
        return book
          ? [
              <BookCard
                key={book.id}
                item={book}
                onOpen={() => go({ name: 'abs-book', id: book.id })}
                onPlay={() => void playBook(book)}
              />,
            ]
          : []
      })
  }, [books.data, progress, go, playBook])

  return (
    <DashBlock label="Weiterhören" {...props}>
      {books.error ? (
        <p className="error">{books.error}</p>
      ) : cards.length ? (
        <TileRow>{cards}</TileRow>
      ) : (
        <Empty>{books.loading ? 'Wird geladen…' : 'Hier ist noch nichts angefangen.'}</Empty>
      )}
    </DashBlock>
  )
}

function ContinuePodcastsSection(props: SectionProps) {
  const episodes = useProgressEpisodes()
  const { playEpisode } = useAbsPlayer()
  const { go } = useNav()

  const cards: ReactNode[] = useMemo(
    () =>
      (episodes.data ?? []).slice(0, 12).map((ref) => (
        <EpisodeCard
          key={`${ref.item.id}:${ref.episode.id}`}
          item={ref.item}
          episode={ref.episode}
          onOpen={() => go(episodeView(ref.item.id, ref.episode.id))}
          onPlay={() => void playEpisode(ref.item, ref.episode)}
        />
      )),
    [episodes.data, go, playEpisode],
  )

  return (
    <DashBlock label="Weiterhören" {...props}>
      {episodes.error ? (
        <p className="error">{episodes.error}</p>
      ) : cards.length ? (
        <TileRow>{cards}</TileRow>
      ) : (
        <Empty>{episodes.loading ? 'Wird geladen…' : 'Hier ist noch nichts angefangen.'}</Empty>
      )}
    </DashBlock>
  )
}

function ContinueAllSection(props: SectionProps) {
  const { progress } = useAccount()
  const books = useBookItems()
  const episodes = useProgressEpisodes()
  const { playBook, playEpisode } = useAbsPlayer()
  const { go } = useNav()

  const bookById = useMemo(
    () => new Map((books.data ?? []).map((item) => [item.id, item])),
    [books.data],
  )
  const episodeByKey = useMemo(() => {
    const map = new Map<string, EpisodeRef>()
    for (const ref of episodes.data ?? []) map.set(`${ref.item.id}:${ref.episode.id}`, ref)
    return map
  }, [episodes.data])

  const cards: ReactNode[] = useMemo(() => {
    const entries = Object.values(progress)
      .filter((entry) => !entry.isFinished && (entry.currentTime ?? 0) > 5)
      .sort((a, b) => (b.lastUpdate ?? 0) - (a.lastUpdate ?? 0))
      .slice(0, 12)
    const list: ReactNode[] = []
    for (const entry of entries) {
      if (entry.episodeId) {
        const ref = episodeByKey.get(`${entry.libraryItemId}:${entry.episodeId}`)
        if (!ref) continue
        list.push(
          <EpisodeCard
            key={`${ref.item.id}:${ref.episode.id}`}
            item={ref.item}
            episode={ref.episode}
            onOpen={() => go(episodeView(ref.item.id, ref.episode.id))}
            onPlay={() => void playEpisode(ref.item, ref.episode)}
          />,
        )
        continue
      }
      const book = bookById.get(entry.libraryItemId)
      if (!book) continue
      list.push(
        <BookCard
          key={book.id}
          item={book}
          onOpen={() => go({ name: 'abs-book', id: book.id })}
          onPlay={() => void playBook(book)}
        />,
      )
    }
    return list
  }, [progress, episodeByKey, bookById, go, playBook, playEpisode])

  const loading = books.loading || episodes.loading

  return (
    <DashBlock label="Weiterhören" {...props}>
      {books.error || episodes.error ? (
        <p className="error">{books.error || episodes.error}</p>
      ) : cards.length ? (
        <TileRow>{cards}</TileRow>
      ) : (
        <Empty>{loading ? 'Wird geladen…' : 'Hier ist noch nichts angefangen.'}</Empty>
      )}
    </DashBlock>
  )
}

function RandomBooksSection(props: SectionProps) {
  const books = useBookItems()
  const { go } = useNav()
  const [seed, reshuffle] = useSessionSeed('randomBooks')
  const items = useMemo(() => pickRandom(books.data ?? [], 14, seed), [books.data, seed])

  return (
    <DashBlock
      label="Zufällige Bücher"
      {...props}
      action={<ReshuffleButton loading={books.loading} onClick={reshuffle} />}
    >
      {books.error ? (
        <p className="error">{books.error}</p>
      ) : items.length ? (
        <TileRow>
          {items.map((item) => (
            <BookCard
              key={item.id}
              item={item}
              onOpen={() => go({ name: 'abs-book', id: item.id })}
            />
          ))}
        </TileRow>
      ) : (
        <Empty>{books.loading ? 'Bücher werden geladen…' : 'Keine Bücher gefunden.'}</Empty>
      )}
    </DashBlock>
  )
}

function RandomAuthorsSection(props: SectionProps) {
  const authors = useAuthorList()
  const { go } = useNav()
  const [seed, reshuffle] = useSessionSeed('randomAuthors')
  const items = useMemo(() => pickRandom(authors.data ?? [], 12, seed), [authors.data, seed])

  return (
    <DashBlock
      label="Zufällige Autoren"
      {...props}
      action={<ReshuffleButton loading={authors.loading} onClick={reshuffle} />}
    >
      {authors.error ? (
        <p className="error">{authors.error}</p>
      ) : items.length ? (
        <TileRow>
          {items.map((author) => (
            <AuthorCard
              key={author.id}
              author={author}
              onOpen={() => go({ name: 'abs-author', id: author.id })}
            />
          ))}
        </TileRow>
      ) : (
        <Empty>{authors.loading ? 'Autoren werden geladen…' : 'Keine Autoren gefunden.'}</Empty>
      )}
    </DashBlock>
  )
}

function CollectionsSection(props: SectionProps) {
  const collections = useCollectionList()
  const { go } = useNav()

  return (
    <DashBlock label="Sammlungen" {...props}>
      {collections.error ? (
        <p className="error">{collections.error}</p>
      ) : collections.data?.length ? (
        <TileRow>
          {collections.data.map((collection) => (
            <CollectionCard
              key={collection.id}
              collection={collection}
              onOpen={() => go({ name: 'abs-collection', id: collection.id })}
            />
          ))}
        </TileRow>
      ) : (
        <Empty>{collections.loading ? 'Sammlungen werden geladen…' : 'Keine Sammlungen.'}</Empty>
      )}
    </DashBlock>
  )
}

function LatestEpisodesSection(props: SectionProps) {
  const latest = useRecentEpisodes(12)
  const { playEpisode } = useAbsPlayer()
  const { go } = useNav()
  const refs = latest.data ?? []

  return (
    <DashBlock label="Neueste Episoden" {...props}>
      {latest.error ? (
        <p className="error">{latest.error}</p>
      ) : refs.length ? (
        <TileRow>
          {refs.map((ref) => (
            <EpisodeCard
              key={`${ref.item.id}:${ref.episode.id}`}
              item={ref.item}
              episode={ref.episode}
              onOpen={() => go(episodeView(ref.item.id, ref.episode.id))}
              onPlay={() => void playEpisode(ref.item, ref.episode)}
            />
          ))}
        </TileRow>
      ) : (
        <Empty>{latest.loading ? 'Episoden werden geladen…' : 'Noch keine Episoden.'}</Empty>
      )}
    </DashBlock>
  )
}

function PodcastShowsSection(props: SectionProps) {
  const shows = usePodcastItems()
  const { go } = useNav()

  return (
    <DashBlock label="Podcasts" {...props}>
      {shows.error ? (
        <p className="error">{shows.error}</p>
      ) : shows.data?.length ? (
        <TileRow>
          {shows.data.map((item) => (
            <PodcastCard
              key={item.id}
              item={item}
              onOpen={() => go({ name: 'podcast', id: item.id })}
            />
          ))}
        </TileRow>
      ) : (
        <Empty>{shows.loading ? 'Podcasts werden geladen…' : 'Noch keine Podcasts.'}</Empty>
      )}
    </DashBlock>
  )
}

export {
  CollectionsSection,
  ContinueAllSection,
  ContinueBooksSection,
  ContinuePodcastsSection,
  LatestEpisodesSection,
  PodcastShowsSection,
  RandomAuthorsSection,
  RandomBooksSection,
}
