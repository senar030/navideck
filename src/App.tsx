import { LoginScreen } from './components/LoginScreen'
import { Shell } from './components/Shell'
import { AuthProvider, useAuth } from './state/AuthContext'
import { NavProvider } from './state/NavContext'
import { PlayerProvider } from './state/PlayerContext'

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
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
