import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { css } from './theme.js'

// The boundary carries its own <style> because a crash can happen before App
// has rendered the theme — without it the fallback would appear unstyled.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <style>{css(true)}</style>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
