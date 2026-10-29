import { useEffect, useRef, useState } from 'react'
import { IconSort } from './Icons'

export type SortOption<T extends string> = { id: T; label: string }

/*
 * One sort button for every list page: the heading stays on the left, the
 * options live in a small popover and the layout switch sits beside it. This
 * keeps a phone header on one line instead of wrapping a row of chips.
 */
export function SortMenu<T extends string>({
  options,
  value,
  onChange,
  desc = false,
  onDesc,
  ascLabel = 'Aufsteigend',
  descLabel = 'Absteigend',
}: {
  options: SortOption<T>[]
  value: T
  onChange: (value: T) => void
  desc?: boolean
  /** Omit when every option already carries its own direction. */
  onDesc?: () => void
  ascLabel?: string
  descLabel?: string
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
          <div className="chip-row wrap">
            {options.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`chip ${value === option.id ? 'is-on' : ''}`}
                onClick={() => {
                  onChange(option.id)
                  setOpen(false)
                }}
              >
                {option.label}
              </button>
            ))}
          </div>

          {onDesc ? (
            <>
              <p className="sort-pop-title sort-pop-sub">Richtung</p>
              <button
                type="button"
                className={`chip ${desc ? 'is-on' : ''}`}
                aria-label="Sortierrichtung umdrehen"
                onClick={onDesc}
              >
                {desc ? descLabel : ascLabel}
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
