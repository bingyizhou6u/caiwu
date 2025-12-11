// Pages Functions Advanced Mode: 代理所有 /api/* 请求到 Worker

interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> }
}

const BACKEND_URL = 'https://caiwu-backend.bingyizhou6u.workers.dev'

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // 处理 /api/* 请求
    if (url.pathname.startsWith('/api/')) {
      try {
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

        const response = await fetch(backendUrl, {
          method: request.method,
          headers,
          body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
        })

        // 复制响应头
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
