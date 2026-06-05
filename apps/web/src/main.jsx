import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

// Side-effect imports: install the data layer (window.BAL) and the AI shim
// before any page module reads them.
import './lib/bal.js'
import './lib/claude.js'
import './index.css'

import App from './App.jsx'
import Auth from './pages/Auth.jsx'
import Onboarding from './pages/Onboarding.jsx'
import { AuthProvider, useAuth } from './lib/auth.jsx'

function Splash() {
  return (
    <div style={{ display: 'grid', placeItems: 'center', height: '100vh', color: 'var(--muted, #64748b)' }}>
      Loading…
    </div>
  )
}

// Routes the user to auth vs the app based on session status. Setup + anonymous
// both render <Auth/>, which adapts its copy based on whether setup is needed.
function Gate() {
  const { status, onboarded } = useAuth()

  if (status === 'loading') return <Splash />

  if (status !== 'authed') {
    return (
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>
    )
  }

  // New accounts run the first-run onboarding before reaching the app.
  if (!onboarded) return <Onboarding />

  return (
    <Routes>
      <Route path="/auth" element={<Navigate to="/" replace />} />
      <Route path="/*" element={<App />} />
    </Routes>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
