// Pages Functions Advanced Mode: 代理所有 /api/* 请求到 Worker
// 优先使用 Service Binding (env.workers) 以获得最佳性能

interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> }
  workers?: { fetch: (request: Request) => Promise<Response> } // Service Binding
}

const BACKEND_URL = 'https://caiwu-backend.bingyizhou6u.workers.dev'

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // 处理 /api/* 请求
    if (url.pathname.startsWith('/api/')) {
      try {
        let response: Response

        // 1. 优先尝试 Service Binding (内部网络，零延迟)
        if (env.workers) {
          // Service Binding 会自动处理路由，忽略 Host，但为了保险我们克隆请求
          // 注意：Service Binding 不需要修改 URL Host，它直接路由到 Worker
          response = await env.workers.fetch(request)
        }
        // 2. 回退到公网 Fetch (当未配置绑定或在某些开发环境)
        else {
          const apiPath = url.pathname
          const backendUrl = BACKEND_URL + apiPath + url.search

          // 复制请求头
          const headers = new Headers()
          request.headers.forEach((value, key) => {
            // 跳过一些不需要转发的头
            if (!['host', 'cf-connecting-ip', 'cf-ray', 'cf-visitor'].includes(key.toLowerCase())) {
              headers.set(key, value)
            }
          })
          headers.set('X-Forwarded-Host', url.hostname)
          headers.set('X-Forwarded-Proto', url.protocol.slice(0, -1))

          response = await fetch(backendUrl, {
            method: request.method,
            headers,
            body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
          })
        }

        // 复制响应头并处理 Cookie
        const responseHeaders = new Headers(response.headers)
        const setCookieHeader = response.headers.get('Set-Cookie')
        if (setCookieHeader) {
          const modifiedCookie = setCookieHeader
            .replace(/;\s*domain=[^;]+/gi, '')
            .replace(/;\s*secure/gi, '; Secure')
            .replace(/;\s*samesite=[^;]+/gi, '; SameSite=Lax')
          responseHeaders.set('Set-Cookie', modifiedCookie)
          responseHeaders.set('Access-Control-Allow-Credentials', 'true')
          const origin = request.headers.get('Origin')
          if (origin) {
            responseHeaders.set('Access-Control-Allow-Origin', origin)
          }
        }

        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
        })
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        console.error('API proxy error:', message)
        return new Response(JSON.stringify({ error: 'API proxy error', detail: message }), {
          status: 502,
          headers: { 'Content-Type': 'application/json' }
        })
      }
    }

    // 其他请求，返回静态资源
    return env.ASSETS.fetch(request)
  }
}
