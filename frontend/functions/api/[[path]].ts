// Cloudflare Pages Function to proxy API requests to Workers
export async function onRequest(context: any) {
  const { request, env } = context
  const url = new URL(request.url)
  
  // 将 /api/* 请求代理到后端 Workers
  const backendUrl = 'https://caiwu-backend.bingyizhou6u.workers.dev' + url.pathname + url.search
  
  // 复制请求头，确保 Cookie 被正确传递
  const headers = new Headers(request.headers)
  headers.set('X-Forwarded-Host', url.hostname)
  headers.set('X-Forwarded-Proto', url.protocol.slice(0, -1)) // 移除末尾的 ':'
  
  // 转发请求到后端，确保 credentials 被包含
  const response = await fetch(backendUrl, {
    method: request.method,
    headers: headers,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
  })
  
  // 创建响应头，确保 CORS 和 Cookie 设置正确
  const responseHeaders = new Headers(response.headers)
  
  // 确保 Set-Cookie 头被正确传递
  // 如果后端设置了 Cookie，需要确保它被正确转发
  if (response.headers.get('Set-Cookie')) {
    // Set-Cookie 头会被自动传递，但我们需要确保 CORS 设置正确
    responseHeaders.set('Access-Control-Allow-Credentials', 'true')
    const origin = request.headers.get('Origin')
    if (origin) {
      responseHeaders.set('Access-Control-Allow-Origin', origin)
    }
  }
  
  // 返回响应
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  })
}
