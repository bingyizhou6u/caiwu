import { Context } from 'hono'
import { getCookie } from 'hono/cookie'
import type { Env, AppVariables } from './types/index.js'
import { getSessionWithUserAndPosition } from './utils/db.js'
import {
  verifyAuthToken,
  AUTH_COOKIE_NAME,
  extractBearerToken,
  ALT_AUTH_HEADER,
} from './utils/jwt.js'
import { isPublicPath } from './config/paths.js'
import { Logger } from './utils/logger.js'

// Auth middleware
// 使用 JWT + 数据库 session 组合的方式校验用户身份
// 通过 session 与职位信息一次性写入 context，降低后续查询开销
export function createAuthMiddleware() {
  return async (
    c: Context<{ Bindings: Env; Variables: AppVariables }>,
    next: () => Promise<void>
  ) => {
    if (isPublicPath(c.req.path)) {return next()}

    const token = getAuthToken(c)
    if (!token) {
      // 对于不存在的路由，应该返回 404 而不是 401
      // 但这里无法判断路由是否存在，所以先返回 401
      // 如果路由不存在，Hono 会在中间件执行后返回 404
      return c.json({ error: 'unauthorized' }, 401)
    }

    let payload
    try {
      payload = await verifyAuthToken(token, c.env.AUTH_JWT_SECRET)
    } catch (error) {
      Logger.error('Auth token verification failed', { error }, c)
      return c.json({ error: 'unauthorized' }, 401)
    }

    // 1. 尝试从 KV 获取 Session 缓存
    let sessionData = (await c.env.SESSIONS_KV.get(`session:${payload.sid}`, 'json')) as any

    // 2. 如果 KV 未命中，回退到数据库查询 (并写入缓存)
    if (!sessionData) {
      sessionData = await getSessionWithUserAndPosition(c.env.DB, payload.sid)

      if (sessionData && sessionData.session) {
        // 异步写入 KV 缓存
        const ttl = Math.floor((sessionData.session.expires_at - Date.now()) / 1000)
        if (ttl > 0) {
          c.executionCtx.waitUntil(
            c.env.SESSIONS_KV.put(`session:${payload.sid}`, JSON.stringify(sessionData), {
              expirationTtl: ttl,
            })
          )
        }
      }
    }

    if (!sessionData || !sessionData.session) {
      return c.json({ error: 'unauthorized' }, 401)
    }

    c.set('userId', sessionData.session.user_id)
    c.set('sessionId', payload.sid)

    // 滑动窗口续期：活跃用户自动延长 7 天有效期
    const now = Date.now()
    const newExpiresAt = now + 1000 * 60 * 60 * 24 * 7 // 7天后过期

    // 异步更新会话过期时间和最后活跃时间（不阻塞请求）
    c.executionCtx.waitUntil(
      (async () => {
        // 1. 更新 D1 数据库
        await c.env.DB.prepare(
          'UPDATE sessions SET expires_at = ?, last_active_at = ? WHERE id = ?'
        )
          .bind(newExpiresAt, now, payload.sid)
          .run()
          .catch(() => {}) // 忽略更新失败

        // 2. 更新 KV 缓存的 TTL
        const updatedSessionData = {
          ...sessionData,
          session: {
            ...sessionData.session,
            expires_at: newExpiresAt,
          },
        }
        await c.env.SESSIONS_KV.put(
          `session:${payload.sid}`,
          JSON.stringify(updatedSessionData),
          { expirationTtl: 60 * 60 * 24 * 7 } // 7天 TTL
        ).catch(() => {}) // 忽略更新失败
      })()
    )

    if (!sessionData.position) {
      return c.json({ error: 'employee record not found, please contact administrator' }, 403)
    }

    c.set('userPosition', sessionData.position)
    if (sessionData.employee) {
      c.set('userEmployee', sessionData.employee)
    }
    // 部门允许的功能模块
    c.set('departmentModules', sessionData.departmentModules || ['*'])

    await next()
  }
}

function getAuthToken(c: Context<{ Bindings: Env; Variables: AppVariables }>) {
  const altHeader = c.req.header(ALT_AUTH_HEADER)
  if (altHeader) {return altHeader}
  const bearer = extractBearerToken(c.req.header('Authorization'))
  if (bearer) {return bearer}
  return getCookie(c, AUTH_COOKIE_NAME)
}
