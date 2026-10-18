import { LoginScreen } from './components/LoginScreen'
import { Shell } from './components/Shell'
import { AuthProvider } from './state/AuthProvider'
import { useAuth } from './state/AuthContext'
import { NavProvider } from './state/NavProvider'
import { PlayerProvider } from './state/PlayerProvider'
import { PrefsProvider } from './state/PrefsProvider'
import { ThemeProvider } from './state/ThemeProvider'

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
