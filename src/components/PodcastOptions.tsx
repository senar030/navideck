import { useState, type FormEvent } from 'react'
import type { AbsLibraryItem, AbsPodcast } from '../api/abs'
import { splitLabels } from '../lib/format'
import { useAccount } from '../state/AccountContext'
import { IconClose, IconExternal, IconPlus } from './Icons'

/*
 * The options for one podcast: its metadata and tags, the way back to the
 * episode picker, and removing it from the library (optionally from disk).
 */
export function PodcastOptions({
  item,
  podcast,
  onClose,
  onDownload,
  onSaved,
  onDeleted,
}: {
  item: AbsLibraryItem
  podcast: AbsPodcast
  onClose: () => void
  onDownload: () => void
  onSaved: () => void
  onDeleted: () => void
}) {
  const { abs, podcasts } = useAccount()
  const client = podcasts?.kind === 'audiobookshelf' ? (abs?.client ?? null) : null
  const meta = podcast.metadata

  const [title, setTitle] = useState(meta.title ?? '')
  const [author, setAuthor] = useState(meta.author ?? '')
  const [description, setDescription] = useState(meta.description ?? '')
  const [genres, setGenres] = useState((meta.genres ?? []).join(', '))
  const [tags, setTags] = useState((podcast.tags ?? []).join(', '))
  const [language, setLanguage] = useState(meta.language ?? '')
  const [explicit, setExplicit] = useState(Boolean(meta.explicit))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [hard, setHard] = useState(false)

  const cover = client?.coverUrl(item.id)

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!client) return
    if (!title.trim()) {
      setError('Bitte einen Titel angeben.')
      return
    }
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await client.updatePodcast(item.id, {
        tags: splitLabels(tags),
        metadata: {
          title: title.trim(),
          author: author.trim() || null,
          description: description.trim() || null,
          genres: splitLabels(genres),
          language: language.trim() || null,
          explicit,
        },
      })
      setNotice('Gespeichert.')
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Die Änderungen konnten nicht gespeichert werden.')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!client) return
    setBusy(true)
    setError('')
    try {
      await client.deleteLibraryItem(item.id, hard)
      onDeleted()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Der Podcast konnte nicht entfernt werden.')
      setBusy(false)
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <aside
        className="sheet podcast-options"
        role="dialog"
        aria-modal="true"
        aria-label="Podcast-Optionen"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="sheet-head">
          <h3>Podcast-Optionen</h3>
          <button type="button" className="icon-btn" aria-label="Schließen" onClick={onClose}>
            <IconClose />
          </button>
        </header>

        <div className="sheet-body">
          <div className="podcast-setup-meta">
            {cover ? <img className="podcast-setup-cover" src={cover} alt="" /> : null}
            <div>
              <strong>{meta.title}</strong>
              <span className="muted">{meta.author || 'Unbekannt'}</span>
            </div>
          </div>

          {error ? <p className="error">{error}</p> : null}
          {notice ? <p className="podcast-notice">{notice}</p> : null}

          <form className="podcast-options-form" onSubmit={(event) => void save(event)}>
            <label className="account-field">
              Titel
              <input value={title} onChange={(event) => setTitle(event.target.value)} required />
            </label>
            <label className="account-field">
              Autor
              <input value={author} onChange={(event) => setAuthor(event.target.value)} />
            </label>
            <label className="account-field">
              Beschreibung
              <textarea
                rows={4}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>
            <label className="account-field">
              Genres / Kategorien
              <input
                value={genres}
                onChange={(event) => setGenres(event.target.value)}
                placeholder="z. B. Technik, Wissenschaft"
              />
            </label>
            <label className="account-field">
              Tags
              <input
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                placeholder="z. B. interview, deutsch"
              />
            </label>
            <p className="settings-hint">Mehrere Einträge durch Kommas trennen.</p>

            <div className="podcast-options-row">
              <label className="account-field">
                Sprache
                <input
                  value={language}
                  onChange={(event) => setLanguage(event.target.value)}
                  placeholder="z. B. de"
                />
              </label>
              <label className="podcast-options-check">
                <input
                  type="checkbox"
                  checked={explicit}
                  onChange={(event) => setExplicit(event.target.checked)}
                />
                Explizit
              </label>
            </div>

            <div className="podcast-options-actions">
              <button type="submit" className="primary-btn" disabled={busy}>
                {busy ? 'Wird gespeichert …' : 'Speichern'}
              </button>
            </div>
          </form>

          <div className="podcast-options-block">
            <h4>Folgen</h4>
            <p className="muted">
              Fehlende Folgen aus dem RSS-Feed nachladen oder die automatischen Downloads einstellen.
            </p>
            <div className="podcast-options-feed-row">
              <button type="button" className="chip" onClick={onDownload}>
                <IconPlus size={16} /> Folgen herunterladen …
              </button>
              {podcast.metadata.feedUrl ? (
                <a
                  className="text-btn"
                  href={podcast.metadata.feedUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Feed öffnen <IconExternal size={14} />
                </a>
              ) : null}
            </div>
          </div>

          <div className="podcast-options-danger">
            <h4>Podcast entfernen</h4>
            {confirmRemove ? (
              <>
                <p className="muted">
                  Der Podcast und seine Folgen werden aus der Bibliothek entfernt.
                </p>
                <label className="podcast-options-check">
                  <input
                    type="checkbox"
                    checked={hard}
                    onChange={(event) => setHard(event.target.checked)}
                  />
                  Auch die Dateien auf dem Server löschen
                </label>
                <div className="podcast-options-danger-actions">
                  <button
                    type="button"
                    className="chip is-danger"
                    disabled={busy}
                    onClick={() => void remove()}
                  >
                    Wirklich entfernen
                  </button>
                  <button
                    type="button"
                    className="text-btn"
                    onClick={() => setConfirmRemove(false)}
                  >
                    Abbrechen
                  </button>
                </div>
              </>
            ) : (
              <button
                type="button"
                className="chip is-danger"
                onClick={() => setConfirmRemove(true)}
              >
                Podcast entfernen
              </button>
            )}
          </div>
        </div>
      </aside>
    </div>
  )
}
