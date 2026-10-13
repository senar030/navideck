import { useAuth } from '../state/AuthContext'
import { IconClose } from './Icons'

type Props = {
  open: boolean
  onClose: () => void
}

export function SettingsSheet({ open, onClose }: Props) {
  const { client, logout, folders, selectedFolderIds, setSelectedFolderIds } = useAuth()
  if (!open) return null

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <aside className="sheet" onClick={(e) => e.stopPropagation()}>
        <header className="sheet-head">
          <h3>Einstellungen</h3>
          <button type="button" className="icon-btn" aria-label="Close settings" onClick={onClose}>
            <IconClose />
          </button>
        </header>
        <div className="sheet-body settings-body">
          <p className="muted">Angemeldet als</p>
          <p className="settings-user">{client?.username}</p>
          <p className="muted">Server</p>
          <p className="settings-url">{client?.baseUrl}</p>
          <p className="muted">Bibliotheken</p>
          <p className="settings-hint">Keine Auswahl = alle Bibliotheken.</p>
          <div className="folder-list">
            {folders.map((folder) => {
              const checked = selectedFolderIds.length === 0 || selectedFolderIds.includes(folder.id)
              return (
                <label key={folder.id} className="folder-row">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      const allIds = folders.map((f) => f.id)
                      const current = selectedFolderIds.length === 0 ? allIds : selectedFolderIds
                      const next = current.includes(folder.id)
                        ? current.filter((x) => x !== folder.id)
                        : [...current, folder.id]
                      if (!next.length) return
                      setSelectedFolderIds(next.length === allIds.length ? [] : next)
                    }}
                  />
                  <span>{folder.name}</span>
                </label>
              )
            })}
            {!folders.length ? <p className="muted">Keine Bibliotheken gefunden.</p> : null}
          </div>
          {selectedFolderIds.length > 0 ? (
            <button type="button" className="text-btn" onClick={() => setSelectedFolderIds([])}>
              Alle Bibliotheken
            </button>
          ) : null}
          <button
            type="button"
            className="primary-btn"
            onClick={() => {
              logout()
              onClose()
            }}
          >
            Trennen
          </button>
        </div>
      </aside>
    </div>
  )
}
