/**
 * Takes the place of the seek bar while a radio stream plays: a live stream has
 * no beginning, no end, and nothing to drag.
 */
export function LiveBadge({ detail }: { detail?: string }) {
  return (
    <>
      <span className="live-badge">
        <span className="live-dot" aria-hidden />
        LIVE
      </span>
      {detail ? <span className="live-detail">{detail}</span> : null}
    </>
  )
}
