const CACHE_NAME = 'gridpulse-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Only cache GET requests
  if (event.request.method !== 'GET') return;
  // Skip cross-origin requests, like APIs and WebSockets
  if (!event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request).then((fetchRes) => {
        return caches.open(CACHE_NAME).then((cache) => {
          // Don't cache API or WS requests just in case
          if (!event.request.url.includes('/api/') && !event.request.url.includes('/ws/')) {
            cache.put(event.request, fetchRes.clone());
          }
          return fetchRes;
        });
      });
    })
  );
});
