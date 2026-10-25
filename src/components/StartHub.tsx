import { useMemo, useState, type ReactNode } from 'react'
import { useBookItems, useAllEpisodes } from '../lib/useAbsLibrary'
import { useAuth } from '../state/AuthContext'
import { usePlayer } from '../state/PlayerContext'
import { usePrefs } from '../state/PrefsContext'
import { useAccount, type SourceHealth } from '../state/AccountContext'
import { useNav, type View } from '../state/NavContext'
import { DashboardBoard } from './DashboardBoard'
import { IconAlbums, IconArrowRight, IconBook, IconPodcast, IconSpark } from './Icons'
import { ResumePlaying } from './ResumePlaying'

/** v1: the aggregated start page, one order for every area's widgets. */
const START_KEY = 'navideck.dashboard.start.v1'

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
 * The app's own start page. It opens with the one action that needs no thought
 * (a random mix), then the widgets of every area in one customizable order.
 */
export function StartHub() {
  const { profile, music, abs, podcasts, sources, health } = useAccount()
  const { go } = useNav()
  const { client } = useAuth()
  const { playTracks } = usePlayer()
  const { mixSize } = usePrefs()
  const books = useBookItems()
  const episodes = useAllEpisodes()
  const [mixing, setMixing] = useState(false)
  const [mixError, setMixError] = useState('')

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

  async function instantMix() {
    if (!client || mixing) return
    setMixing(true)
    setMixError('')
    try {
      const songs = await client.getRandomSongs(mixSize)
      if (songs.length) playTracks(songs, 0)
      else setMixError('Der Server hat keine Titel für einen Mix gefunden.')
    } catch (err) {
      setMixError(err instanceof Error ? err.message : 'Der Mix konnte nicht erstellt werden.')
    } finally {
      setMixing(false)
    }
  }

  return (
    <div className="view start-view">
      {client ? (
        <div className="instant-mix-wrap">
          <button
            type="button"
            className={`instant-mix ${mixing ? 'is-busy' : ''}`}
            disabled={mixing}
            onClick={() => void instantMix()}
          >
            <span className="instant-mix-icon" aria-hidden>
              <IconSpark size={28} />
            </span>
            <span className="instant-mix-text">
              <strong>{mixing ? 'Mix wird erstellt…' : 'Sofort-Mix'}</strong>
              <small>{mixSize} zufällige Titel aus deiner Bibliothek</small>
            </span>
            <IconArrowRight size={20} />
          </button>
          {mixError ? <p className="error">{mixError}</p> : null}
        </div>
      ) : null}

      <ResumePlaying />

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
