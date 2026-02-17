/*
 * Service Worker — PSAR POD Calculator
 *
 * Strategy:
 *   HTML navigation  → network-first  (always check for new deploy)
 *   Same-origin assets → stale-while-revalidate (instant load + background refresh)
 *   Cross-origin       → network only
 *
 * The cache is populated on install and continuously refreshed in the background.
 * Routine code changes do NOT require bumping CACHE_NAME — the stale-while-revalidate
 * strategy keeps it fresh automatically. Only bump CACHE_NAME when you need to
 * force-purge the entire cache (e.g., removing files from APP_SHELL).
 */

const CACHE_NAME = 'psar-pod-v2.1.1';

const APP_SHELL = [
  './',
  './index.html',
  './src/main.js',
  './src/ui/render.js',
  './src/ui/styles.css',
  './src/model/podEngine.js',
  './src/model/configLoader.js',
  './src/utils/math.js',
  './src/utils/simpleYaml.js',
  './src/storage/db.js',
  './config/SAR_POD_V2_config.yaml',
  './config/defaults.js',
  './package.json',
  './manifest.webmanifest',
  './assets/logo-placeholder.svg',
  './assets/icon-192.svg',
  './assets/icon-512.svg'
];

/* ---- Install: pre-cache app shell ---- */

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

/* ---- Activate: purge old caches ---- */

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* ---- Fetch ---- */

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isNav = event.request.mode === 'navigate' || event.request.destination === 'document';
  const isSameOrigin = url.origin === self.location.origin;

  // HTML navigation: network-first, cache fallback
  if (isNav) {
    event.respondWith(
      fetch(event.request)
        .then((resp) => {
          caches.open(CACHE_NAME).then((c) => c.put(event.request, resp.clone()));
          return resp;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Same-origin static assets: stale-while-revalidate
  // Strip query params so ?v= busters share the same cache entry as bare URLs
  if (isSameOrigin) {
    const cacheKey = new Request(url.pathname);
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(cacheKey).then((cached) => {
          const freshFetch = fetch(event.request).then((resp) => {
            if (resp.ok) cache.put(cacheKey, resp.clone());
            return resp;
          });
          if (cached) {
            // Return cached immediately; update cache in background
            freshFetch.catch(() => {});
            return cached;
          }
          // No cache: wait for network
          return freshFetch;
        })
      )
    );
    return;
  }

  // Cross-origin: network only
  event.respondWith(fetch(event.request));
});
