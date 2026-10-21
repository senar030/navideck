import { useMemo, useState } from 'react'
import { podcastOf, sortEpisodes } from '../lib/absHelpers'
import { useAbsPlayer } from '../lib/useAbsPlayer'
import { useAsync } from '../lib/useAsync'
import { stripHtml } from '../lib/format'
import { useAccount } from '../state/AccountContext'
import { AbsCover, EpisodeRow, MissingAbs } from './AbsParts'
import { IconPlay } from './Icons'

const PAGE = 80

export function PodcastDetail({ id }: { id: string }) {
  const { abs, progress } = useAccount()
  const { playEpisode } = useAbsPlayer()
  const [limit, setLimit] = useState(PAGE)
  const client = abs?.client ?? null
  const result = useAsync(client ? () => client.getItem(id) : null, [client, id])

  const item = result.data
  const podcast = item ? podcastOf(item) : null
  const episodes = useMemo(
    () => sortEpisodes(podcast?.episodes ?? [], 'newest', false),
    [podcast],
  )

  if (!abs) return <MissingAbs noun="Podcast" />
  if (result.error) return <p className="error">{result.error}</p>
  if (!item || !podcast) return <p className="muted">Podcast wird geladen …</p>

  const cover = abs.client.coverUrl(id)
  const shown = episodes.slice(0, limit)
  const latest = episodes[0]

  return (
    <div className="view detail abs-detail">
      <div className="hero-banner">
        <img className="hero-bg" src={cover} alt="" />
        <div className="hero-veil" />
        <div className="hero">
          <AbsCover src={cover} className="hero-cover" />
          <div className="hero-copy">
            <p className="eyebrow">Podcast</p>
            <h2>{podcast.metadata.title}</h2>
            <p className="hero-artist">{podcast.metadata.author || 'Unbekannt'}</p>
            <p className="hero-meta muted">
              {[
                episodes.length ? `${episodes.length} ${episodes.length === 1 ? 'Folge' : 'Folgen'}` : null,
                podcast.metadata.genres?.slice(0, 2).join(', '),
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            <div className="hero-actions">
              {latest ? (
                <button
                  type="button"
                  className="primary-btn"
                  onClick={() => void playEpisode(item, latest)}
                >
                  <IconPlay size={22} /> Neueste Folge
                </button>
              ) : null}
              {podcast.metadata.feedUrl ? (
                <a
                  className="text-btn"
                  href={podcast.metadata.feedUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Feed öffnen
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {podcast.metadata.description ? (
        <section className="abs-section">
          <h3>Über den Podcast</h3>
          <p className="abs-description">{stripHtml(podcast.metadata.description)}</p>
        </section>
      ) : null}

      <section className="abs-section">
        <h3>Folgen</h3>
        {!episodes.length ? <p className="muted">Noch keine Folgen geladen.</p> : null}
        <div className="abs-episodes">
          {shown.map((episode) => (
            <EpisodeRow
              key={episode.id}
              item={item}
              episode={episode}
              progress={progress}
              onOpen={() => undefined}
              onPlay={() => void playEpisode(item, episode)}
            />
          ))}
        </div>
        {episodes.length > shown.length ? (
          <div className="load-more">
            <button type="button" className="chip" onClick={() => setLimit((n) => n + PAGE)}>
              Weitere Folgen laden
            </button>
          </div>
        ) : null}
      </section>
    </div>
  )
}
