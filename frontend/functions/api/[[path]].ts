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
  
  // 转发请求到后端
  const response = await fetch(backendUrl, {
    method: request.method,
    headers: headers,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
  })
  
  // 创建响应头
  const responseHeaders = new Headers(response.headers)
  
  // 处理 Set-Cookie 头：修改 domain 为前端域名
  const setCookieHeader = response.headers.get('Set-Cookie')
  if (setCookieHeader) {
    // 移除 domain 设置，让浏览器使用当前域名
    const modifiedCookie = setCookieHeader
      .replace(/;\s*domain=[^;]+/gi, '') // 移除 domain 设置
      .replace(/;\s*secure/gi, '; Secure') // 确保 secure 标志
      .replace(/;\s*samesite=[^;]+/gi, '; SameSite=Lax') // 确保 SameSite
    
    responseHeaders.set('Set-Cookie', modifiedCookie)
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
