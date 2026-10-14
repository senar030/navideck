export function centerInScroller(scroller: HTMLElement | null, item: HTMLElement | null, smooth = true) {
  if (!scroller || !item) return
  const sRect = scroller.getBoundingClientRect()
  const iRect = item.getBoundingClientRect()
  const top = scroller.scrollTop + (iRect.top - sRect.top) - sRect.height / 2 + iRect.height / 2
  scroller.scrollTo({ top: Math.max(0, top), behavior: smooth ? 'smooth' : 'auto' })
}
