/**
 * AMS (Attendance Management System) - Service Worker
 * Mobile-First Offline Shell & Smart Caching Engine
 */

const CACHE_NAME = 'ams-pwa-v1.0.0';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/logo.webp',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-192.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
  '/icons/favicon-32.png',
  '/icons/favicon-64.png',
];

// Install Event: Pre-cache core app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.warn('[AMS SW] Precache warning:', err);
      })
  );
});

// Activate Event: Clean up outdated caches and claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch Event: Intelligent routing based on request type
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Non-GET requests (mutations) bypass cache completely
  if (request.method !== 'GET') {
    return;
  }

  // 2. Ignore non-HTTP/HTTPS schemes (chrome-extension, etc.)
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // 3. API Requests: Network-First with graceful offline fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((networkRes) => {
          // If response is valid 200, cache it in background for offline viewing
          if (networkRes.ok && request.method === 'GET') {
            const resClone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, resClone);
            });
          }
          return networkRes;
        })
        .catch(async () => {
          // Network failed: Check if cached version exists
          const cached = await caches.match(request);
          if (cached) {
            return cached;
          }
          // Return offline JSON
          return new Response(
            JSON.stringify({
              ok: false,
              error: {
                code: 'OFFLINE_NETWORK_DISCONNECTED',
                message: 'Perangkat sedang offline. Menampilkan data tersimpan atau periksa koneksi internet Anda.',
              },
            }),
            {
              status: 503,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        })
    );
    return;
  }

  // 4. HTML Navigation (SPA Document routes e.g. /events, /members, /scanner)
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then((networkRes) => {
          if (networkRes.ok) {
            const resClone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, resClone);
            });
          }
          return networkRes;
        })
        .catch(async () => {
          // Network failed: return cached HTML shell
          const cachedPage = await caches.match(request);
          if (cachedPage) {
            return cachedPage;
          }
          const appShell = await caches.match('/index.html');
          if (appShell) {
            return appShell;
          }
          return caches.match('/');
        })
    );
    return;
  }

  // 5. Static Assets (JS, CSS, Images, WebP, Fonts): Stale-While-Revalidate / Cache-First
  event.respondWith(
    caches.match(request).then((cachedRes) => {
      const fetchPromise = fetch(request)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const resClone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, resClone);
            });
          }
          return networkRes;
        })
        .catch(() => {
          // Fallback if asset fetch fails and no cache exists
          return cachedRes;
        });

      return cachedRes || fetchPromise;
    })
  );
});

// Message Listener for update prompt & cache purge
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.type === 'CLEAR_CACHE') {
    caches.keys().then((keys) => {
      return Promise.all(keys.map((k) => caches.delete(k)));
    });
  }
});
