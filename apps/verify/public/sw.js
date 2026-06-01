/**
 * Atrium Service Worker, vanilla (no next-pwa dependency).
 *
 * Strategy: Cache-first for static assets (fonts, icons, CSS/JS bundles).
 * Network-first for API routes and HTML navigation.
 * Offline fallback for /app/* routes.
 *
 * Choice rationale: next-pwa has known Next.js 15 compatibility issues and
 * pulls in Workbox as a heavy dependency. A vanilla SW gives full control
 * with ~60 lines of code.
 */

const CACHE_NAME = 'atrium-v2';
const STATIC_ASSETS = [
  '/manifest.json',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/atrium-favicon.js',
  '/offline.html',
];

self.addEventListener('install', (event) => {
  // Resilient precache: cache each asset individually so a single 404 cannot
  // reject the whole install (cache.addAll is atomic, one missing asset there
  // silently bricks the service worker, which is exactly what happened when
  // the icon PNGs were absent at the public root). allSettled tolerates a
  // missing optional asset and still installs.
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(STATIC_ASSETS.map((a) => cache.add(a)))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // API routes: network only
  if (url.pathname.startsWith('/api/')) return;

  // Static assets (fonts, icons, _next/static): cache-first
  if (
    url.pathname.startsWith('/fonts/') ||
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.match(/\.(png|svg|ico|woff2|css|js)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cached) =>
        cached || fetch(request).then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return res;
        })
      )
    );
    return;
  }

  // HTML navigation: network-first, falling back to the cached page if we
  // have it, then to the branded /offline.html. Network-first means a fresh
  // online load is never served stale; the cache only kicks in when offline.
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(request).then((cached) =>
          cached ||
          caches.match('/offline.html').then((offline) =>
            offline ||
            new Response('<!doctype html><title>Offline</title><h1>Offline</h1><p>Atrium is unavailable offline. Reconnect and retry.</p>', {
              headers: { 'Content-Type': 'text/html' },
            })
          )
        )
      )
    );
    return;
  }
});
