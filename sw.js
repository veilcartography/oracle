// Service Worker for The Gnostic Gospels Oracle PWA
// Bumped to v2 when the app moved off Manus to /oracle/ on GitHub Pages.
// Everything here is relative to the service worker's own location, so the
// cache follows the app instead of assuming it is served from the site root.
const CACHE_NAME = 'gnostic-oracle-v3';
const APP_ROOT = new URL('./', self.location).pathname;
const STATIC_ASSETS = [
  APP_ROOT,
  APP_ROOT + 'manifest.json',
];

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch: network-first for API calls, cache-first for static assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // The answer endpoint is a Cloudflare Worker on its own origin, and questions
  // are POSTed. Anything cross-origin or non-GET goes straight to the network and
  // is never cached -- an earlier version tested a same-origin '/api/' path that
  // could never match, so this branch never ran.
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin || event.request.method !== 'GET') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(
          JSON.stringify({ error: 'You are offline. Please reconnect to consult the Oracle.' }),
          { headers: { 'Content-Type': 'application/json' }, status: 503 }
        );
      })
    );
    return;
  }

  // Cache-first for everything else
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Return cached root for navigation requests (SPA fallback)
        if (event.request.mode === 'navigate') {
          return caches.match(APP_ROOT);
        }
      });
    })
  );
});
