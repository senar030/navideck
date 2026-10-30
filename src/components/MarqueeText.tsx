import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

type Props = {
  children: ReactNode
  /** Class of the clipping box, so titles keep their existing styling. */
  className?: string
  /** Rows that must never move (off screen ones are skipped anyway). */
  enabled?: boolean
  /** Keeps a list from starting every ribbon at the same moment. */
  delay?: number
}

/* Slow enough to read, and every title on the page shares one observer, so a
   long album does not spin up hundreds of animations. */
const SPEED = 20 // pixels per second
const TOLERANCE = 8 // hidden pixels before a title is worth moving

const watchers = new WeakMap<Element, (onScreen: boolean) => void>()
let observer: IntersectionObserver | null = null

function watch(element: Element, onChange: (onScreen: boolean) => void) {
  if (typeof IntersectionObserver === 'undefined') {
    onChange(true)
    return () => {}
  }
  if (!observer) {
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) watchers.get(entry.target)?.(entry.isIntersecting)
      },
      { rootMargin: '120px 0px' },
    )
  }
  watchers.set(element, onChange)
  observer.observe(element)
  return () => {
    watchers.delete(element)
    observer?.unobserve(element)
  }
}

/* One observer for every ribbon: a grid can carry hundreds of titles. */
const sizeWatchers = new WeakMap<Element, () => void>()
let sizeObserver: ResizeObserver | null = null

function watchSize(element: Element, onChange: () => void) {
  if (typeof ResizeObserver === 'undefined') return () => {}
  if (!sizeObserver) {
    sizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) sizeWatchers.get(entry.target)?.()
    })
  }
  sizeWatchers.set(element, onChange)
  sizeObserver.observe(element)
  return () => {
    sizeWatchers.delete(element)
    sizeObserver?.unobserve(element)
  }
}

/**
 * A title that is too long for its box: shortened with an ellipsis, and — while
 * it is on screen — drifting to the end and slowly back again, so a long
 * chapter name stays readable without ever widening the row.
 */
export function MarqueeText({ children, className = '', enabled = true, delay = 1.2 }: Props) {
  const box = useRef<HTMLSpanElement>(null)
  const textWidth = useRef(0)
  const [shift, setShift] = useState(0)
  const [onScreen, setOnScreen] = useState(false)
  /*
   * Whether a title may move at all is decided while rendering, so the effect
   * below has nothing to undo and only ever measures. The app's ribbon is a
   * deliberate request, so it also runs when the OS asks for reduced motion:
   * a slow, single-line drift is easy to ignore, and the alternative was that
   * long titles stayed unreadable.
   */
  const still = !enabled

  useEffect(() => {
    const element = box.current
    if (!element || still) return

    const measure = () => {
      /*
       * While the ribbon runs the box is transformed, which would skew the
       * measurement. The width of the string does not change, so the value from
       * the resting state is kept and only the available room is re-read.
       */
      if (!element.classList.contains('is-running')) {
        const range = element.ownerDocument.createRange()
        range.selectNodeContents(element)
        textWidth.current = range.getBoundingClientRect().width
      }
      const hidden = textWidth.current - element.clientWidth
      setShift(hidden > TOLERANCE ? Math.round(hidden) : 0)
    }

    /*
     * The first measurement waits a frame, both because the box has to be laid
     * out before its width means anything and because the effect itself must not
     * set state.
     */
    const frame = requestAnimationFrame(measure)
    const resize = watchSize(element, measure)
    const stop = watch(element, setOnScreen)
    /* Web fonts arrive after the first paint and change the text width. */
    void element.ownerDocument.fonts?.ready.then(measure).catch(() => {})
    return () => {
      cancelAnimationFrame(frame)
      resize()
      stop()
    }
  }, [children, still])

  const running = shift > 0 && onScreen
  const duration = shift ? Math.min(26, Math.max(8, Math.round(shift / SPEED))) : 0
  const style = running
    ? ({
        '--marquee-shift': `-${shift}px`,
        '--marquee-dur': `${duration}s`,
        '--marquee-delay': `${delay}s`,
      } as CSSProperties)
    : undefined

  return (
    <span ref={box} className={`${className}${running ? ' is-running' : ''}`} style={style}>
      <span className="marquee-run">{children}</span>
    </span>
  )
}
