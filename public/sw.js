// PULSE Pickleball service worker.
//
// Three responsibilities:
//   1. Caching — install/activate/fetch with a network-first fallback.
//   2. Push    — receive Web Push payloads and surface them as OS notifications.
//   3. Clicks  — route a tapped notification to the right in-app URL.
//
// The push handler is intentionally permissive about payload shape so
// the same SW works against the push-send edge function (Phase 3.3)
// and against arbitrary server-sent payloads in the future.

const CACHE_VERSION = 'pulse-v4-push';
const urlsToCache = [
  '/',
  '/index.html',
  '/pulse-icon.jpg',
];

// Install - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(urlsToCache))
  );
});

// Activate - clear old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_VERSION) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const responseToCache = response.clone();
        caches.open(CACHE_VERSION).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// =====================================================================
// Push event — show a system notification when the server sends one.
// Payload shape (from push-send edge function):
//   { title, body, url?, tag?, icon?, badge?, priority? }
// =====================================================================
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    // Push payload wasn't JSON — fall back to text.
    data = { title: 'PULSE', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'PULSE';
  const options = {
    body: data.body || '',
    icon: data.icon || '/pulse-icon.jpg',
    badge: data.badge || '/pulse-favicon.svg',
    // tag collapses repeated notifications (e.g. two updates on the
    // same group) onto a single row instead of stacking.
    tag: data.tag || 'pulse',
    data: { url: data.url || '/' },
    // High-priority notifications (announcements, 1-hour event reminders)
    // request requireInteraction so they stay visible until tapped.
    requireInteraction: data.priority === 'high',
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// =====================================================================
// Notification click — focus an existing window if one is open, else
// open a new one to the URL the server attached.
// =====================================================================
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        // If the app is already open somewhere, focus it and navigate.
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) {
            try { client.navigate(targetUrl); } catch (_) { /* ignore */ }
          }
          return;
        }
      }
      // Otherwise spawn a fresh window.
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
