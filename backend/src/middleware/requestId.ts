import { Context, Next } from 'hono'
import { v4 as uuid } from 'uuid'

export function createRequestIdMiddleware() {
  return async (c: Context, next: Next) => {
    // 检查 Header 中是否存在 Request ID（例如来自 Cloudflare 或负载均衡器）
    const existingId = c.req.header('cf-ray') || c.req.header('x-request-id')
    const requestId = existingId || uuid()

    // 存入上下文变量，以便日志组件访问
    c.set('requestId', requestId)

    // 设置响应头，便于客户端调试
    c.header('X-Request-ID', requestId)

    await next()
  }
}
