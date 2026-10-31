import type { Song } from '../api/types'
import { usePlayer } from '../state/PlayerContext'
import { IconPlay, IconSpinner } from './Icons'

/*
 * A play glyph that turns into a spinner while the player is still fetching the
 * track. `match` narrows the spinner to the button whose content is loading;
 * without it every play button spins, which suits the player bar itself.
 */
export function PlayGlyph({ size = 22, match }: { size?: number; match?: (song: Song) => boolean }) {
  const { loading, current } = usePlayer()
  const spinning = loading && (!match || (current ? match(current) : false))
  return spinning ? <IconSpinner size={size} /> : <IconPlay size={size} />
}
