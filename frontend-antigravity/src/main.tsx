import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Register Service Worker for PWA
import { registerSW } from 'virtual:pwa-register'
registerSW({ immediate: true })

window.addEventListener('error', (e) => { document.body.innerHTML = '<div style="padding: 20px; color: red;"><h1>Error:</h1><pre>' + e.error.stack + '</pre></div>'; }); ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
