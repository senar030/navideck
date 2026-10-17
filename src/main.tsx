import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { registerServiceWorker, watchInstall } from './lib/pwa.ts'

// PWA plumbing: an installable app needs a manifest, icons and a service
// worker that controls the page.
watchInstall()
registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
