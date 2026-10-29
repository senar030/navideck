import { useEffect, useRef, useState } from 'react'
import { IconArrowDown, IconArrowUp, IconSort } from './Icons'

export type SortOption<T extends string> = {
  id: T
  label: string
  /** Direction the option starts with; a second tap flips it. */
  defaultDesc?: boolean
}

/*
 * One sort button for every list: the heading stays on the left and the
 * options live in a compact popover, one under the other. The active option
 * carries an arrow; tapping it again reverses the order. The layout switch
 * sits beside the button, so a phone header stays on one line.
 */
export function SortMenu<T extends string>({
  options,
  value,
  desc = false,
  onChange,
  reversible = true,
}: {
  options: SortOption<T>[]
  value: T
  desc?: boolean
  onChange: (value: T, desc: boolean) => void
  /** Filters that are not a field (e.g. "Newest") have no reversed form. */
  reversible?: boolean
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onPointer(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const active = options.find((option) => option.id === value)

  return (
    <div className="sort-menu" ref={root}>
      <button
        type="button"
        className={`icon-btn sort-toggle ${open ? 'is-on' : ''}`}
        aria-label="Sortieren"
        aria-expanded={open}
        data-tip={active ? `Sortieren: ${active.label}` : 'Sortieren'}
        onClick={() => setOpen((current) => !current)}
      >
        <IconSort size={20} />
      </button>

      {open ? (
        <div className="sort-pop" role="group" aria-label="Sortieren">
          <p className="sort-pop-title">Sortieren</p>
          <div className="sort-list">
            {options.map((option) => {
              const current = option.id === value
              return (
                <button
                  key={option.id}
                  type="button"
                  className={`sort-option ${current ? 'is-on' : ''}`}
                  aria-pressed={current}
                  onClick={() => {
                    if (!reversible) {
                      onChange(option.id, false)
                      setOpen(false)
                      return
                    }
                    if (current) onChange(option.id, !desc)
                    else onChange(option.id, Boolean(option.defaultDesc))
                  }}
                >
                  <span>{option.label}</span>
                  {current && reversible ? (
                    <span className="sort-dir">
                      {desc ? <IconArrowDown size={16} /> : <IconArrowUp size={16} />}
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
          {reversible ? (
            <p className="sort-hint">Aktive Option erneut wählen, um die Richtung zu drehen.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
