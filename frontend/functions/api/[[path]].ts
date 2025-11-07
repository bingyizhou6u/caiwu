// Pages Functions: 代理 /api/* 请求到绑定的 Worker
// Service Binding 名称: workers
export async function onRequest(context: any) {
  try {
    const worker = context.env?.workers as any
    
    if (worker) {
      // 使用 Service Binding 调用 Worker
      return await worker.fetch(context.request)
    } else {
      // 如果没有 Service Binding，回退到直接调用 Worker URL
      const url = new URL(context.request.url)
      const workerUrl = `https://caiwu-backend.bingyizhou6u.workers.dev${url.pathname}${url.search}`
      
      const workerRequest = new Request(workerUrl, {
        method: context.request.method,
        headers: context.request.headers,
        body: context.request.body,
      })
      
      const response = await fetch(workerRequest)
      
      // 创建新的响应，显式复制所有headers（包括Set-Cookie）
      const responseHeaders = new Headers()
      response.headers.forEach((value: string, key: string) => {
        if (key.toLowerCase() === 'set-cookie') {
          const cookies = response.headers.getSetCookie()
          cookies.forEach(cookie => {
            responseHeaders.append('Set-Cookie', cookie)
          })
        } else {
          responseHeaders.set(key, value)
        }
      })
      
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      })
    }
  } catch (error: any) {
    console.error('Pages Function error:', error)
    return new Response(`Error: ${error.message}`, { status: 500 })
  }
}

