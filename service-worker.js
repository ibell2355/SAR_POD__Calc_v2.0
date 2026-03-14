/*
 * Service Worker — PSAR POD Calculator V3
 *
 * Strategy:
 *   HTML navigation    → network-first (fall back to cached index.html for SPA)
 *   Same-origin assets → network-first (fall back to cache when offline)
 *   Cross-origin       → network only
 */

const CACHE_NAME = 'psar-pod-v14';

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
  './config/SAR_POD_V3_config.yaml',
  './package.json',
  './manifest.webmanifest',
  './assets/psar_logo.svg',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/qrcode.png'
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

  if (isSameOrigin) {
    const cacheKey = new Request(url.pathname);
    event.respondWith(
      fetch(event.request)
        .then((resp) => {
          if (resp.ok) {
            caches.open(CACHE_NAME).then((c) => c.put(cacheKey, resp.clone()));
          }
          return resp;
        })
        .catch(() => caches.open(CACHE_NAME).then((c) => c.match(cacheKey)))
    );
    return;
  }

  event.respondWith(fetch(event.request));
});
