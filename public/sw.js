const CACHE_VERSION = 'pulse-v2-' + Date.now();
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
      .then(() => self.skipWaiting()) // Force immediate activation
  );
});

// Activate - clear old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_VERSION) {
            console.log('Clearing old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Take control of all clients immediately
      return self.clients.claim();
    })
  );
});

// Fetch - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Only cache GET requests from same origin
  if (event.request.method !== 'GET' || url.origin !== location.origin) {
    return;
  }
  
  // Never cache auth/API/storage endpoints
  const noCachePaths = ['/auth', '/rest', '/storage', '/functions', '.supabase.co'];
  if (noCachePaths.some(path => url.href.includes(path))) {
    return;
  }
  
  // Don't cache requests with Authorization headers
  if (event.request.headers.has('Authorization')) {
    return;
  }
  
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Respect Cache-Control headers
        const cacheControl = response.headers.get('Cache-Control');
        if (cacheControl && (cacheControl.includes('no-cache') || cacheControl.includes('no-store'))) {
          return response;
        }
        
        // Clone and cache static assets only
        const responseToCache = response.clone();
        caches.open(CACHE_VERSION)
          .then((cache) => {
            cache.put(event.request, responseToCache);
          });
        return response;
      })
      .catch(() => {
        // If network fails, try cache
        return caches.match(event.request);
      })
  );
});
