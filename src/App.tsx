import { LoginScreen } from './components/LoginScreen'
import { Shell } from './components/Shell'
import { AuthProvider, useAuth } from './state/AuthContext'
import { NavProvider } from './state/NavContext'
import { PlayerProvider } from './state/PlayerContext'
import { PrefsProvider } from './state/PrefsContext'
import { ThemeProvider } from './state/ThemeContext'

export default function App() {
  return (
    <ThemeProvider>
      <PrefsProvider>
        <AuthProvider>
          <Gate />
        </AuthProvider>
      </PrefsProvider>
    </ThemeProvider>
  )
}

function Gate() {
  const { client } = useAuth()
  if (!client) return <LoginScreen />
  return (
    <PlayerProvider>
      <NavProvider>
        <Shell />
      </NavProvider>
    </PlayerProvider>
  )
}
