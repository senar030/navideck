import { type LayoutKey, usePrefs } from '../state/PrefsContext'
import { IconGrid, IconLists } from './Icons'

export function LayoutToggle({ section }: { section: LayoutKey }) {
  const { layout, setLayout } = usePrefs()
  const mode = layout[section]
  return (
    <div className="layout-toggle" role="group" aria-label="Ansicht">
      <button
        type="button"
        className={`icon-btn ${mode === 'grid' ? 'is-on' : ''}`}
        aria-label="Kachelansicht"
        data-tip="Kacheln"
        onClick={() => setLayout(section, 'grid')}
      >
        <IconGrid size={18} />
      </button>
      <button
        type="button"
        className={`icon-btn ${mode === 'list' ? 'is-on' : ''}`}
        aria-label="Listenansicht"
        data-tip="Liste"
        onClick={() => setLayout(section, 'list')}
      >
        <IconLists size={18} />
      </button>
    </div>
  )
}
