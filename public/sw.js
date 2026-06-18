const CACHE_VERSION = 'pulse-v4-oauth-fix';
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

  const url = new URL(event.request.url);

  // CRITICAL: never intercept OAuth broker paths or auth callbacks.
  // The Lovable proxy worker handles /~oauth/initiate and /~oauth/callback;
  // caching or replaying them breaks Google/Apple sign-in (user bounces
  // back to /auth without a session). Also skip Supabase auth endpoints.
  if (
    url.pathname.startsWith('/~oauth') ||
    url.pathname.startsWith('/auth/v1') ||
    url.pathname.includes('/auth/callback')
  ) {
    return; // let the browser handle it directly
  }

  // Don't cache cross-origin requests (Supabase, Stripe, etc.)
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Only cache successful, basic responses — never redirects or opaque ones.
        if (response && response.ok && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_VERSION).then((cache) => {
            try { cache.put(event.request, responseToCache); } catch (_) {}
          });
        }
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
