// Pages Functions Advanced Mode: 代理所有 /api/* 请求到 Worker
// 通过 Service Binding (env.workers) 内部调用

interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> }
  workers: { fetch: (request: Request) => Promise<Response> } // Service Binding (必须配置)
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // 处理 /api/* 请求
    if (url.pathname.startsWith('/api/')) {
      try {
        // 通过 Service Binding 内部调用后端 Worker
        const response = await env.workers.fetch(request)

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

