import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAccount } from '../state/AccountContext'
import type { SectionId } from './DashboardParts'
import {
  DEFAULT_BOOK_SECTIONS,
  DEFAULT_PODCAST_SECTIONS,
  DEFAULT_SECTIONS,
  DEFAULT_START_SECTIONS,
  SECTIONS,
  sectionById,
} from './DashboardRegistry'

/*
 * The customizable part of a start page: which widgets are shown, in which
 * order, and the edit mode that changes it. The music start page passes only
 * music widgets, the app start page passes everything the connected servers
 * offer. Moving a widget animates the other ones out of the way.
 */

function readSections(key: string, fallback: SectionId[]): SectionId[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return [...fallback]
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return [...fallback]
    /* An empty list is a decision, not a broken record: keep it empty. */
    return parsed.filter((id): id is SectionId => SECTIONS.some((section) => section.id === id))
  } catch {
    return [...fallback]
  }
}

type BoardProps = {
  storageKey: string
  scope: 'music' | 'books' | 'podcasts' | 'all'
  renderHead: (state: { edit: boolean; toggle: () => void }) => ReactNode
}

function defaultsFor(scope: BoardProps['scope']): SectionId[] {
  if (scope === 'music') return DEFAULT_SECTIONS
  if (scope === 'books') return DEFAULT_BOOK_SECTIONS
  if (scope === 'podcasts') return DEFAULT_PODCAST_SECTIONS
  return DEFAULT_START_SECTIONS
}

export function DashboardBoard({ storageKey, scope, renderHead }: BoardProps) {
  const { music, abs, podcasts } = useAccount()
  const [sections, setSections] = useState<SectionId[]>(() =>
    readSections(storageKey, defaultsFor(scope)),
  )
  const [edit, setEdit] = useState(false)

  const available = useMemo(() => {
    const has = {
      music: Boolean(music),
      books: Boolean(abs?.books),
      podcasts: Boolean(podcasts),
    }
    return SECTIONS.filter((section) => {
      if (scope === 'music') return section.scope === 'music' && has.music
      if (scope === 'books') return section.scope === 'books' && has.books
      if (scope === 'podcasts') return section.scope === 'podcasts' && has.podcasts
      if (section.scope === 'music') return has.music
      if (section.scope === 'books') return has.books
      if (section.scope === 'podcasts') return has.podcasts
      return has.books || has.podcasts
    })
  }, [scope, music, abs, podcasts])

  const availableIds = useMemo(() => new Set(available.map((section) => section.id)), [available])
  const ids = useMemo(
    () => sections.filter((id) => availableIds.has(id)),
    [sections, availableIds],
  )
  const unused = available.filter((section) => !ids.includes(section.id))

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(sections))
    } catch {
      /* a full quota must not break the start page */
    }
  }, [sections, storageKey])

  const items = useRef(new Map<SectionId, HTMLDivElement>())
  const previous = useRef(new Map<SectionId, DOMRect>())

  function capture() {
    const rects = new Map<SectionId, DOMRect>()
    for (const [id, element] of items.current) rects.set(id, element.getBoundingClientRect())
    previous.current = rects
  }

  function commit(next: SectionId[]) {
    const hidden = sections.filter((id) => !availableIds.has(id))
    setSections([...next, ...hidden])
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir
    if (target < 0 || target >= ids.length) return
    capture()
    const next = [...ids]
    const swap = next[index]
    next[index] = next[target]
    next[target] = swap
    commit(next)
  }

  function remove(id: SectionId) {
    capture()
    commit(ids.filter((entry) => entry !== id))
  }

  function add(id: SectionId) {
    capture()
    commit([...ids, id])
  }

  /*
   * FLIP: remember where every widget was, and after the new order is in the
   * DOM let it slide from its old place to the new one. The browser handles the
   * frames; nothing here runs during playback or scrolling.
   */
  useLayoutEffect(() => {
    const rects = previous.current
    previous.current = new Map()
    if (!rects.size) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    for (const [id, element] of items.current) {
      const before = rects.get(id)
      if (!before) continue
      const after = element.getBoundingClientRect()
      const shift = before.top - after.top
      if (Math.abs(shift) < 2) continue
      element.animate(
        [{ transform: `translateY(${shift}px)` }, { transform: 'translateY(0)' }],
        { duration: 280, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' },
      )
    }
  }, [ids])

  return (
    <div className={`dash-board ${edit ? 'is-editing' : ''}`}>
      {renderHead({ edit, toggle: () => setEdit((value) => !value) })}

      {edit && unused.length ? (
        <div className="chip-row wrap dash-add">
          {unused.map((section) => (
            <button
              key={section.id}
              type="button"
              className="chip"
              onClick={() => add(section.id)}
            >
              + {section.label}
            </button>
          ))}
        </div>
      ) : null}

      {ids.map((id, index) => {
        const def = sectionById(id)
        if (!def) return null
        const Section = def.Section
        return (
          <div
            key={id}
            className="dash-item"
            ref={(element) => {
              if (element) items.current.set(id, element)
              else items.current.delete(id)
            }}
          >
            <Section
              category={def.scope}
              editing={edit}
              canUp={index > 0}
              canDown={index < ids.length - 1}
              onMove={(dir) => move(index, dir)}
              onRemove={() => remove(id)}
            />
          </div>
        )
      })}

      {edit && !ids.length ? (
        <p className="muted dash-empty-board">
          Alle Widgets sind entfernt. Über die Chips oben kommen sie zurück.
        </p>
      ) : null}
    </div>
  )
}
