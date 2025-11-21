// Cloudflare Pages Function to proxy API requests to Workers
export async function onRequest(context: any) {
  const { request, env } = context
  const url = new URL(request.url)
  
  // 将 /api/* 请求代理到后端 Workers
  const backendUrl = 'https://caiwu-backend.bingyizhou6u.workers.dev' + url.pathname + url.search
  
  // 复制请求头
  const headers = new Headers(request.headers)
  headers.set('X-Forwarded-Host', url.hostname)
  
  // 转发请求到后端
  const response = await fetch(backendUrl, {
    method: request.method,
    headers: headers,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
  })
  
  // 返回响应
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  })
}
