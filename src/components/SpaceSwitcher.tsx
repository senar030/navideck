import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useAccount } from '../state/AccountContext'
import { spaceOf, useNav, type Space, type View } from '../state/NavContext'
import {
  IconAlbums,
  IconBook,
  IconCheck,
  IconHome,
  IconPodcast,
} from './Icons'

type Entry = { id: Space; label: string; hint: string; icon: ReactNode; view: View }

const MENU_WIDTH = 17 * 16

/* Beside the rail button, below the top-bar button. */
function positionFor(button: HTMLElement): { top: number; left: number } {
  const rect = button.getBoundingClientRect()
  const rail = button.closest('.nav')
  const width = Math.min(MENU_WIDTH, window.innerWidth - 16)
  /* Clear the whole rail, not just the button: the button sits inset. */
  const left = rail ? rail.getBoundingClientRect().right + 8 : rect.left
  return {
    left: Math.max(8, Math.min(left, window.innerWidth - width - 8)),
    top: Math.max(8, Math.min(rail ? rect.top : rect.bottom + 6, window.innerHeight - 8)),
  }
}

/**
 * The button in the top left corner: which part of the deck you are in, and the
 * way to the others. Areas appear only when a server actually offers them —
 * "Podcasts" for a server without a podcast library would be an empty room.
 *
 * The button itself is only the mark; the names belong in the menu it opens.
 * The menu is drawn in a portal because the desktop rail clips its children and
 * a frosted panel cannot hold a fixed element of its own.
 */
export function SpaceSwitcher() {
  const { view, parent, go } = useNav()
  const { music, abs } = useAccount()
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const anchor = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  /* Settings is drawn on top of an area; the switcher should still name it. */
  const space = spaceOf(view.name === 'settings' && parent ? parent : view)

  /* A known empty library hides its area; an unknown one still offers it. */
  const showBooks = Boolean(abs && (abs.books || !abs.libraries.length))
  const showPodcasts = Boolean(abs && (abs.podcasts || !abs.libraries.length))

  /*
   * Where the menu goes: beside the rail button, below the top-bar button.
   * Measured on the click, so a rotated window or a scrolled page cannot leave
   * it pointing at where the button used to be.
   */
  function place(): boolean {
    const button = anchor.current
    if (!button) return false
    setPos(positionFor(button))
    return true
  }
  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      const target = e.target as Node
      if (anchor.current?.contains(target) || menu.current?.contains(target)) return
      setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    /* The window changed, the button moved with it: follow instead of closing. */
    function onResize() {
      const button = anchor.current
      if (button) setPos(positionFor(button))
    }
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
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
            hint: music.kind === 'subsonic' ? 'Subsonic' : 'Navidrome',
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
  ]

  const current = entries.find((entry) => entry.id === space) ?? entries[0]

  return (
    <div className="space-switch">
      <button
        ref={anchor}
        type="button"
        className={`space-btn ${open ? 'is-on' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Bereich wechseln – aktuell ${current.label}`}
        onClick={() => {
          if (open) {
            setOpen(false)
            return
          }
          if (place()) setOpen(true)
        }}
      >
        <span className="space-mark" aria-hidden>
          {current.icon}
        </span>
      </button>
      {open && pos
        ? createPortal(
            <div
              ref={menu}
              className="space-menu is-floating"
              role="menu"
              style={{ top: pos.top, left: pos.left }}
            >
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
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
