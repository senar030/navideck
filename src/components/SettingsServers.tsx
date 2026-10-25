import { useState, type FormEvent } from 'react'
import { useAccount, isMusicSource, type Source, type SourceHealth } from '../state/AccountContext'
import { IconAlbums, IconBook, IconCheck, IconRefresh, IconServer, IconUser } from './Icons'

type AddKind = 'navidrome' | 'subsonic' | 'audiobookshelf'

const KIND_LABEL: Record<AddKind, string> = {
  navidrome: 'Navidrome',
  subsonic: 'Subsonic',
  audiobookshelf: 'Audiobookshelf',
}

const KIND_PLACEHOLDER: Record<AddKind, string> = {
  navidrome: 'http://192.168.1.10:4533',
  subsonic: 'https://cloud.example.com/index.php/apps/music/subsonic',
  audiobookshelf: 'http://192.168.1.10:13378',
}

function kindLabel(kind: Source['kind']): string {
  return KIND_LABEL[kind]
}

function isMusicSourceKind(kind: AddKind): kind is 'navidrome' | 'subsonic' {
  return kind === 'navidrome' || kind === 'subsonic'
}

function stateLabel(state: SourceHealth | undefined): string {
  if (!state || state.status === 'checking') return 'Wird geprüft …'
  if (state.status === 'error') return 'Nicht erreichbar'
  return 'Verbunden'
}

/*
 * The server side of the settings: a name of your choosing and the servers it
 * may talk to. Everything stays on this device — the media and the listening
 * progress already live on the servers.
 */
