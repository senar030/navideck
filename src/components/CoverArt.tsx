import { useState } from 'react'
import { useAuth } from '../state/AuthContext'

type Props = {
  coverArt?: string
  alt: string
  size?: number
  className?: string
}

export function CoverArt({ coverArt, alt, size = 300, className = '' }: Props) {
  const { client } = useAuth()
  const src = client?.coverUrl(coverArt, size)
  // Remember which src failed so a later, different cover can still load.
  const [failedSrc, setFailedSrc] = useState<string>()

  function onError() {
    setFailedSrc(src)
    // The service worker keeps cover art around; a cover that failed must not
    // stay in there forever, or the album would never recover.
    navigator.serviceWorker?.controller?.postMessage({ type: 'FORGET_COVER', url: src })
  }

  return (
    <div className={`cover ${className}`}>
      {src && src !== failedSrc ? (
        <img
          // Covers are the most numerous thing on screen: let the browser fetch
          // them as they scroll in, decode them off the main thread, and know
          // the aspect ratio before the bytes arrive.
          loading="lazy"
          decoding="async"
          width={size}
          height={size}
          src={src}
          alt={alt}
          draggable={false}
          onError={onError}
        />
      ) : (
        <div className="cover-fallback" aria-hidden />
      )}
    </div>
  )
}
