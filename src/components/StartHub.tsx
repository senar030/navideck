import { useMemo, type ReactNode } from 'react'
import { useAbsPlayer } from '../lib/useAbsPlayer'
import { useBookItems, useAllEpisodes } from '../lib/useAbsLibrary'
import { useAccount, type SourceHealth } from '../state/AccountContext'
import { useNav, type View } from '../state/NavContext'
import { BookCard, EpisodeCard, Shelf } from './AbsParts'
import { IconAlbums, IconArrowRight, IconBook, IconPodcast } from './Icons'
import { ResumePlaying } from './ResumePlaying'

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 11) return 'Guten Morgen'
  if (hour < 18) return 'Hallo'
  return 'Guten Abend'
}

function healthLabel(state: SourceHealth | undefined): string {
  if (!state || state.status === 'checking') return 'wird geprüft …'
  if (state.status === 'error') return 'nicht erreichbar'
  return 'verbunden'
}

/*
 * The account's own start page. It deliberately holds little: whatever was
 * playing, the way back into it, and the doors into the three areas. What
 * "Start" should become is still open, so this is the honest placeholder.
 */
export function StartHub() {
  const { profile, music, abs, podcasts, sources, health, progress } = useAccount()
  const { go } = useNav()
  const { playBook, playEpisode } = useAbsPlayer()
  const books = useBookItems()
  const episodes = useAllEpisodes()

  const bookById = useMemo(() => new Map((books.data ?? []).map((item) => [item.id, item])), [books.data])
  const refs = useMemo(() => episodes.data ?? [], [episodes.data])
  const episodeByKey = useMemo(() => {
    const map = new Map<string, (typeof refs)[number]>()
    for (const ref of refs) map.set(`${ref.item.id}:${ref.episode.id}`, ref)
    return map
  }, [refs])
  const showCount = useMemo(
    () => new Set(refs.map((ref) => ref.item.id)).size,
    [refs],
  )

  const continuing = useMemo(
    () =>
      Object.values(progress)
        .filter((entry) => !entry.isFinished && (entry.currentTime ?? 0) > 5)
        .sort((a, b) => (b.lastUpdate ?? 0) - (a.lastUpdate ?? 0))
        .slice(0, 12),
    [progress],
  )

  const spaces: { id: string; label: string; hint: string; icon: ReactNode; view: View }[] = []

  /*
   * A server named after the area it feeds would only repeat the label; its
   * name earns a place in the line when it says something of its own.
   */
  const sourceLine = (sourceName: string, label: string, rest: string) =>
    sourceName === label ? rest : `${sourceName} · ${rest}`

  if (music) {
    spaces.push({
      id: 'music',
      label: 'Musik',
      hint: sourceLine(music.name, 'Musik', healthLabel(health[music.id])),
      icon: <IconAlbums />,
      view: { name: 'home' },
    })
  }
  if (abs && (abs.books || !abs.libraries.length)) {
    spaces.push({
      id: 'books',
      label: 'Hörbücher',
      hint: books.data?.length
        ? sourceLine(abs.source.name, 'Hörbücher', `${books.data.length} Bücher`)
        : sourceLine(abs.source.name, 'Hörbücher', healthLabel(health[abs.source.id])),
      icon: <IconBook />,
      view: { name: 'ab-home' },
    })
  }
  if (podcasts) {
    spaces.push({
      id: 'podcasts',
      label: 'Podcasts',
      hint: showCount
        ? sourceLine(podcasts.name, 'Podcasts', `${showCount} Podcasts`)
        : sourceLine(podcasts.name, 'Podcasts', healthLabel(health[podcasts.sourceId])),
      icon: <IconPodcast />,
      view: { name: 'pod-home' },
    })
  }

  return (
    <div className="view start-view">
      <ResumePlaying />

      <header className="start-head">
        <p className="eyebrow">Start</p>
        <h2>
          {greeting()}
          {profile ? `, ${profile}` : ''}
        </h2>
        <p className="muted">
          {sources.length > 1
            ? 'Deine Musik, Hörbücher und Podcasts an einem Ort.'
            : 'Alles, was auf deinen Servern liegt, an einem Ort.'}
        </p>
      </header>

      {continuing.length ? (
        <Shelf title="Weiterhören">
          {continuing.map((entry) => {
            if (entry.episodeId) {
              const ref = episodeByKey.get(`${entry.libraryItemId}:${entry.episodeId}`)
              if (!ref) return null
              return (
                <EpisodeCard
                  key={`${ref.item.id}:${ref.episode.id}`}
                  item={ref.item}
                  episode={ref.episode}
                  onOpen={() => go({ name: 'podcast', id: ref.item.id })}
                  onPlay={() => void playEpisode(ref.item, ref.episode)}
                />
              )
            }
            const book = bookById.get(entry.libraryItemId)
            if (!book) return null
            return (
              <BookCard
                key={book.id}
                item={book}
                onOpen={() => go({ name: 'abs-book', id: book.id })}
                onPlay={() => void playBook(book)}
              />
            )
          })}
        </Shelf>
      ) : null}

      <section className="start-spaces">
        <h3 className="start-sub">Bereiche</h3>
        {spaces.map((space) => (
          <button key={space.id} type="button" className="start-space" onClick={() => go(space.view)}>
            <span className="start-space-icon" aria-hidden>
              {space.icon}
            </span>
            <span className="start-space-text">
              <strong>{space.label}</strong>
              <span className="muted">{space.hint}</span>
            </span>
            <IconArrowRight size={18} />
          </button>
        ))}
      </section>
    </div>
  )
}
