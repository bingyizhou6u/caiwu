import { getCookie } from 'hono/cookie'
import type { Env, AppVariables } from './types.js'
import { getSessionWithUserAndPosition } from './utils/db.js'
import { verifyAuthToken, AUTH_COOKIE_NAME, extractBearerToken, ALT_AUTH_HEADER } from './utils/jwt.js'

const PUBLIC_PATHS = new Set([
  '/api/health',
  '/api/init-if-empty',
  '/api/auth/login',
  '/api/auth/login-password',
  '/api/auth/change-password-first',
  '/api/auth/get-totp-qr',
  '/api/auth/bind-totp-first',
  '/api/auth/me',
  '/api/me',
  '/api/system-config/email-notification/enabled'
])

// Auth middleware
// 使用 JWT + 数据库 session 组合的方式校验用户身份
// 通过 session 与职位信息一次性写入 context，降低后续查询开销
export function createAuthMiddleware() {
  return async (c: any, next: () => Promise<void>) => {
    if (PUBLIC_PATHS.has(c.req.path)) return next()

    const token = getAuthToken(c)
    if (!token) return c.json({ error: 'unauthorized' }, 401)

    let payload
    try {
      payload = await verifyAuthToken(token, c.env.AUTH_JWT_SECRET)
    } catch (error) {
      console.error('Auth token verification failed:', error)
      return c.json({ error: 'unauthorized' }, 401)
    }

    const sessionData = await getSessionWithUserAndPosition(c.env.DB, payload.sid)
    if (!sessionData || !sessionData.session) {
      return c.json({ error: 'unauthorized' }, 401)
    }

    c.set('userId', sessionData.session.user_id)
    c.set('sessionId', payload.sid)

    // 异步更新会话最后活跃时间（不阻塞请求）
    c.executionCtx.waitUntil(
      c.env.DB.prepare('UPDATE sessions SET last_active_at = ? WHERE id = ?')
        .bind(Date.now(), payload.sid)
        .run()
        .catch(() => {}) // 忽略更新失败
    )

    if (!sessionData.position) {
      return c.json({ error: 'employee record not found, please contact administrator' }, 403)
    }

    c.set('userPosition', sessionData.position)
    if (sessionData.employee) {
      c.set('userEmployee', sessionData.employee)
    }

    await next()
  }
}

function getAuthToken(c: any) {
  const altHeader = c.req.header(ALT_AUTH_HEADER)
  if (altHeader) return altHeader
  const bearer = extractBearerToken(c.req.header('Authorization'))
  if (bearer) return bearer
  return getCookie(c, AUTH_COOKIE_NAME)
}

