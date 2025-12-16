import { Context, Next } from 'hono'
import { v4 as uuid } from 'uuid'

export function createRequestIdMiddleware() {
  return async (c: Context, next: Next) => {
    // Check if request ID exists in header (e.g. from Cloudflare or load balancer)
    const existingId = c.req.header('cf-ray') || c.req.header('x-request-id')
    const requestId = existingId || uuid()

    // Set in context variables for logger access
    c.set('requestId', requestId)

    // Set in response header for client debugging
    c.header('X-Request-ID', requestId)

    await next()
  }
}
