import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'

// Side-effect imports: install the shared data layer (window.BAL) and the
// AI completion shim before any page module reads them.
import './lib/bal.js'
import './lib/claude.js'
import './index.css'

import App from './App.jsx'
import Auth from './pages/Auth.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/*" element={<App />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
