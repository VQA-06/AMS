/**
 * AMS (Attendance Management System) - Service Worker
 * Mobile-First Offline Shell & Smart Caching Engine
 */

const CACHE_NAME = 'ams-pwa-v1.1.0';
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

/**
 * Helper to purge matching API entries from CacheStorage
 */
async function purgeApiCache(pattern) {
  try {
    const cache = await caches.open(CACHE_NAME);
    const requests = await cache.keys();
    const deletions = requests
      .filter((req) => {
        const url = new URL(req.url);
        if (!url.pathname.startsWith('/api/')) return false;
        if (!pattern) return true;
        return url.pathname.includes(pattern) || url.href.includes(pattern);
      })
      .map((req) => cache.delete(req));
    await Promise.all(deletions);
  } catch (err) {
    console.warn('[AMS SW] Failed to purge API cache:', err);
  }
}

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

  // 1. Non-GET requests (mutations: POST, PUT, PATCH, DELETE):
  // Passthrough to network, and on success automatically purge related API CacheStorage entries!
  if (request.method !== 'GET') {
    if (url.pathname.startsWith('/api/')) {
      event.respondWith(
        fetch(request).then(async (response) => {
          if (response.ok) {
            // Automatically determine domain to invalidate in CacheStorage
            if (url.pathname.includes('/agenda') || url.pathname.includes('/events') || url.pathname.includes('/programs') || url.pathname.includes('/activities')) {
              await Promise.all([purgeApiCache('agenda'), purgeApiCache('events'), purgeApiCache('attendances'), purgeApiCache('reports')]);
            } else if (url.pathname.includes('/members')) {
              await Promise.all([purgeApiCache('members'), purgeApiCache('attendances'), purgeApiCache('stats')]);
            } else if (url.pathname.includes('/attendances') || url.pathname.includes('/scan')) {
              await Promise.all([purgeApiCache('attendances'), purgeApiCache('agenda'), purgeApiCache('members')]);
            } else {
              await purgeApiCache();
            }
          }
          return response;
        })
      );
    }
    return;
  }

  // 2. Ignore non-HTTP/HTTPS schemes (chrome-extension, etc.)
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // 3. API Requests: Strict Network-First with graceful offline fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((networkRes) => {
          // If response is valid 200, cache a snapshot in background ONLY for true offline fallback
          if (networkRes.ok && request.method === 'GET') {
            const resClone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, resClone);
            });
          }
          return networkRes;
        })
        .catch(async () => {
          // Network failed (offline or server drop): Check if cached version exists
          const cached = await caches.match(request);
          if (cached) {
            // Clone and add header indicating this is a stale offline fallback
            const headers = new Headers(cached.headers);
            headers.set('X-AMS-Offline-Fallback', 'true');
            headers.set('X-AMS-Served-From', 'service-worker-cache');
            return new Response(cached.body, {
              status: cached.status,
              statusText: cached.statusText,
              headers,
            });
          }
          // Return structured offline JSON
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

  if (event.data.type === 'INVALIDATE_API_CACHE' || event.data.type === 'PURGE_API_CACHE') {
    event.waitUntil(purgeApiCache(event.data.pattern));
  }
});

