import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useAccount } from '../state/AccountContext'
import { spaceOf, useNav, type Space, type View } from '../state/NavContext'
import {
  IconAlbums,
  IconBook,
  IconCheck,
  IconChevron,
  IconHome,
  IconPodcast,
  IconUser,
} from './Icons'

type Entry = { id: Space; label: string; hint: string; icon: ReactNode; view: View }

/**
 * The button in the top left corner: which part of the deck you are in, and the
 * way to the others. Areas appear only when a server actually offers them —
 * "Podcasts" for a server without a podcast library would be an empty room.
 */
export function SpaceSwitcher() {
  const { view, go } = useNav()
  const { music, abs } = useAccount()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const space = spaceOf(view)

  /* A known empty library hides its area; an unknown one still offers it. */
  const showBooks = Boolean(abs && (abs.books || !abs.libraries.length))
  const showPodcasts = Boolean(abs && (abs.podcasts || !abs.libraries.length))

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  /* Any navigation closes the menu, including one started elsewhere. */
  const [lastView, setLastView] = useState(view)
  if (lastView !== view) {
    setLastView(view)
    if (open) setOpen(false)
  }

  const entries: Entry[] = [
    { id: 'start', label: 'Start', hint: 'Alles auf einen Blick', icon: <IconHome />, view: { name: 'start' } },
    ...(music
      ? [
          {
            id: 'music' as const,
            label: 'Musik',
            hint: 'Navidrome',
            icon: <IconAlbums />,
            view: { name: 'home' } as View,
          },
        ]
      : []),
    ...(showBooks
      ? [
          {
            id: 'audiobooks' as const,
            label: 'Hörbücher',
            hint: 'Audiobookshelf',
            icon: <IconBook />,
            view: { name: 'ab-home' } as View,
          },
        ]
      : []),
    ...(showPodcasts
      ? [
          {
            id: 'podcasts' as const,
            label: 'Podcasts',
            hint: 'Audiobookshelf',
            icon: <IconPodcast />,
            view: { name: 'pod-home' } as View,
          },
        ]
      : []),
    { id: 'account', label: 'Konto & Server', hint: 'Server, Profil, Geräte', icon: <IconUser />, view: { name: 'account' } },
  ]

  const current = entries.find((entry) => entry.id === space) ?? entries[0]

  return (
    <div className="space-switch" ref={ref}>
      <button
        type="button"
        className={`space-btn ${open ? 'is-on' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Bereich wechseln – aktuell ${current.label}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="space-mark" aria-hidden>
          {current.icon}
        </span>
        <span className="space-name">{current.label}</span>
        <IconChevron size={16} />
      </button>
      {open ? (
        <div className="space-menu" role="menu">
          {entries.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="menuitem"
              className={`space-item ${space === entry.id ? 'is-on' : ''}`}
              onClick={() => {
                setOpen(false)
                go(entry.view)
              }}
            >
              <span className="space-item-icon" aria-hidden>
                {entry.icon}
              </span>
              <span className="space-item-text">
                <strong>{entry.label}</strong>
                <small>{entry.hint}</small>
              </span>
              {space === entry.id ? <IconCheck size={16} /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
