// Cloudflare Pages Function to proxy API requests to Workers
export async function onRequest(context: any) {
  const { request } = context
  const url = new URL(request.url)

  const apiPath = url.pathname.replace(/^\/api\/?/, '')
  const backendUrl = 'https://caiwu-backend.bingyizhou6u.workers.dev/api/' + apiPath + url.search

  const headers = new Headers(request.headers)
  headers.set('X-Forwarded-Host', url.hostname)
  headers.set('X-Forwarded-Proto', url.protocol.slice(0, -1))

  const response = await fetch(backendUrl, {
    method: request.method,
    headers,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
  })

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
}
