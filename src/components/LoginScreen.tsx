import { useState, type FormEvent } from 'react'
import { useAuth } from '../state/AuthContext'

export function LoginScreen() {
  const { login, lastServer, lastUser } = useAuth()
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
      setError(err instanceof Error ? err.message : 'Could not connect')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <form className="login-card" onSubmit={(e) => void onSubmit(e)}>
        <div className="login-mark" aria-hidden>
          <span />
        </div>
        <h1>Navideck</h1>
        <p className="login-lead">
          Touch-friendly Navidrome player for a desktop or a Steam Deck.
        </p>
        <label>
          Server URL
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
          Username
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            required
          />
        </label>
        <label>
          Password
          <span className="pw-row">
            <input
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button type="button" className="text-btn" onClick={() => setShowPw((s) => !s)}>
              {showPw ? 'Hide' : 'Show'}
            </button>
          </span>
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button type="submit" className="primary-btn" disabled={busy}>
          {busy ? 'Connecting…' : 'Connect'}
        </button>
      </form>
    </div>
  )
}
