import { useState, type FormEvent } from 'react'
import { useAccount, type Source, type SourceHealth } from '../state/AccountContext'
import { IconAlbums, IconBook, IconCheck, IconRefresh, IconServer, IconUser } from './Icons'

function stateLabel(state: SourceHealth | undefined): string {
  if (!state || state.status === 'checking') return 'Wird geprüft …'
  if (state.status === 'error') return 'Nicht erreichbar'
  return 'Verbunden'
}

/*
 * "Konto" is what the app has instead of a sign-up: a name of your choosing and
 * the servers it may talk to. Everything stays on this device — the media and
 * the listening progress already live on the servers.
 */
export function AccountView() {
  const { profile, setProfile, sources, health, removeSource, checkSource } = useAccount()
  const [name, setName] = useState(profile)
  const [saved, setSaved] = useState(false)
  const [adding, setAdding] = useState<'navidrome' | 'audiobookshelf' | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)

  const hasNavidrome = sources.some((source) => source.kind === 'navidrome')
  const hasAbs = sources.some((source) => source.kind === 'audiobookshelf')

  function saveProfile(e: FormEvent) {
    e.preventDefault()
    setProfile(name.trim())
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="view account-view">
      <header className="view-head">
        <div>
          <h2>Konto &amp; Server</h2>
          <p className="muted">Profil und die Server, die Navideck lesen darf.</p>
        </div>
      </header>

      <section className="account-section">
        <h3>Profil</h3>
        <form className="account-profile" onSubmit={saveProfile}>
          <span className="account-icon" aria-hidden>
            <IconUser />
          </span>
          <label className="account-field">
            Anzeigename
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Dein Name" />
          </label>
          <button type="submit" className="chip">
            Speichern
          </button>
          {saved ? (
            <span className="account-saved">
              <IconCheck size={16} /> Gespeichert
            </span>
          ) : null}
        </form>
      </section>

      <section className="account-section">
        <div className="account-section-head">
          <h3>Server</h3>
          <span className="muted">{sources.length ? `${sources.length} verbunden` : 'Noch keiner'}</span>
        </div>

        {!sources.length ? <p className="muted">Noch kein Server hinterlegt.</p> : null}

        <div className="account-servers">
          {sources.map((source) => (
            <ServerCard
              key={source.id}
              source={source}
              state={health[source.id]}
              confirming={confirming === source.id}
              onCheck={() => checkSource(source.id)}
              onReplace={() => setAdding(source.kind)}
              onAskRemove={() => setConfirming(source.id)}
              onCancelRemove={() => setConfirming(null)}
              onRemove={() => {
                removeSource(source.id)
                setConfirming(null)
              }}
            />
          ))}
        </div>

        <div className="account-add-row">
          {!hasNavidrome ? (
            <button type="button" className="account-add" onClick={() => setAdding('navidrome')}>
              <IconAlbums />
              <span>
                <strong>Navidrome</strong>
                <span className="muted">Musik</span>
              </span>
            </button>
          ) : null}
          {!hasAbs ? (
            <button type="button" className="account-add" onClick={() => setAdding('audiobookshelf')}>
              <IconBook />
              <span>
                <strong>Audiobookshelf</strong>
                <span className="muted">Hörbücher &amp; Podcasts</span>
              </span>
            </button>
          ) : null}
        </div>

        {adding ? (
          <SourceForm
            kind={adding}
            existing={sources.find((source) => source.kind === adding)}
            onClose={() => setAdding(null)}
          />
        ) : null}
      </section>

      <p className="account-note muted">
        Profil und Zugangsdaten bleiben auf diesem Gerät. Von Audiobookshelf wird nur das Token
        gespeichert, das der Server ausstellt – nie dein Passwort.
      </p>
    </div>
  )
}

function ServerCard({
  source,
  state,
  confirming,
  onCheck,
  onReplace,
  onAskRemove,
  onCancelRemove,
  onRemove,
}: {
  source: Source
  state: SourceHealth | undefined
  confirming: boolean
  onCheck: () => void
  onReplace: () => void
  onAskRemove: () => void
  onCancelRemove: () => void
  onRemove: () => void
}) {
  const status = state?.status ?? 'checking'
  return (
    <article className="account-card">
      <span className="account-icon" aria-hidden>
        {source.kind === 'navidrome' ? <IconAlbums /> : <IconBook />}
      </span>
      <div className="account-copy">
        <strong>{source.name}</strong>
        <span className="muted">
          {source.kind === 'navidrome' ? 'Navidrome' : 'Audiobookshelf'} · {source.baseUrl}
        </span>
        <span className="muted">Angemeldet als {source.username}</span>
        <span className={`account-state is-${status}`}>
          <span className="account-dot" aria-hidden />
          {stateLabel(state)}
        </span>
        {state?.error ? <span className="error account-error">{state.error}</span> : null}
      </div>
      <div className="account-actions">
        <button type="button" className="chip" onClick={onCheck}>
          <IconRefresh size={16} /> Prüfen
        </button>
        <button type="button" className="chip" onClick={onReplace}>
          Ersetzen
        </button>
        {confirming ? (
          <>
            <button type="button" className="chip is-danger" onClick={onRemove}>
              Wirklich entfernen
            </button>
            <button type="button" className="chip" onClick={onCancelRemove}>
              Abbrechen
            </button>
          </>
        ) : (
          <button type="button" className="chip" onClick={onAskRemove}>
            Entfernen
          </button>
        )}
      </div>
    </article>
  )
}

function SourceForm({
  kind,
  existing,
  onClose,
}: {
  kind: 'navidrome' | 'audiobookshelf'
  existing?: Source
  onClose: () => void
}) {
  const { addSource } = useAccount()
  const [server, setServer] = useState(existing?.baseUrl ?? '')
  const [username, setUsername] = useState(existing?.username ?? '')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await addSource({ kind, server, username, password })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verbindung fehlgeschlagen')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="account-form" onSubmit={(e) => void submit(e)}>
      <div className="account-form-head">
        <span className="account-icon" aria-hidden>
          <IconServer />
        </span>
        <div>
          <h4>{existing ? 'Server ersetzen' : 'Server hinzufügen'}</h4>
          <p className="muted">
            {kind === 'navidrome' ? 'Navidrome (Musik)' : 'Audiobookshelf (Hörbücher & Podcasts)'}
          </p>
        </div>
      </div>

      <label className="account-field">
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

      <label className="account-field">
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

      <label className="account-field">
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

      {existing ? (
        <p className="muted">
          Ersetzt „{existing.name}“. Die Verbindung wird vor dem Speichern geprüft.
        </p>
      ) : null}

      {error ? <p className="error">{error}</p> : null}

      <div className="account-form-actions">
        <button type="submit" className="primary-btn" disabled={busy}>
          {busy ? 'Verbinde …' : 'Verbinden'}
        </button>
        <button type="button" className="text-btn" onClick={onClose}>
          Abbrechen
        </button>
      </div>
    </form>
  )
}
