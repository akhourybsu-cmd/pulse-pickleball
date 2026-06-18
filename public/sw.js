const CACHE_VERSION = 'pulse-v3';
const urlsToCache = [
  '/',
  '/index.html',
  '/pulse-icon.jpg'
];

// Install - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(urlsToCache))
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
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const responseToCache = response.clone();
        caches.open(CACHE_VERSION).then((cache) => {
          try { cache.put(event.request, responseToCache); } catch (_) {}
        });
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// ----- Web Push -----
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) { data = { title: 'PULSE', body: event.data ? event.data.text() : '' }; }

  const title = data.title || 'PULSE';
  const options = {
    body: data.body || '',
    icon: '/pulse-icon.jpg',
    badge: '/pulse-icon.jpg',
    tag: data.tag || 'pulse',
    data: { url: data.url || '/', ...data },
    requireInteraction: data.priority === 'high',
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        try {
          const url = new URL(client.url);
          if (url.origin === self.location.origin) {
            client.focus();
            client.navigate(targetUrl);
            return;
          }
        } catch (_) {}
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
