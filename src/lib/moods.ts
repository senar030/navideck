export const MOODS = [
  { id: 'chill', label: 'Entspannt', genres: ['ambient', 'chill', 'jazz', 'acoustic', 'lounge', 'klassik'] },
  { id: 'happy', label: 'Fröhlich', genres: ['pop', 'indie', 'britpop', 'folk', 'funk'] },
  { id: 'energy', label: 'Energie', genres: ['rock', 'punk', 'metal', 'hardcore', 'elektron'] },
  { id: 'sad', label: 'Melancholie', genres: ['blues', 'soul', 'doom', 'dark'] },
  { id: 'focus', label: 'Fokus', genres: ['klassik', 'ambient', 'instrumental', 'piano'] },
  { id: 'party', label: 'Party', genres: ['dance', 'hip hop', 'rap', 'house', 'disco', 'elektron'] },
] as const

export type MoodId = (typeof MOODS)[number]['id']

export function matchMoodGenre(moodId: MoodId, available: string[]): string | undefined {
  const mood = MOODS.find((m) => m.id === moodId)
  if (!mood) return undefined
  const lower = available.map((g) => g.toLowerCase())
  for (const needle of mood.genres) {
    const hit = available.find((_, i) => lower[i]?.includes(needle))
    if (hit) return hit
  }
  return undefined
}
