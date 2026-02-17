const CACHE_NAME = 'psar-pod-v2.0.0';
const APP_SHELL = [
  './',
  './index.html',
  './src/main.js',
  './src/ui/render.js',
  './src/ui/styles.css',
  './src/model/podEngine.js',
  './src/model/configLoader.js',
  './src/model/configValidator.js',
  './src/utils/math.js',
  './src/utils/simpleYaml.js',
  './src/storage/db.js',
  './config/SAR_POD_V2_config.yaml',
  './config/config.schema.json',
  './config/defaults.js',
  './package.json',
  './manifest.webmanifest',
  './assets/logo-placeholder.svg',
  './assets/icon-192.svg',
  './assets/icon-512.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
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
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isNav = event.request.mode === 'navigate' || event.request.destination === 'document';
  const isSameOrigin = url.origin === self.location.origin;

  if (isNav) {
    event.respondWith(
      fetch(event.request)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((c) => c.put('./index.html', copy));
          return resp;
        })
        .catch(() =>
          caches.match(event.request).then((c) => c || caches.match('./index.html'))
        )
    );
    return;
  }

  if (isSameOrigin) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((c) => c.put(event.request, copy));
          return resp;
        });
      })
    );
    return;
  }

  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
