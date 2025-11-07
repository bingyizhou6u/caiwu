// Pages Functions Advanced Mode: 代理所有 /api/* 请求到 Worker
// 使用 Service Binding 进行内部通信

interface Env {
  ASSETS: Fetcher
  workers?: Fetcher // Service Binding (必须配置)
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    
    // 处理 /api/* 请求
    if (url.pathname.startsWith('/api/')) {
      try {
        // 必须使用 Service Binding（内部通信）
        if (!env.workers) {
          return new Response('Worker binding not configured. Please configure Service Binding in Cloudflare Dashboard.', { status: 500 })
        }
        
        // 使用 Service Binding 调用 Worker（内部通信，更快更安全）
        return await env.workers.fetch(request)
      } catch (error: any) {
        console.error('Worker fetch error:', error)
        return new Response(`Error: ${error.message}`, { status: 500 })
      }
    }
    
    // 其他请求，返回静态资源
    return env.ASSETS.fetch(request)
  }
}

