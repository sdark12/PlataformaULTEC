import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { Capacitor } from '@capacitor/core';

// En entorno nativo (Capacitor Android), los archivos residen físicamente en el dispositivo.
// Desregistramos cualquier Service Worker previo y limpiamos CacheStorage para garantizar que
// al instalar una nueva APK siempre se ejecute el código más reciente de forma inmediata.
if (Capacitor.isNativePlatform()) {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      for (const registration of registrations) {
        registration.unregister();
      }
    }).catch(err => console.warn('Error al desregistrar SW nativo:', err));
  }
  if ('caches' in window) {
    caches.keys().then(keys => {
      keys.forEach(key => caches.delete(key));
    }).catch(err => console.warn('Error al limpiar CacheStorage nativo:', err));
  }
} else {
  // En navegador Web (PWA), registrar Service Worker normalmente
  import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({ immediate: true });
  }).catch(() => {});
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
