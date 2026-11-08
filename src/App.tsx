import { Onboarding } from './components/Onboarding'
import { Shell } from './components/Shell'
import { IconLogo } from './components/Icons'
import { useUpdateAvailable } from './lib/pwa'
import { AccountProvider } from './state/AccountProvider'
import { useAccount } from './state/AccountContext'
import { AuthProvider } from './state/AuthProvider'
import { NavProvider } from './state/NavProvider'
import { PlayerProvider } from './state/PlayerProvider'
import { PrefsProvider } from './state/PrefsProvider'
import { ThemeProvider } from './state/ThemeProvider'

export default function App() {
  return (
    <ThemeProvider>
      <PrefsProvider>
        <AccountProvider>
          <AuthProvider>
            <Gate />
            <UpdateBanner />
          </AuthProvider>
        </AccountProvider>
      </PrefsProvider>
    </ThemeProvider>
  )
}

/*
 * A redeploy does not always reach an installed web app: iOS resumes the old
 * document from memory and never asks again. This is the one place that
 * notices a newer bundle and offers the reload, so it also works before a
 * server is set up.
 */
function UpdateBanner() {
  const available = useUpdateAvailable()
  if (!available) return null
  return (
    <div className="update-banner" role="status">
      <span>Neue Version verfügbar</span>
      <button type="button" className="text-btn" onClick={() => window.location.reload()}>
        Neu laden
      </button>
    </div>
  )
}

function Gate() {
  const { sources, ready } = useAccount()
  /* No server yet: the app has nothing to show but the way in. */
  if (!sources.length) return <Onboarding />
  if (!ready) return <Boot />
  return (
    <PlayerProvider>
      <NavProvider>
        <Shell />
      </NavProvider>
    </PlayerProvider>
  )
}

function Boot() {
  return (
    <main className="boot">
      <div className="boot-mark" aria-hidden>
        <IconLogo size={44} />
      </div>
      <p className="boot-text">Server werden verbunden …</p>
    </main>
  )
}
