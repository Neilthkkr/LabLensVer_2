const CACHE_NAME = 'lablens-cache-v6';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './icons/favicon-32.png',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './vendor/pdfjs/pdf.min.js',
  './vendor/pdfjs/pdf.worker.min.js',
  './vendor/tesseract/tesseract.min.js',
  './vendor/tesseract/worker.min.js',
  './vendor/tesseract/tesseract-core.wasm.js',
  './vendor/tessdata/eng.traineddata.gz'
];

// On install, precache core assets and external medical parser engines
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[Service Worker] Precaching offline health assets and engines...');
      return Promise.allSettled(
        ASSETS_TO_CACHE.map(url => {
          return cache.add(url).catch(err => {
            console.warn(`[Service Worker] Failed to cache asset: ${url}`, err);
          });
        })
      );
    })
  );
});

// Clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Clearing old cache', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch handler using a Stale-While-Revalidate pattern with fallback
self.addEventListener('fetch', event => {
  if (!event.request.url.startsWith('http')) return;

  // App-shell navigations must prefer the network. Serving an old cached
  // index first can leave the UI running parser code that no longer matches
  // the vendored OCR/PDF assets, producing false "no metrics" rejections.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put('./index.html', copy));
        }
        return response;
      }).catch(async () =>
        (await caches.match('./index.html')) || (await caches.match('./'))
      )
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      return cache.match(event.request).then(cachedResponse => {
        const fetchPromise = fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(err => {
          console.log('[Service Worker] Fetch failed, returning cache if available', err);
          return cachedResponse;
        });

        return cachedResponse || fetchPromise;
      });
    })
  );
});


// Listen for skipWaiting messages from the client thread (essential for instant iOS updates)
self.addEventListener('message', event => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});
