import type { AbsFeedPodcast } from '../api/abs'
import { episodeKey, feedDate } from '../lib/podcastFeed'
import { IconClose } from './Icons'

/*
 * The setup window for a podcast: it shows what the feed holds and lets the
 * reader choose how many episodes to download now, plus whether the server
 * should keep checking for new ones. It is used both while adding a show and
 * later from the show's page, where it lists what is missing.
 */

function sizeLabel(episode: AbsFeedPodcast['episodes'][number]): string {
  const bytes = Number(episode.enclosure?.length)
  if (!Number.isFinite(bytes) || bytes <= 0) return ''
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

export function PodcastSetup({
  heading,
  cover,
  title,
  author,
  feed,
  loading,
  error,
  existing,
  selected,
  onToggle,
  onSelectAll,
  onSelectNone,
  autoDownload,
  onAutoDownload,
  editingMeta = false,
  tags,
  onTags,
  genres,
  onGenres,
  busy,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  heading: string
  cover?: string
  title: string
  author?: string
  feed: AbsFeedPodcast | null
  loading: boolean
  error: string
  /** Feed keys of episodes the library already has. */
  existing: Set<string>
  selected: Set<number>
  onToggle: (index: number) => void
  onSelectAll: () => void
  onSelectNone: () => void
  autoDownload: boolean
  onAutoDownload: (value: boolean) => void
  /** Show the tag and genre fields (only while adding a show). */
  editingMeta?: boolean
  tags?: string
  onTags?: (value: string) => void
  genres?: string
  onGenres?: (value: string) => void
  busy: boolean
  confirmLabel: string
  onConfirm: () => void
  onClose: () => void
}) {
  const episodes = feed?.episodes ?? []
  const chosen = selected.size

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <aside
        className="sheet podcast-setup"
        role="dialog"
        aria-modal="true"
        aria-label={heading}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="sheet-head">
          <h3>{heading}</h3>
          <button type="button" className="icon-btn" aria-label="Schließen" onClick={onClose}>
            <IconClose />
          </button>
        </header>

        <div className="sheet-body">
          <div className="podcast-setup-meta">
            {cover ? <img className="podcast-setup-cover" src={cover} alt="" /> : null}
            <div>
              <strong>{title}</strong>
              {author ? <span className="muted">{author}</span> : null}
              {feed ? (
                <span className="muted">
                  {episodes.length} {episodes.length === 1 ? 'Folge' : 'Folgen'} im Feed
                </span>
              ) : null}
            </div>
          </div>

          {loading ? <p className="muted">Folgen werden geladen …</p> : null}
          {error ? <p className="error">{error}</p> : null}

          <label className="podcast-auto">
            <input
              type="checkbox"
              checked={autoDownload}
              onChange={(event) => onAutoDownload(event.target.checked)}
            />
            <span>
              <strong>Neue Folgen automatisch laden</strong>
              <small>Der Server prüft den Feed und lädt neue Folgen selbst herunter.</small>
            </span>
          </label>

          {editingMeta ? (
            <div className="podcast-meta-fields">
              <label className="account-field">
                Genres / Kategorien
                <input
                  value={genres ?? ''}
                  onChange={(event) => onGenres?.(event.target.value)}
                  placeholder="z. B. Technik, Wissenschaft"
                />
              </label>
              <label className="account-field">
                Tags
                <input
                  value={tags ?? ''}
                  onChange={(event) => onTags?.(event.target.value)}
                  placeholder="z. B. interview, deutsch"
                />
              </label>
              <p className="settings-hint">Mehrere Einträge durch Kommas trennen.</p>
            </div>
          ) : null}

          {episodes.length ? (
            <>
              <div className="podcast-setup-subhead">
                <strong>Folgen herunterladen</strong>
                <span className="podcast-setup-links">
                  <button type="button" className="text-btn" onClick={onSelectAll}>
                    Alle
                  </button>
                  <button type="button" className="text-btn" onClick={onSelectNone}>
                    Keine
                  </button>
                  <span className="muted">{chosen} gewählt</span>
                </span>
              </div>

              <div className="podcast-feed-list">
                {episodes.map((episode, index) => {
                  const key = episodeKey(episode)
                  const already = existing.has(key)
                  const size = sizeLabel(episode)
                  return (
                    <label
                      key={`${key}:${index}`}
                      className={`podcast-feed-row ${already ? 'is-existing' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={already || selected.has(index)}
                        disabled={already}
                        onChange={() => onToggle(index)}
                      />
                      <span className="podcast-feed-text">
                        <strong>{episode.title || 'Ohne Titel'}</strong>
                        <small>
                          {[feedDate(episode), size, already ? 'Schon vorhanden' : null]
                            .filter(Boolean)
                            .join(' · ')}
                        </small>
                      </span>
                    </label>
                  )
                })}
              </div>
            </>
          ) : !loading && !error ? (
            <p className="muted">Der Feed enthält keine Folgen.</p>
          ) : null}
        </div>

        <footer className="podcast-setup-actions">
          <button type="button" className="text-btn" onClick={onClose}>
            Abbrechen
          </button>
          <button
            type="button"
            className="primary-btn"
            disabled={busy || loading}
            onClick={onConfirm}
          >
            {busy ? 'Wird gespeichert …' : confirmLabel}
          </button>
        </footer>
      </aside>
    </div>
  )
}
