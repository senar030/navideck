import { useMemo, type ReactNode } from 'react'
import { useBookItems, useAllEpisodes } from '../lib/useAbsLibrary'
import { useAccount, type SourceHealth } from '../state/AccountContext'
import { useNav, type View } from '../state/NavContext'
import { DashboardBoard } from './DashboardBoard'
import { IconAlbums, IconArrowRight, IconBook, IconPodcast } from './Icons'
import { MarqueeText } from './MarqueeText'

/** v2: the instant mix became a widget of its own. */
const START_KEY = 'navideck.dashboard.start.v2'

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
 * The app's own start page: every area's widgets in one customizable order,
 * with the instant mix as the first of them.
 */
export function StartHub() {
  const { profile, music, abs, podcasts, sources, health } = useAccount()
  const { go } = useNav()
  const books = useBookItems()
  const episodes = useAllEpisodes()

  const showCount = useMemo(
    () => new Set((episodes.data ?? []).map((ref) => ref.item.id)).size,
    [episodes.data],
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
      <DashboardBoard
        storageKey={START_KEY}
        scope="all"
        renderHead={({ edit, toggle }) => (
          <div className="start-top">
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
            <button type="button" className={`chip ${edit ? 'is-on' : ''}`} onClick={toggle}>
              {edit ? 'Fertig' : 'Anpassen'}
            </button>
          </div>
        )}
      />

      <section className="start-spaces">
        <h3 className="start-sub">Bereiche</h3>
        {spaces.map((space) => (
          <button key={space.id} type="button" className="start-space" onClick={() => go(space.view)}>
            <span className="start-space-icon" aria-hidden>
              {space.icon}
            </span>
            <span className="start-space-text">
              <MarqueeText className="start-space-name">{space.label}</MarqueeText>
              <MarqueeText className="start-space-hint muted">{space.hint}</MarqueeText>
            </span>
            <IconArrowRight size={18} />
          </button>
        ))}
      </section>
    </div>
  )
}
