/*
 * Where a view was left behind. Navigating opens a detail page and the browser
 * back button returns to the list, but the list lives inside `.main-body`,
 * whose scroll position the browser does not restore for us. The memory is
 * deliberately in-memory: a fresh start of the app begins at the top, while a
 * trip into a detail page and back lands where the click happened.
 */

const positions = new Map<string, number>()

/** Keeps the last real position; the top needs no entry. */
export function saveScroll(key: string, top: number): void {
  if (top > 0.5) positions.set(key, top)
  else positions.delete(key)
}

/**
 * Put the scroller back where it was. A list that fetches its items after the
 * view renders is shorter than the saved position for a moment, so keep trying
 * until the content is tall enough — or the reader takes over, whichever comes
 * first.
 */
export function restoreScroll(element: HTMLElement, key: string): () => void {
  const target = positions.get(key)
  if (!target) return () => {}

  let frame = 0
  let stopped = false
  const deadline = performance.now() + 8000

  const stop = () => {
    if (stopped) return
    stopped = true
    cancelAnimationFrame(frame)
    element.removeEventListener('wheel', stop)
    element.removeEventListener('touchstart', stop)
    element.removeEventListener('pointerdown', stop)
    element.removeEventListener('keydown', stop)
  }

  const tick = () => {
    if (stopped) return
    const max = element.scrollHeight - element.clientHeight
    if (max >= target - 1) {
      element.scrollTop = target
      if (Math.abs(element.scrollTop - target) <= 1) {
        stop()
        return
      }
    } else {
      /*
       * A paged list only fetches its next page when its end comes into view.
       * Sitting at the top would never get the content back that the saved
       * position needs, so walk to the current end and let it load.
       */
      if (Math.abs(element.scrollTop - max) > 0.5) element.scrollTop = max
    }
    if (performance.now() > deadline) {
      stop()
      return
    }
    frame = requestAnimationFrame(tick)
  }

  // A reader who starts scrolling again owns the position from now on.
  element.addEventListener('wheel', stop, { passive: true })
  element.addEventListener('touchstart', stop, { passive: true })
  element.addEventListener('pointerdown', stop, { passive: true })
  element.addEventListener('keydown', stop)
  frame = requestAnimationFrame(tick)
  return stop
}
