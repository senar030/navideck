import { useState, type ReactNode } from 'react'
import { useAccount } from '../state/AccountContext'
import { useAuth } from '../state/AuthContext'
import { MIX_SIZES, usePrefs } from '../state/PrefsContext'
import { PALETTES, useTheme } from '../state/ThemeContext'
import { isIos, isIosSafari, isSecureOrigin, useInstallState } from '../lib/pwa'
import {
  IconDesktop,
  IconExternal,
  IconGamepad,
  IconLists,
  IconLogo,
  IconMoon,
  IconPlay,
  IconServer,
  IconSun,
} from './Icons'
import { SettingsServers } from './SettingsServers'

type SectionId = 'appearance' | 'playback' | 'libraries' | 'servers' | 'app'

type Section = {
  id: SectionId
  label: string
  hint: string
  lead: string
  icon: ReactNode
}

const SECTIONS: Section[] = [
  {
    id: 'appearance',
    label: 'Darstellung',
    hint: 'Farben und Ansicht',
    lead: 'Hell oder dunkel, welche Farbe, und wie groß die Bedienung sein soll.',
    icon: <IconSun />,
  },
  {
    id: 'playback',
    label: 'Wiedergabe',
    hint: 'Mixe',
    lead: 'Wie viel Navideck in einen Mix packt.',
    icon: <IconPlay size={22} />,
  },
  {
    id: 'libraries',
    label: 'Bibliotheken',
    hint: 'Was angezeigt wird',
    lead: 'Welche Bibliotheken deiner Server hier auftauchen.',
    icon: <IconLists />,
  },
  {
    id: 'servers',
    label: 'Server & Konto',
    hint: 'Verbindungen, Profil',
    lead: 'Die Server, die Navideck lesen darf, und der Name, mit dem es dich begrüßt.',
    icon: <IconServer />,
  },
  {
    id: 'app',
    label: 'App',
    hint: 'Installation und Version',
    lead: 'Installation, Offline-Betrieb und welcher Stand gerade läuft.',
    icon: <IconLogo size={20} />,
  },
]

/*
 * Settings are a page of their own, not a sheet over the content: there is
 * enough here to fill one, and a sheet would make the sections a list that
 * scrolls far past the screen. The left rail lists them on a wide window; on a
 * phone the same list becomes a row of chips above the panel.
 */
export function SettingsView() {
  const [active, setActive] = useState<SectionId>('appearance')
  const section = SECTIONS.find((entry) => entry.id === active) ?? SECTIONS[0]

  return (
    <div className="view settings-view">
      <header className="view-head">
        <div>
          <p className="eyebrow">Navideck</p>
          <h2>Einstellungen</h2>
        </div>
      </header>

      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Einstellungen">
          {SECTIONS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={`settings-tab ${entry.id === active ? 'is-on' : ''}`}
              aria-current={entry.id === active ? 'page' : undefined}
              onClick={(event) => {
                setActive(entry.id)
                /*
                 * On a phone the row scrolls; keep the choice in sight. Move the
                 * row itself: scrollIntoView also scrolls every ancestor, and
                 * the main scroller would shift the whole page sideways.
                 */
                const row = event.currentTarget.parentElement
                if (!row) return
                const box = row.getBoundingClientRect()
                const tab = event.currentTarget.getBoundingClientRect()
                row.scrollTo({
                  left: row.scrollLeft + tab.left - box.left - (box.width - tab.width) / 2,
                  behavior: 'smooth',
                })
              }}
            >
              <span className="settings-tab-icon" aria-hidden>
                {entry.icon}
              </span>
              <span className="settings-tab-text">
                <strong>{entry.label}</strong>
                <small>{entry.hint}</small>
              </span>
            </button>
          ))}
        </nav>

        <section className="settings-panel" aria-label={section.label}>
          <header className="settings-panel-head">
            <h3>{section.label}</h3>
            <p className="muted">{section.lead}</p>
          </header>

          {active === 'appearance' ? <AppearanceSection /> : null}
          {active === 'playback' ? <PlaybackSection /> : null}
          {active === 'libraries' ? <LibrariesSection onGoServers={() => setActive('servers')} /> : null}
          {active === 'servers' ? <SettingsServers /> : null}
          {active === 'app' ? <AppSection /> : null}
        </section>
      </div>
    </div>
  )
}

