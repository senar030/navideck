import { useAuth } from '../state/AuthContext'
import { IconClose } from './Icons'

type Props = {
  open: boolean
  onClose: () => void
}

export function SettingsSheet({ open, onClose }: Props) {
  const { client, logout } = useAuth()
  if (!open) return null

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <aside className="sheet" onClick={(e) => e.stopPropagation()}>
        <header className="sheet-head">
          <h3>Session</h3>
          <button type="button" className="icon-btn" aria-label="Close settings" onClick={onClose}>
            <IconClose />
          </button>
        </header>
        <div className="sheet-body settings-body">
          <p className="muted">Connected as</p>
          <p className="settings-user">{client?.username}</p>
          <p className="muted">Server</p>
          <p className="settings-url">{client?.baseUrl}</p>
          <button
            type="button"
            className="primary-btn"
            onClick={() => {
              logout()
              onClose()
            }}
          >
            Disconnect
          </button>
        </div>
      </aside>
    </div>
  )
}
