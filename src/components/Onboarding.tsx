import { useState, type FormEvent } from 'react'
import { useAccount } from '../state/AccountContext'
import { IconAlbums, IconBook, IconLogo, IconServer } from './Icons'

type Kind = 'navidrome' | 'subsonic' | 'audiobookshelf'

const KIND_LABEL: Record<Kind, string> = {
  navidrome: 'Navidrome',
  subsonic: 'Subsonic',
  audiobookshelf: 'Audiobookshelf',
}

const KIND_URL_PLACEHOLDER: Record<Kind, string> = {
  navidrome: 'http://192.168.1.10:4533',
  subsonic: 'https://cloud.example.com/index.php/apps/music/subsonic',
  audiobookshelf: 'http://192.168.1.10:13378',
}

/*
 * The first run. A server is the only thing Navideck cannot do without, so this
 * asks for exactly one and gets out of the way; the second one is added later
 * from the settings, where both are visible side by side.
 */
export function Onboarding() {
  const { addSource } = useAccount()
  const [kind, setKind] = useState<Kind | null>(null)
  const [server, setServer] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!kind) return
    setError('')
    setBusy(true)
    try {
      await addSource({ kind, server, username, password })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verbindung fehlgeschlagen')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="onboard">
      <header className="onboard-head">
        <div className="login-mark" aria-hidden>
          <IconLogo size={52} />
        </div>
        <h1>Willkommen bei Navideck</h1>
        <p className="login-lead">
          Musik, Hörbücher und Podcasts an einem Ort. Verbinde zuerst einen Server – weitere
          kommen jederzeit in den Einstellungen unter „Server &amp; Konto“ dazu.
        </p>
      </header>

      {!kind ? (
        <div className="onboard-choices">
          <button type="button" className="onboard-choice" onClick={() => setKind('navidrome')}>
            <span className="onboard-icon" aria-hidden>
              <IconAlbums size={28} />
            </span>
            <strong>Navidrome</strong>
            <span className="muted">Alben, Künstler, Playlists, Favoriten und Radio</span>
            <span className="onboard-go">Verbinden</span>
          </button>
          <button type="button" className="onboard-choice" onClick={() => setKind('subsonic')}>
            <span className="onboard-icon" aria-hidden>
              <IconServer size={28} />
            </span>
            <strong>Subsonic</strong>
            <span className="muted">Nextcloud Music, Airsonic, Gonic und andere</span>
            <span className="onboard-go">Verbinden</span>
          </button>
          <button type="button" className="onboard-choice" onClick={() => setKind('audiobookshelf')}>
            <span className="onboard-icon" aria-hidden>
              <IconBook size={28} />
            </span>
            <strong>Audiobookshelf</strong>
            <span className="muted">Hörbücher, Autoren, Sammlungen und Podcasts</span>
            <span className="onboard-go">Verbinden</span>
          </button>
        </div>
      ) : (
        <form className="login-card onboard-form" onSubmit={(e) => void submit(e)}>
          <p className="eyebrow">{KIND_LABEL[kind]}</p>
          <h2>Server verbinden</h2>
          <label>
            Server-URL
            <input
              value={server}
              onChange={(e) => setServer(e.target.value)}
              placeholder={KIND_URL_PLACEHOLDER[kind]}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              inputMode="url"
              required
            />
          </label>
          {kind === 'subsonic' ? (
            <p className="settings-hint">
              Nextcloud Music: <strong>Einstellungen → Ampache &amp; Subsonic → API-Passwort erzeugen</strong>.
              Die Server-URL endet auf <code>/apps/music/subsonic</code>.
            </p>
          ) : null}
          <label>
            Benutzername
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="username"
              required
            />
          </label>
          <label>
            {kind === 'subsonic' ? 'API-Passwort' : 'Passwort'}
            <span className="pw-row">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button type="button" className="text-btn" onClick={() => setShowPw((s) => !s)}>
                {showPw ? 'Verbergen' : 'Anzeigen'}
              </button>
            </span>
          </label>
          {error ? <p className="error">{error}</p> : null}
          <button type="submit" className="primary-btn" disabled={busy}>
            {busy ? 'Verbinde …' : 'Verbinden'}
          </button>
          <button
            type="button"
            className="text-btn"
            onClick={() => {
              setKind(null)
              setError('')
            }}
          >
            Anderen Server wählen
          </button>
        </form>
      )}

      <p className="onboard-note muted">
        Die Zugangsdaten bleiben auf diesem Gerät. Bei Audiobookshelf wird nur das Token
        gespeichert, das der Server ausstellt. Bei Subsonic ist es das API-Passwort, das du
        in der Musik-App erzeugt hast.
      </p>
    </main>
  )
}
