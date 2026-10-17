import { useState, type FormEvent } from 'react'
import { useAuth } from '../state/AuthContext'
import { usePrefs } from '../state/PrefsContext'
import { IconLogo } from './Icons'

export function LoginScreen() {
  const { login, lastServer, lastUser } = useAuth()
  const { uiMode, setUiMode } = usePrefs()
  const [server, setServer] = useState(lastServer)
  const [username, setUsername] = useState(lastUser)
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await login(server, username, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verbindung fehlgeschlagen')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="login">
      <form className="login-card" onSubmit={(e) => void onSubmit(e)}>
        <div className="login-mark" aria-hidden>
          <IconLogo size={52} />
        </div>
        <h1>Navideck</h1>
        <p className="login-lead">
          Navidrome-Player für Desktop und Steam Deck – angenehm per Touch zu bedienen.
        </p>
        <label>
          Server-URL
          <input
            value={server}
            onChange={(e) => setServer(e.target.value)}
            placeholder="http://192.168.1.10:4533"
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
        <p className="muted">Ansicht</p>
        <div className="chip-row wrap">
          <button type="button" className={`chip ${uiMode === 'deck' ? 'is-on' : ''}`} onClick={() => setUiMode('deck')}>
            Deck
          </button>
          <button type="button" className={`chip ${uiMode === 'desktop' ? 'is-on' : ''}`} onClick={() => setUiMode('desktop')}>
            Desktop
          </button>
        </div>
        <button type="submit" className="primary-btn" disabled={busy}>
          {busy ? 'Verbinden…' : 'Verbinden'}
        </button>
      </form>
    </main>
  )
}
