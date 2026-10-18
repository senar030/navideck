import { useEffect, useState } from 'react'
import { DEFAULT_SECTIONS, SECTIONS, sectionById, type SectionId } from './DashboardRegistry'
import { ResumePlaying } from './ResumePlaying'

/**
 * v3: the categories changed again — one new, two gone and two swapped — so old
 * saved orders are not carried over.
 */
const DASH_KEY = 'navideck.dashboard.v3'

function readSections(): SectionId[] {
  try {
    const raw = localStorage.getItem(DASH_KEY)
    if (!raw) return [...DEFAULT_SECTIONS]
    const parsed = JSON.parse(raw) as string[]
    const valid = parsed.filter((id): id is SectionId => SECTIONS.some((section) => section.id === id))
    return valid.length ? valid : [...DEFAULT_SECTIONS]
  } catch {
    return [...DEFAULT_SECTIONS]
  }
}

export function HomeDashboard() {
  const [sections, setSections] = useState<SectionId[]>(readSections)
  const [edit, setEdit] = useState(false)

  useEffect(() => {
    localStorage.setItem(DASH_KEY, JSON.stringify(sections))
  }, [sections])

  const unused = SECTIONS.filter((section) => !sections.includes(section.id))

  function move(index: number, dir: -1 | 1) {
    const next = index + dir
    if (next < 0 || next >= sections.length) return
    setSections((list) => {
      const copy = [...list]
      const tmp = copy[index]
      copy[index] = copy[next]
      copy[next] = tmp
      return copy
    })
  }

  return (
    <div className="view dashboard">
      <header className="view-head">
        <h2>Start</h2>
        <button type="button" className={`chip ${edit ? 'is-on' : ''}`} onClick={() => setEdit((e) => !e)}>
          {edit ? 'Fertig' : 'Anpassen'}
        </button>
      </header>
      {edit && unused.length ? (
        <div className="chip-row wrap dash-add">
          {unused.map((section) => (
            <button
              key={section.id}
              type="button"
              className="chip"
              onClick={() => setSections((list) => [...list, section.id])}
            >
              + {section.label}
            </button>
          ))}
        </div>
      ) : null}
      <ResumePlaying />
      {sections.map((id, index) => {
        const def = sectionById(id)
        if (!def) return null
        const Section = def.Section
        return (
          <Section
            key={id}
            editing={edit}
            canUp={index > 0}
            canDown={index < sections.length - 1}
            onMove={(dir) => move(index, dir)}
            onRemove={() => setSections((list) => list.filter((x) => x !== id))}
          />
        )
      })}
    </div>
  )
}
