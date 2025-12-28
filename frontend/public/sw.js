// Service Worker v5 - 修复 CF Access 重定向问题
const SW_VERSION = 'v5'
const CACHE_NAME = `ar-finance-cache-${SW_VERSION}`

// 需要缓存的资源模式
const CACHE_PATTERNS = [
    /\.(js|css|woff2?|ttf|eot|svg|png|jpg|jpeg|gif|ico|webp)$/,
    /^\/assets\//,
    /^\/icons\//,
]

// 排除模式 - 这些路径不应该被 SW 处理
const EXCLUDED_PATTERNS = [
    /^\/cdn-cgi\//,        // Cloudflare Access 回调
    /^\/api\//,            // API 请求
    /^\/manifest\.json$/,  // PWA manifest
]

// 检查是否应该排除
function shouldExclude(pathname) {
    return EXCLUDED_PATTERNS.some(pattern => pattern.test(pathname))
}

// 检查是否应该缓存
function shouldCache(pathname) {
    return CACHE_PATTERNS.some(pattern => pattern.test(pathname))
}

console.log(`🚀 Service Worker ${SW_VERSION} 已加载`)

// 安装事件
self.addEventListener('install', (event) => {
    console.log(`📦 Service Worker ${SW_VERSION} 安装中...`)
    self.skipWaiting()
})

// 激活事件
self.addEventListener('activate', (event) => {
    console.log(`✅ Service Worker ${SW_VERSION} 激活`)
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames
                    .filter(name => name !== CACHE_NAME)
                    .map(name => {
                        console.log(`🗑️ 清理旧缓存: ${name}`)
                        return caches.delete(name)
                    })
            )
        }).then(() => {
            return self.clients.claim()
        })
    )
})

// Fetch 事件
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url)

    // 只处理同源请求
    if (url.origin !== self.location.origin) {
        return
    }

    // 排除特定路径 - 让浏览器直接处理
    if (shouldExclude(url.pathname)) {
        return
    }

    // 导航请求（HTML 页面）让浏览器处理，避免 CF Access 重定向问题
    if (event.request.mode === 'navigate') {
        return
    }

    // 只缓存 GET 请求
    if (event.request.method !== 'GET') {
        return
    }

    // 对于可缓存资源，使用缓存优先策略
    if (shouldCache(url.pathname)) {
        event.respondWith(
            caches.match(event.request).then(cachedResponse => {
                if (cachedResponse) {
                    // 后台更新缓存
                    event.waitUntil(
                        fetch(event.request).then(response => {
                            if (response && response.ok) {
                                return caches.open(CACHE_NAME).then(cache => {
                                    return cache.put(event.request, response)
                                })
                            }
                        }).catch(() => { })
                    )
                    return cachedResponse
                }

                return fetch(event.request).then(response => {
                    if (response && response.ok) {
                        const responseClone = response.clone()
                        event.waitUntil(
                            caches.open(CACHE_NAME).then(cache => {
                                return cache.put(event.request, responseClone)
                            })
                        )
                    }
                    return response
                })
            })
        )
        return
    }

    // 其他请求直接 fetch
})

// 消息处理
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting()
    }
})
