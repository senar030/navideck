import { Onboarding } from './components/Onboarding'
import { Shell } from './components/Shell'
import { IconLogo } from './components/Icons'
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
          </AuthProvider>
        </AccountProvider>
      </PrefsProvider>
    </ThemeProvider>
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