export function SettingsServers() {
  const {
    profile,
    setProfile,
    sources,
    health,
    removeSource,
    checkSource,
    musicSources,
    activeMusicId,
    setActiveMusic,
    podcastOptions,
    activePodcastId,
    setActivePodcast,
  } = useAccount()
  const [name, setName] = useState(profile)
  const [saved, setSaved] = useState(false)
  const [adding, setAdding] = useState<AddKind | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)

  const hasNavidrome = sources.some((source) => source.kind === 'navidrome')
  const hasSubsonic = sources.some((source) => source.kind === 'subsonic')
  const hasAbs = sources.some((source) => source.kind === 'audiobookshelf')

  function saveProfile(e: FormEvent) {
    e.preventDefault()
    setProfile(name.trim())
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2000)
  }

  return (
    <>
      <div className="settings-group">
        <h4>Profil</h4>
        <p className="settings-hint">Der Name, mit dem dich Navideck begrüßt. Er bleibt auf diesem Gerät.</p>
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
      </div>

      {musicSources.length || podcastOptions.length ? (
        <div className="settings-group">
          <h4>Quellen</h4>
          <p className="settings-hint">
            Mehrere Musik-Server bleiben verbunden; hier wählst du, welcher die Musik liefert und
            woher die Podcasts kommen. Navidrome kennt keine Podcasts.
          </p>
          {musicSources.length ? (
            <div className="settings-choice">
              <span className="settings-choice-label">Musik</span>
              <div className="chip-row wrap">
                {musicSources.map((source) => (
                  <button
                    key={source.id}
                    type="button"
                    className={`chip ${source.id === activeMusicId ? 'is-on' : ''}`}
                    aria-pressed={source.id === activeMusicId}
                    onClick={() => setActiveMusic(source.id)}
                  >
                    {source.name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {podcastOptions.length ? (
            <div className="settings-choice">
              <span className="settings-choice-label">Podcasts</span>
              <div className="chip-row wrap">
                {podcastOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`chip ${option.id === activePodcastId ? 'is-on' : ''}`}
                    aria-pressed={option.id === activePodcastId}
                    onClick={() => setActivePodcast(option.id)}
                  >
                    {option.name}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="settings-hint">Podcasts brauchen einen Audiobookshelf- oder Subsonic-Server.</p>
          )}
        </div>
      ) : null}

      <div className="settings-group">
        <div className="settings-group-head">
          <h4>Server</h4>
          <span className="muted">{sources.length ? `${sources.length} verbunden` : 'Noch keiner'}</span>
        </div>

        {!sources.length ? <p className="muted">Noch kein Server hinterlegt.</p> : null}

        <div className="account-servers">
          {sources.map((source) => (
            <ServerCard
              key={source.id}
              source={source}
              state={health[source.id]}
              activeLabels={[
                ...(isMusicSource(source) && source.id === activeMusicId ? ['Musik aktiv'] : []),
                ...(podcastOptions.some((option) => option.id === source.id) &&
                source.id === activePodcastId
                  ? ['Podcasts aktiv']
                  : []),
              ]}
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
                <span className="muted">
                  {musicSources.length ? 'Zusätzlicher Musik-Server' : 'Musik'}
                </span>
              </span>
            </button>
          ) : null}
          {!hasSubsonic ? (
            <button type="button" className="account-add" onClick={() => setAdding('subsonic')}>
              <IconServer />
              <span>
                <strong>Subsonic</strong>
                <span className="muted">
                  {musicSources.length
                    ? 'Zusätzlicher Musik-Server'
                    : 'Nextcloud Music, Airsonic, Gonic'}
                </span>
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
      </div>

      <div className="settings-group">
        <h4>Zugangsdaten</h4>
        <p className="settings-hint">
          Profil und Zugangsdaten bleiben auf diesem Gerät. Von Audiobookshelf wird nur das Token
          gespeichert, das der Server ausstellt – nie dein Passwort. Bei Subsonic liegt das dort
          erzeugte API-Passwort lokal, damit Navideck deinen Musik-Server ansprechen kann.
        </p>
      </div>
    </>
  )
}

function ServerCard({
  source,
  state,
  activeLabels,
  confirming,
  onCheck,
  onReplace,
  onAskRemove,
  onCancelRemove,
  onRemove,
}: {
  source: Source
  state: SourceHealth | undefined
  activeLabels: string[]
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
        {source.kind === 'navidrome' ? <IconAlbums /> : source.kind === 'subsonic' ? <IconServer /> : <IconBook />}
      </span>
      <div className="account-copy">
        <strong>{source.name}</strong>
        <span className="muted">
          {kindLabel(source.kind)} · {source.baseUrl}
        </span>
        <span className="muted">Angemeldet als {source.username}</span>
        {activeLabels.length ? (
          <span className="account-tags">
            {activeLabels.map((label) => (
              <span key={label} className="account-tag">
                {label}
              </span>
            ))}
          </span>
        ) : null}
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
  kind: AddKind
  existing?: Source
  onClose: () => void
}) {
  const { addSource, musicSources } = useAccount()
  const [server, setServer] = useState(existing?.baseUrl ?? '')
  const [name, setName] = useState(existing?.name ?? '')
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
      await addSource({ kind, server, username, password, name: name.trim() || undefined })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verbindung fehlgeschlagen')
    } finally {
      setBusy(false)
    }
  }

  const replaced = existing

  return (
    <form className="account-form" onSubmit={(e) => void submit(e)}>
      <div className="account-form-head">
        <span className="account-icon" aria-hidden>
          <IconServer />
        </span>
        <div>
          <h4>{replaced ? 'Server ersetzen' : 'Server hinzufügen'}</h4>
          <p className="muted">
            {kind === 'navidrome'
              ? 'Navidrome (Musik)'
              : kind === 'subsonic'
                ? 'Subsonic (Musik, z. B. Nextcloud Music)'
                : 'Audiobookshelf (Hörbücher & Podcasts)'}
          </p>
        </div>
      </div>

      <label className="account-field">
        Server-URL
        <input
          value={server}
          onChange={(e) => setServer(e.target.value)}
          placeholder={KIND_PLACEHOLDER[kind]}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          inputMode="url"
          required
        />
      </label>

      {kind === 'subsonic' ? (
        <p className="settings-hint">
          In der Nextcloud Music App unter <strong>Einstellungen → Ampache &amp; Subsonic</strong> ein
          API-Passwort erzeugen und hier als Passwort eintragen. Die URL endet auf{' '}
          <code>/apps/music/subsonic</code>.
        </p>
      ) : null}

      <label className="account-field">
        Name (optional)
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={KIND_LABEL[kind]}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
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

      {replaced ? (
        <p className="settings-hint">
          Ersetzt „{replaced.name}“. Die Verbindung wird vor dem Speichern geprüft.
        </p>
      ) : isMusicSourceKind(kind) && musicSources.length ? (
        <p className="settings-hint">
          Wird zusätzlich verbunden. Unter „Quellen“ wählst du danach, welcher Server die Musik
          liefert.
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
