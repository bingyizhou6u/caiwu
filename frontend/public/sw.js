const CACHE_NAME = 'caiwu-v1';
const RUNTIME_CACHE = 'runtime-caiwu-v1';

// 预缓存资源
const PRECACHE_URLS = [
    '/',
    '/index.html',
];

// 安装阶段：预缓存
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(PRECACHE_URLS))
            .then(self.skipWaiting())
    );
});

// 激活阶段：清理旧缓存
self.addEventListener('activate', event => {
    const currentCaches = [CACHE_NAME, RUNTIME_CACHE];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return cacheNames.filter(cacheName => !currentCaches.includes(cacheName));
        }).then(cachesToDelete => {
            return Promise.all(cachesToDelete.map(cacheToDelete => {
                return caches.delete(cacheToDelete);
            }));
        }).then(() => self.clients.claim())
    );
});

// 请求拦截
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // 1. API - Master Data (Stale-While-Revalidate)
    // 主数据变化不频繁，可以优先使用缓存，同时后台更新
    if (url.pathname.startsWith('/api/master-data')) {
        event.respondWith(
            caches.open(RUNTIME_CACHE).then(cache => {
                return cache.match(event.request).then(response => {
                    const fetchPromise = fetch(event.request).then(networkResponse => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                    return response || fetchPromise;
                });
            })
        );
        return;
    }

    // 2. API - Vouchers (Cache First)
    // 凭证图片一旦生成通常不会修改，且再次访问概率高。优先缓存，提升查看体验。
    // 如果必须更新，可以通过 URL 变换（如加版本号）来实现。
    if (url.pathname.startsWith('/api/vouchers/')) {
        event.respondWith(
            caches.open(RUNTIME_CACHE).then(cache => {
                return cache.match(event.request).then(response => {
                    // Cache hit - return response
                    if (response) {
                        return response;
                    }
                    // Cache miss - fetch from network
                    return fetch(event.request).then(networkResponse => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                });
            })
        );
        return;
    }

    // 3. API - Other (Network First)
    // 其他 API 数据实时性要求高，优先网络，失败则尝试缓存（虽然通常POST/PUT不缓存，这里主要针对GET）
    if (url.pathname.startsWith('/api/') && event.request.method === 'GET') {
        // 对于其他 API，我们通常不缓存，或者只在离线时使用缓存（如果实施了全面的离线模式）
        // 这里简单起见，不做处理，让它走网络。
        // 如果需要离线访问，可以改为 Network First
        return;
    }

    // 3. Static Assets (Cache First)
    if (url.pathname.startsWith('/assets/') || PRECACHE_URLS.includes(url.pathname)) {
        event.respondWith(
            caches.match(event.request).then(cachedResponse => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                return caches.open(RUNTIME_CACHE).then(cache => {
                    return fetch(event.request).then(response => {
                        // Put in cache if successful
                        return cache.put(event.request, response.clone()).then(() => {
                            return response;
                        });
                    });
                });
            })
        );
        return;
    }
});
