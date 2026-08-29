import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { UnitProvider } from './context/UnitContext'
import { TelemetryProvider } from './context/TelemetryContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <UnitProvider>
      <TelemetryProvider>
        <App />
      </TelemetryProvider>
    </UnitProvider>
  </StrictMode>,
)

// Register Service Worker for PWA with auto-update
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(registration => {
      registration.update();
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              window.location.reload();
            }
          });
        }
      });
    }).catch(() => {});
  });
}