function AppearanceSection() {
  const { theme, setTheme, palette, setPalette } = useTheme()
  const { uiMode, setUiMode } = usePrefs()

  return (
    <>
      <div className="settings-group">
        <h4>Modus</h4>
        <p className="settings-hint">Gilt sofort, auch für die Statusleiste der installierten App.</p>
        <div className="chip-row">
          <button type="button" className={`chip ${theme === 'dark' ? 'is-on' : ''}`} onClick={() => setTheme('dark')}>
            <IconMoon size={16} /> Dunkel
          </button>
          <button type="button" className={`chip ${theme === 'light' ? 'is-on' : ''}`} onClick={() => setTheme('light')}>
            <IconSun size={16} /> Hell
          </button>
        </div>
      </div>

      <div className="settings-group">
        <h4>Farbthema</h4>
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
      </div>

      <div className="settings-group">
        <h4>Ansicht</h4>
        <p className="settings-hint">
          Die Deck-Ansicht vergrößert die Bedienung für Steam Deck, ROG Ally und ähnliche Handhelds.
          Die Desktop-Ansicht nutzt eine schmale Leiste am linken Rand.
        </p>
        <div className="chip-row">
          <button type="button" className={`chip ${uiMode === 'deck' ? 'is-on' : ''}`} onClick={() => setUiMode('deck')}>
            <IconGamepad size={16} /> Deck
          </button>
          <button
            type="button"
            className={`chip ${uiMode === 'desktop' ? 'is-on' : ''}`}
            onClick={() => setUiMode('desktop')}
          >
            <IconDesktop size={16} /> Desktop
          </button>
        </div>
      </div>
    </>
  )
}

function PlaybackSection() {
  const { mixSize, setMixSize } = usePrefs()
  const { client } = useAuth()

  return (
    <div className="settings-group">
      <h4>Sofort-Mix</h4>
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
      {!client ? (
        <p className="settings-hint">Mixe brauchen einen verbundenen Musik-Server.</p>
      ) : null}
    </div>
  )
}

function LibrariesSection({ onGoServers }: { onGoServers: () => void }) {
  const { client, folders, selectedFolderIds, setSelectedFolderIds } = useAuth()
  const { abs, music } = useAccount()

  if (!client && !abs) {
    return (
      <div className="settings-group">
        <h4>Noch kein Server</h4>
        <p className="muted">Navideck zeigt erst etwas, wenn ein Musik- oder Hörbuch-Server verbunden ist.</p>
        <button type="button" className="primary-btn" onClick={onGoServers}>
          Server verbinden
        </button>
      </div>
    )
  }

  return (
    <>
      {client ? (
        <div className="settings-group">
          <div className="settings-group-head">
            <h4>{music?.kind === 'subsonic' ? 'Subsonic' : 'Navidrome'}</h4>
            <span className="muted">Musik</span>
          </div>
          {music?.kind === 'subsonic' ? (
            <p className="settings-hint">
              Der Server führt eine Bibliothek; Navideck zeigt sie vollständig an.
            </p>
          ) : (
            <>
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
            </>
          )}
        </div>
      ) : null}

      {abs ? (
        <div className="settings-group">
          <div className="settings-group-head">
            <h4>Audiobookshelf</h4>
            <span className="muted">{abs.user ? abs.user.username : 'verbunden'}</span>
          </div>
          <p className="settings-hint">Wie der Server seine Bibliotheken nennt; Navideck zeigt alle.</p>
          <ul className="settings-lib-list">
            {abs.libraries.map((library) => (
              <li key={library.id}>
                <span>{library.name}</span>
                <small>{library.mediaType === 'podcast' ? 'Podcasts' : 'Hörbücher'}</small>
              </li>
            ))}
            {!abs.libraries.length ? <li className="muted">Keine Bibliotheken gemeldet.</li> : null}
          </ul>
        </div>
      ) : null}
    </>
  )
}

function AppSection() {
  return (
    <>
      <InstallSection />

      <div className="settings-group">
        <h4>Version</h4>
        <BuildInfo />
      </div>

      <div className="settings-group">
        <h4>Über Navideck</h4>
        <p className="settings-hint">
          Musik von Navidrome oder jedem anderen Subsonic-Server, Hörbücher und Podcasts von
          Audiobookshelf, Sendervorschläge von radio-browser.info. Diese App läuft im Browser und als
          Windows-App.
        </p>
        <a
          className="text-btn settings-link"
          href="https://github.com/senar030/navideck"
          target="_blank"
          rel="noreferrer noopener"
        >
          Projekt auf GitHub <IconExternal size={14} />
        </a>
      </div>
    </>
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
  /* Measured once, while rendering — the page is drawn inside `.app`. */
  const [shell] = useState(() => {
    const app = document.querySelector('.app')
    const height = app ? Math.round(app.getBoundingClientRect().height) : 0
    return `${window.innerWidth}×${Math.round(window.innerHeight)} · Shell ${height}px`
  })
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
      <div className="settings-group">
        <h4>Installation</h4>
        <p className="settings-hint">Navideck ist installiert und startet auch ohne Netz.</p>
      </div>
    )
  }

  return (
    <div className="settings-group">
      <h4>Installation</h4>
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
    </div>
  )
}
