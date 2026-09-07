import React from "react";
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import { preventPinchZoom } from "./lib/preventZoom";
import { initNativeApp } from "./lib/platform";
import { initNativePush } from "./lib/push";

// Native-app feel: block browser pinch-zoom gestures (viewport meta covers
// touch pinch/focus-zoom; this covers desktop trackpad + Safari gestures).
preventPinchZoom();

// Native (iOS/Android) startup tweaks — no-op on web.
void initNativeApp();
// Attach native push listeners + refresh the device token if already granted.
void initNativePush();

// Register the PWA service worker in standalone production pages. Embedded
// previews intentionally skip it so they cannot retain a stale app shell.
let isIframe = false;
try {
  isIframe = window.self !== window.top;
} catch {
  isIframe = true;
}
const shouldRegisterServiceWorker = import.meta.env.PROD && !isIframe;

if ('serviceWorker' in navigator && shouldRegisterServiceWorker) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('Service Worker registered');

        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        
        // Check for updates occasionally while the app is visible. Every
        // minute was needless network churn for a long-running PWA session.
        setInterval(() => {
          if (document.visibilityState === 'visible') void registration.update();
        }, 15 * 60 * 1000);

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

        // Do not force-reload on controllerchange. The old implementation did
        // this while the activating worker also navigated every client, which
        // could turn one refresh into a visible double refresh. The new worker
        // takes over quietly and the next natural navigation gets the update.
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
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </React.StrictMode>
);
