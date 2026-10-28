import type { AbsFeedEpisode, AbsFeedPodcast } from '../api/abs'

/*
 * Small helpers for the RSS feed behind a podcast: identity, dates and the
 * newest-first order the setup window shows.
 */

export function episodeKey(episode: AbsFeedEpisode): string {
  const guid = episode.guid?.trim()
  if (guid) return guid
  return `${episode.title.trim()}|${episode.publishedAt ?? episode.pubDate ?? ''}`
}

function episodeDate(episode: AbsFeedEpisode): number | null {
  if (typeof episode.publishedAt === 'number' && episode.publishedAt > 0) return episode.publishedAt
  if (episode.pubDate) {
    const at = Date.parse(episode.pubDate)
    if (!Number.isNaN(at)) return at
  }
  return null
}

export function feedDate(episode: AbsFeedEpisode): string {
  const at = episodeDate(episode)
  if (!at) return 'Ohne Datum'
  return new Date(at).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

/** Newest first, so the first rows are the ones to download. */
export function sortFeed(feed: AbsFeedPodcast): AbsFeedPodcast {
  return {
    ...feed,
    episodes: [...feed.episodes].sort((a, b) => (episodeDate(b) ?? 0) - (episodeDate(a) ?? 0)),
  }
}
