// Service Worker for STM Portal PWA
const CACHE_NAME = 'stm-portal-v2';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  // Delete old caches on activation
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Network-first strategy — always try network, fallback to cache
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Skip non-GET, API calls, and external resources
  if (event.request.method !== 'GET') return;
  if (url.includes('/api/')) return;
  if (!url.startsWith(self.location.origin)) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
