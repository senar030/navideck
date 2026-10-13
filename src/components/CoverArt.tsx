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
  return (
    <div className={`cover ${className}`}>
      {src ? <img src={src} alt={alt} draggable={false} /> : <div className="cover-fallback" aria-hidden />}
    </div>
  )
}
