// ============================================================
// sw.js — Service Worker
// ------------------------------------------------------------
// Versioned cache. Cleans old versions on activate. Uses
// network-first for HTML and API, cache-first for static assets.
// When a new SW takes control, notifies pages so they can offer
// an instant refresh.
// ============================================================

const VERSION = 'v20261005a';
const STATIC_CACHE = 'tcsss-static-' + VERSION;
const RUNTIME_CACHE = 'tcsss-runtime-' + VERSION;

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/assets/shell.css',
  '/assets/shell.js',
  '/assets/badges.js',
  '/assets/announcements.js',
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Only handle our own origin
  if (url.origin !== location.origin) return;

  // Never cache API calls
  if (url.pathname.startsWith('/api/')) return;

  // Never cache uploads
  if (url.pathname.startsWith('/uploads/')) return;

  // HTML: network-first, fall back to cache, fall back to offline page
  const isHTML =
    req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');

  if (isHTML) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(RUNTIME_CACHE);
          cache.put(req, fresh.clone()).catch(() => {});
          return fresh;
        } catch (_) {
          const cached = await caches.match(req);
          if (cached) return cached;
          return new Response(
            '<!doctype html><meta charset="utf-8"><title>Offline</title>' +
            '<style>body{font-family:system-ui,sans-serif;background:#FBEFEF;color:#1E1D3D;' +
            'display:grid;place-items:center;min-height:100vh;margin:0;text-align:center}' +
            '.box{max-width:420px;padding:32px}h1{color:#11104A;font-size:1.4rem}' +
            'p{color:#5B5A6B;line-height:1.6}a{color:#E6111E;font-weight:600}</style>' +
            '<div class="box"><h1>You are offline</h1>' +
            '<p>The AI Learning Platform needs a connection for the AI tutor. ' +
            'Please check your internet and try again.</p>' +
            '<p><a href="/">Reload</a></p></div>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        }
      })()
    );
    return;
  }

  // Static assets: cache-first, refresh in background
  event.respondWith(
    (async () => {
      const cached = await caches.match(req);
      if (cached) {
        fetch(req).then((fresh) => {
          if (fresh && fresh.ok) {
            caches.open(RUNTIME_CACHE).then((c) => c.put(req, fresh.clone())).catch(() => {});
          }
        }).catch(() => {});
        return cached;
      }
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(RUNTIME_CACHE);
        cache.put(req, fresh.clone()).catch(() => {});
        return fresh;
      } catch (_) {
        return new Response('', { status: 504 });
      }
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
