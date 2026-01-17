const CACHE_NAME = 'beerdex-v2';
const ASSETS = [
    './index.html',
    './style.css',
    './js/app.js',
    './js/ui.js',
    './js/storage.js',
    './js/achievements.js',
    './data/deutchbeer.json',
    './manifest.webmanifest',
    './images/beer/FUT.jpg'
];

// Install Event
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[SW] Caching App Shell');
                return cache.addAll(ASSETS);
            })
    );
});

// Activate Event
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(keys.map(key => {
                if (key !== CACHE_NAME) {
                    console.log('[SW] Clearing Old Cache');
                    return caches.delete(key);
                }
            }));
        })
    );
});

// Fetch Event
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            // Cache Hit - Return response
            if (cachedResponse) {
                return cachedResponse;
            }

            // Network Request
            return fetch(event.request).then(networkResponse => {
                // Check if valid reference
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                    return networkResponse;
                }

                // Clone response for cache
                const responseToCache = networkResponse.clone();

                caches.open(CACHE_NAME)
                    .then(cache => {
                        // Only cache images and data files dynamically
                        if (event.request.url.includes('/images/') || event.request.url.endsWith('.json')) {
                            cache.put(event.request, responseToCache);
                        }
                    });

                return networkResponse;
            });
        })
    );
});
