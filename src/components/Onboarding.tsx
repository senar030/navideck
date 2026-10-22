import { useState, type FormEvent } from 'react'
import { useAccount } from '../state/AccountContext'
import { IconAlbums, IconBook, IconLogo } from './Icons'

type Kind = 'navidrome' | 'audiobookshelf'

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
          <p className="eyebrow">{kind === 'navidrome' ? 'Navidrome' : 'Audiobookshelf'}</p>
          <h2>Server verbinden</h2>
          <label>
            Server-URL
            <input
              value={server}
              onChange={(e) => setServer(e.target.value)}
              placeholder={kind === 'navidrome' ? 'http://192.168.1.10:4533' : 'http://192.168.1.10:13378'}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              inputMode="url"
              required
            />
          </label>
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
            Passwort
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
        gespeichert, das der Server ausstellt.
      </p>
    </main>
  )
}
