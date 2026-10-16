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

  return (
    <div className={`cover ${className}`}>
      {src && src !== failedSrc ? (
        <img src={src} alt={alt} draggable={false} onError={() => setFailedSrc(src)} />
      ) : (
        <div className="cover-fallback" aria-hidden />
      )}
    </div>
  )
}
