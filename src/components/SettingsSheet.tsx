import { useEffect, useState } from 'react'
import { useAuth } from '../state/AuthContext'
import { MIX_SIZES, usePrefs } from '../state/PrefsContext'
import { PALETTES, useTheme } from '../state/ThemeContext'
import { isIos, isIosSafari, isSecureOrigin, useInstallState } from '../lib/pwa'
import { IconClose } from './Icons'

type Props = {
  open: boolean
  onClose: () => void
}

export function SettingsSheet({ open, onClose }: Props) {
  const { client, logout, folders, selectedFolderIds, setSelectedFolderIds } = useAuth()
  const { palette, setPalette } = useTheme()
  const { mixSize, setMixSize, uiMode, setUiMode } = usePrefs()
  if (!open) return null

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <aside className="sheet" onClick={(e) => e.stopPropagation()}>
        <header className="sheet-head">
          <h3>Einstellungen</h3>
          <button type="button" className="icon-btn" aria-label="Einstellungen schließen" onClick={onClose}>
            <IconClose />
          </button>
        </header>
        <div className="sheet-body settings-body">
          <InstallSection />
          <p className="muted">Angemeldet als</p>
          <p className="settings-user">{client?.username}</p>
          <p className="muted">Server</p>
          <p className="settings-url">{client?.baseUrl}</p>
          <p className="muted">Ansicht</p>
          <p className="settings-hint">Die Deck-Ansicht vergrößert die Bedienung für Steam Deck, ROG Ally und ähnliche Handhelds.</p>
          <div className="chip-row wrap mix-size-row">
            <button type="button" className={`chip ${uiMode === 'deck' ? 'is-on' : ''}`} onClick={() => setUiMode('deck')}>
              Deck
            </button>
            <button type="button" className={`chip ${uiMode === 'desktop' ? 'is-on' : ''}`} onClick={() => setUiMode('desktop')}>
              Desktop
            </button>
          </div>
          <p className="muted">Farbthema</p>
          <p className="settings-hint">Gilt für Hell- und Dunkelmodus.</p>
          <div className="palette-grid">
            {PALETTES.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`palette-swatch ${palette === item.id ? 'is-on' : ''}`}
                data-palette={item.id}
                onClick={() => setPalette(item.id)}
              >
                <span className="palette-dot" />
                {item.label}
              </button>
            ))}
          </div>
          <p className="muted">Sofort-Mix</p>
          <p className="settings-hint">Anzahl der Titel in Genre-Mix und ähnlichen Mixen.</p>
          <div className="chip-row wrap mix-size-row">
            {MIX_SIZES.map((n) => (
              <button
                key={n}
                type="button"
                className={`chip ${mixSize === n ? 'is-on' : ''}`}
                onClick={() => setMixSize(n)}
              >
                {n}
              </button>
            ))}
          </div>
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
          <BuildInfo />
        </div>
      </aside>
    </div>
  )
}

/*
 * The app is self-hosted and redeployed by hand, so it helps to see which build
 * is live and whether the shell really fills the screen: iOS reports its
 * viewport in its own way (see `--app-h` in index.css), and a shell that is
 * shorter than `innerHeight` is exactly the "chin gap" above the home
 * indicator.
 */
function BuildInfo() {
  const [shell, setShell] = useState('…')
  useEffect(() => {
    const app = document.querySelector('.app')
    const height = app ? Math.round(app.getBoundingClientRect().height) : 0
    setShell(`${window.innerWidth}×${Math.round(window.innerHeight)} · Shell ${height}px`)
  }, [])
  const build = String(import.meta.env.VITE_BUILD ?? 'dev').slice(0, 7)
  return (
    <p className="settings-hint build-info">
      Version {build} · {shell}
    </p>
  )
}

function installHint(declined: boolean): string {
  if (!isSecureOrigin()) {
    return 'Installieren und Offline-Betrieb brauchen HTTPS — über HTTP erlaubt kein Browser Service Worker. Navideck dafür über TLS bereitstellen (z. B. Tailscale Serve oder Reverse-Proxy).'
  }
  if (isIosSafari()) {
    return 'Zum Installieren das Teilen-Symbol antippen und „Zum Home-Bildschirm“ wählen.'
  }
  if (isIos()) {
    return 'Auf iPhone und iPad können nur Safari und Web-Apps installieren — Navideck dazu in Safari öffnen.'
  }
  if (declined) {
    return 'Installation abgebrochen. Über das Browsermenü lässt sie sich jederzeit nachholen.'
  }
  return 'Im Browsermenü „App installieren“ bzw. „Zum Startbildschirm hinzufügen“ wählen.'
}

function InstallSection() {
  const { canInstall, installed, promptInstall } = useInstallState()
  const [declined, setDeclined] = useState(false)

  if (installed) {
    return (
      <>
        <p className="muted">App</p>
        <p className="settings-hint">Navideck ist installiert und startet auch ohne Netz.</p>
      </>
    )
  }

  return (
    <>
      <p className="muted">App</p>
      {canInstall ? (
        <button
          type="button"
          className="primary-btn"
          onClick={() => {
            void promptInstall().then((result) => setDeclined(result === 'dismissed'))
          }}
        >
          Navideck installieren
        </button>
      ) : null}
      {!canInstall || declined ? <p className="settings-hint">{installHint(declined)}</p> : null}
    </>
  )
}
