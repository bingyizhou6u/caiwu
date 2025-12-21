/**
 * AR财务管理系统 Service Worker
 * 增强版 - 支持离线访问、智能缓存、后台同步
 */

const CACHE_VERSION = 'v3';
const STATIC_CACHE = `caiwu-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `caiwu-runtime-${CACHE_VERSION}`;
const IMAGE_CACHE = `caiwu-images-${CACHE_VERSION}`;

// 预缓存资源（应用 Shell）
const PRECACHE_URLS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/icons/icon.svg',
];

// 需要缓存的静态资源模式
const STATIC_PATTERNS = [
    /\.js$/,
    /\.css$/,
    /\.woff2?$/,
    /\.ttf$/,
    /\.eot$/,
];

// 图片资源模式
const IMAGE_PATTERNS = [
    /\.png$/,
    /\.jpg$/,
    /\.jpeg$/,
    /\.gif$/,
    /\.webp$/,
    /\.svg$/,
    /\.ico$/,
];

// 不应缓存的 API 路径
const NO_CACHE_APIS = [
    '/api/v2/auth',
    '/api/v2/login',
    '/api/v2/logout',
];

/**
 * 安装阶段：预缓存关键资源
 */
self.addEventListener('install', event => {
    console.log('📦 Service Worker: 安装中...');
    
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache => {
                console.log('📦 预缓存资源...');
                return cache.addAll(PRECACHE_URLS);
            })
            .then(() => {
                console.log('✅ 预缓存完成');
                return self.skipWaiting();
            })
            .catch(error => {
                console.error('❌ 预缓存失败:', error);
            })
    );
});

/**
 * 激活阶段：清理旧缓存
 */
self.addEventListener('activate', event => {
    console.log('🔄 Service Worker: 激活中...');
    
    const currentCaches = [STATIC_CACHE, RUNTIME_CACHE, IMAGE_CACHE];
    
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames
                        .filter(name => name.startsWith('caiwu-') && !currentCaches.includes(name))
                        .map(name => {
                            console.log('🗑️ 删除旧缓存:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => {
                console.log('✅ Service Worker 激活完成');
                return self.clients.claim();
            })
    );
});

/**
 * 请求拦截
 */
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // 只处理同源请求和 GET 请求
    if (url.origin !== location.origin || request.method !== 'GET') {
        return;
    }

    // 跳过开发环境热更新
    if (url.pathname.includes('hot-update') || url.pathname.includes('__vite')) {
        return;
    }

    // 根据资源类型选择缓存策略
    if (isApiRequest(url)) {
        event.respondWith(handleApiRequest(request, url));
    } else if (isImageRequest(url)) {
        event.respondWith(handleImageRequest(request));
    } else if (isStaticAsset(url)) {
        event.respondWith(handleStaticRequest(request));
    } else {
        event.respondWith(handleNavigationRequest(request));
    }
});

/**
 * 判断是否为 API 请求
 */
function isApiRequest(url) {
    return url.pathname.startsWith('/api/');
}

/**
 * 判断是否为图片请求
 */
function isImageRequest(url) {
    return IMAGE_PATTERNS.some(pattern => pattern.test(url.pathname));
}

/**
 * 判断是否为静态资源
 */
function isStaticAsset(url) {
    return url.pathname.startsWith('/assets/') || 
           STATIC_PATTERNS.some(pattern => pattern.test(url.pathname));
}

/**
 * 处理 API 请求 - Stale While Revalidate + Network First 混合策略
 */
async function handleApiRequest(request, url) {
    // 敏感 API 不缓存
    if (NO_CACHE_APIS.some(api => url.pathname.startsWith(api))) {
        return fetch(request);
    }

    // 主数据 API - Stale While Revalidate
    if (url.pathname.includes('/master-data') || 
        url.pathname.includes('/departments') ||
        url.pathname.includes('/currencies') ||
        url.pathname.includes('/categories')) {
        return staleWhileRevalidate(request, RUNTIME_CACHE, { maxAge: 5 * 60 * 1000 });
    }

    // 凭证图片 - Cache First（长期缓存）
    if (url.pathname.includes('/vouchers/')) {
        return cacheFirst(request, IMAGE_CACHE, { maxAge: 7 * 24 * 60 * 60 * 1000 });
    }

    // 其他 API - Network First
    return networkFirst(request, RUNTIME_CACHE, { timeout: 5000 });
}

/**
 * 处理图片请求 - Cache First
 */
async function handleImageRequest(request) {
    return cacheFirst(request, IMAGE_CACHE, { maxAge: 30 * 24 * 60 * 60 * 1000 });
}

/**
 * 处理静态资源 - Cache First
 */
async function handleStaticRequest(request) {
    return cacheFirst(request, STATIC_CACHE);
}

/**
 * 处理导航请求 - Network First with App Shell Fallback
 */
async function handleNavigationRequest(request) {
    try {
        const response = await fetch(request);
        
        // 成功获取，缓存并返回
        if (response.ok) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(request, response.clone());
            return response;
        }
        
        throw new Error('Network response not ok');
    } catch (error) {
        // 离线时返回缓存的 index.html（SPA 回退）
        const cache = await caches.open(STATIC_CACHE);
        const cachedResponse = await cache.match('/index.html');
        
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // 最后回退：返回离线页面
        return new Response(
            `<!DOCTYPE html>
            <html lang="zh-CN">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>离线 - AR财务管理系统</title>
                <style>
                    body { font-family: system-ui; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0f172a; color: #fff; }
                    .container { text-align: center; padding: 20px; }
                    h1 { font-size: 24px; margin-bottom: 10px; }
                    p { color: #94a3b8; margin-bottom: 20px; }
                    button { background: #3b82f6; color: #fff; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 16px; }
                    button:hover { background: #2563eb; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>📡 无法连接网络</h1>
                    <p>请检查您的网络连接后重试</p>
                    <button onclick="location.reload()">重新加载</button>
                </div>
            </body>
            </html>`,
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
    }
}

/**
 * 缓存策略：Cache First
 * 优先使用缓存，缓存不存在时从网络获取
 */
async function cacheFirst(request, cacheName, options = {}) {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
        // 检查缓存是否过期
        if (options.maxAge) {
            const cachedTime = cachedResponse.headers.get('sw-cached-time');
            if (cachedTime && (Date.now() - parseInt(cachedTime)) > options.maxAge) {
                // 缓存过期，后台更新
                fetchAndCache(request, cache);
            }
        }
        return cachedResponse;
    }

    return fetchAndCache(request, cache);
}

/**
 * 缓存策略：Network First
 * 优先从网络获取，失败时回退到缓存
 */
async function networkFirst(request, cacheName, options = {}) {
    const cache = await caches.open(cacheName);

    try {
        const controller = new AbortController();
        const timeoutId = options.timeout 
            ? setTimeout(() => controller.abort(), options.timeout) 
            : null;

        const response = await fetch(request, { signal: controller.signal });
        
        if (timeoutId) clearTimeout(timeoutId);

        if (response.ok) {
            cache.put(request, response.clone());
            return response;
        }
        
        throw new Error('Network response not ok');
    } catch (error) {
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        throw error;
    }
}

/**
 * 缓存策略：Stale While Revalidate
 * 立即返回缓存，同时在后台更新
 */
async function staleWhileRevalidate(request, cacheName, options = {}) {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);

    // 后台更新
    const fetchPromise = fetch(request)
        .then(response => {
            if (response.ok) {
                const responseToCache = response.clone();
                // 添加缓存时间戳
                const headers = new Headers(responseToCache.headers);
                headers.set('sw-cached-time', Date.now().toString());
                
                cache.put(request, new Response(responseToCache.body, {
                    status: responseToCache.status,
                    statusText: responseToCache.statusText,
                    headers
                }));
            }
            return response;
        })
        .catch(() => null);

    // 如果有缓存，立即返回
    if (cachedResponse) {
        return cachedResponse;
    }

    // 没有缓存，等待网络
    return fetchPromise || new Response('Network error', { status: 503 });
}

/**
 * 获取并缓存
 */
async function fetchAndCache(request, cache) {
    try {
        const response = await fetch(request);
        
        if (response.ok) {
            cache.put(request, response.clone());
        }
        
        return response;
    } catch (error) {
        console.error('Fetch failed:', error);
        throw error;
    }
}

/**
 * 消息处理（用于版本更新等）
 */
self.addEventListener('message', event => {
    const { type, payload } = event.data || {};

    switch (type) {
        case 'SKIP_WAITING':
            console.log('🔄 收到跳过等待指令');
            self.skipWaiting();
            break;

        case 'CLEAR_CACHE':
            console.log('🗑️ 清除所有缓存');
            caches.keys().then(names => {
                names.forEach(name => {
                    if (name.startsWith('caiwu-')) {
                        caches.delete(name);
                    }
                });
            });
            break;

        case 'GET_VERSION':
            event.source?.postMessage({
                type: 'VERSION',
                payload: { version: CACHE_VERSION }
            });
            break;

        default:
            break;
    }
});

/**
 * 后台同步（用于离线操作同步）
 */
self.addEventListener('sync', event => {
    console.log('🔄 后台同步触发:', event.tag);
    
    if (event.tag === 'sync-pending-actions') {
        event.waitUntil(syncPendingActions());
    }
});

async function syncPendingActions() {
    // TODO: 实现离线操作同步逻辑
    console.log('✅ 后台同步完成');
}

/**
 * 推送通知（可选）
 */
self.addEventListener('push', event => {
    if (!event.data) return;

    const data = event.data.json();
    const options = {
        body: data.body,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        tag: data.tag || 'default',
        data: data.url,
        requireInteraction: data.requireInteraction || false,
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'AR财务系统', options)
    );
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    
    if (event.notification.data) {
        event.waitUntil(
            clients.openWindow(event.notification.data)
        );
    }
});

console.log(`🚀 Service Worker ${CACHE_VERSION} 已加载`);
