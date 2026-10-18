import { useId } from 'react'

type IconProps = { size?: number }

export function IconLogo({ size = 30 }: IconProps) {
  const raw = useId()
  const id = `nl-${raw.replace(/[^a-zA-Z0-9]/g, '')}`
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <rect width="32" height="32" rx="9.5" fill={`url(#${id})`} />
      <path
        d="M10.5 21.5V10.5L21.5 21.5V10.5"
        stroke="#fff"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--accent)" />
          <stop offset="1" stopColor="var(--accent-2)" />
        </linearGradient>
      </defs>
    </svg>
  )
}

export function IconRadio({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="2.1" fill="currentColor" stroke="none" />
      <path d="M7.2 7.2a6.8 6.8 0 0 1 9.6 9.6" />
      <path d="M4.6 4.6a10.5 10.5 0 0 1 14.8 14.8" />
    </svg>
  )
}
export function IconSpark({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
      <path d="M12 3.5 13.2 8.5 18 9.2 14.4 12.6 15.5 18 12 15.4 8.5 18 9.6 12.6 6 9.2 10.8 8.5 12 3.5z" />
    </svg>
  )
}
export function IconHome({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 3 3 12h3v8h5v-6h2v6h5v-8h3L12 3z" />
    </svg>
  )
}
export function IconSun({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M11 4h2v3h-2V4zm0 13h2v3h-2v-3zM4 11h3v2H4v-2zm13 0h3v2h-3v-2zM6.2 6.2l2.1 2.1-1.4 1.4-2.1-2.1 1.4-1.4zm10.5 10.5 2.1 2.1-1.4 1.4-2.1-2.1 1.4-1.4zM17.8 6.2l1.4 1.4-2.1 2.1-1.4-1.4 2.1-2.1zM6.2 17.8l1.4-1.4 2.1 2.1-1.4 1.4-2.1-2.1zM12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8z" />
    </svg>
  )
}
export function IconMoon({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M15.5 3.5A7.5 7.5 0 1 0 20.5 14 6 6 0 0 1 15.5 3.5z" />
    </svg>
  )
}

export function IconPlay({ size = 28 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5.14v13.72L19 12 8 5.14z" />
    </svg>
  )
}
export function IconPause({ size = 28 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 5h4v14H6V5zm8 0h4v14h-4V5z" />
    </svg>
  )
}
export function IconPrev({ size = 26 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 6h2v12H6V6zm3.5 6L18 18V6l-8.5 6z" />
    </svg>
  )
}
export function IconNext({ size = 26 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16 6h2v12h-2V6zM6 18l8.5-6L6 6v12z" />
    </svg>
  )
}
export function IconShuffle({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M10.59 9.17 5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.46 7.96 19.5 10V4h-5zm.33 9.41-1.41 1.41 3.13 3.13L14.5 20H19.5v-5l-2.04 2.04-3.13-3.63z" />
    </svg>
  )
}
export function IconRepeat({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z" />
    </svg>
  )
}
export function IconStar({ size = 22, filled = false }: IconProps & { filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M12 3.5 14.9 9.3l6.4.9-4.6 4.5 1.1 6.4L12 18.1 6.2 21.1l1.1-6.4L2.7 10.2l6.4-.9L12 3.5z" />
    </svg>
  )
}
export function IconQueue({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M3 5h18v2H3V5zm0 6h12v2H3v-2zm0 6h12v2H3v-2zm14-1.5v7l6-3.5-6-3.5z" />
    </svg>
  )
}
export function IconSearch({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  )
}
export function IconBack({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M15.5 5 8 12.5 15.5 20l1.4-1.4-6.1-6.1 6.1-6.1z" />
    </svg>
  )
}
export function IconAlbums({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2a10 10 0 1 0 .01 20.01A10 10 0 0 0 12 2zm0 14.5a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9zm0-6.5a2 2 0 1 0 .01 4.01A2 2 0 0 0 12 10z" />
    </svg>
  )
}
export function IconArtists({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm0 2c-3.3 0-10 1.7-10 5v3h20v-3c0-3.3-6.7-5-10-5z" />
    </svg>
  )
}
export function IconGenres({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M3 6.5A3.5 3.5 0 0 1 6.5 3H10v4.5A3.5 3.5 0 0 1 6.5 11 3.5 3.5 0 0 1 3 7.5V6.5zm8-3.5h6.5A3.5 3.5 0 0 1 21 6.5v1A3.5 3.5 0 0 1 17.5 11 3.5 3.5 0 0 1 14 7.5V3zM3 15.5A3.5 3.5 0 0 1 6.5 12H10v4.5A3.5 3.5 0 0 1 6.5 20 3.5 3.5 0 0 1 3 16.5v-1zm8-3.5h6.5A3.5 3.5 0 0 1 21 15.5v1a3.5 3.5 0 0 1-3.5 3.5A3.5 3.5 0 0 1 14 16.5V12z" />
    </svg>
  )
}
export function IconGrid({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z" />
    </svg>
  )
}
export function IconLists({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M3 5h18v3H3V5zm0 5.5h18v3H3v-3zM3 16h12v3H3v-3z" />
    </svg>
  )
}
export function IconVolume({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M3 10v4h4l5 5V5L7 10H3zm13.5 2a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z" />
    </svg>
  )
}
export function IconSettings({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.03 7.03 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.59.24-1.13.55-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.77 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.89 14.5a.5.5 0 0 0-.12.64l1.92 3.32c.13.23.4.32.64.22l2.39-.96c.5.39 1.04.7 1.63.94l.36 2.54c.05.24.26.42.5.42h3.84c.24 0 .45-.18.5-.42l.36-2.54c.59-.24 1.13-.55 1.63-.94l2.39.96c.24.1.51 0 .64-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z" />
    </svg>
  )
}
export function IconPlayNext({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M4 6v12l8.5-6L4 6zm10 0h2v12h-2V6zm4 0h2v12h-2V6z" />
    </svg>
  )
}
export function IconMore({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="12" cy="5" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="19" r="2" />
    </svg>
  )
}
export function IconGamepad({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8.5 7h7A6.5 6.5 0 0 1 22 13.5 4.5 4.5 0 0 1 17.5 18c-1.1 0-2.1-.4-2.9-1.1L13.5 16h-3l-1.1.9A4.5 4.5 0 0 1 6.5 18 4.5 4.5 0 0 1 2 13.5 6.5 6.5 0 0 1 8.5 7zM7 11v2h2v2h2v-2h2v-2h-2V9H9v2H7zm8.2.2a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2zm2.4-1.6a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2z" />
    </svg>
  )
}
export function IconDesktop({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M3 4h18a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-7v2h3v2H7v-2h3v-2H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm1 2v9h16V6H4z" />
    </svg>
  )
}
export function IconRefresh({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.65 6.35A8 8 0 1 0 20 12h-2a6 6 0 1 1-1.76-4.24L13 11h7V4l-2.35 2.35z" />
    </svg>
  )
}
export function IconArrowRight({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}
export function IconClose({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3z" />
    </svg>
  )
}
export function IconPlus({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}
export function IconCheck({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12.5 10 17.5 19 7" />
    </svg>
  )
}
export function IconExternal({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 4h6v6M20 4l-8.5 8.5" />
      <path d="M19 14.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h4.5" />
    </svg>
  )
}
