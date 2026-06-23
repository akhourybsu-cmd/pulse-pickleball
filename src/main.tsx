import React from "react";
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";

// Register service worker for PWA
const isPreviewHost =
  window.location.hostname.startsWith('id-preview--') ||
  window.location.hostname.startsWith('preview--') ||
  window.location.hostname === 'lovableproject.com' ||
  window.location.hostname.endsWith('.lovableproject.com') ||
  window.location.hostname === 'lovableproject-dev.com' ||
  window.location.hostname.endsWith('.lovableproject-dev.com') ||
  window.location.hostname === 'beta.lovable.dev' ||
  window.location.hostname.endsWith('.beta.lovable.dev');

let isIframe = false;
try {
  isIframe = window.self !== window.top;
} catch {
  isIframe = true;
}
const shouldRegisterServiceWorker = import.meta.env.PROD && !isPreviewHost && !isIframe;

if ('serviceWorker' in navigator && shouldRegisterServiceWorker) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('Service Worker registered');
        const hadController = Boolean(navigator.serviceWorker.controller);

        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        
        // Check for updates periodically
        setInterval(() => {
          registration.update();
        }, 60000);

        // Listen for updates and activate them automatically.
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                newWorker.postMessage({ type: 'SKIP_WAITING' });
              }
            });
          }
        });

        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (!hadController || refreshing) return;
          refreshing = true;
          window.location.reload();
        });
      })
      .catch((error) => {
        console.log('Service Worker registration failed:', error);
      });
  });
} else if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then((registrations) => {
      registrations
        .filter((registration) => registration.active?.scriptURL.endsWith('/sw.js') || registration.scope === `${window.location.origin}/`)
        .forEach((registration) => registration.unregister());
    })
    .catch((error) => {
      console.log('Service Worker cleanup skipped:', error);
    });
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
