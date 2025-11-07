import { getCookie } from 'hono/cookie'
import type { Env, AppVariables } from './types.js'
import { getUserById, getSession } from './utils/db.js'

// Auth middleware
export function createAuthMiddleware() {
  return async (c: any, next: () => Promise<void>) => {
    if (['/api/health','/api/init-if-empty','/api/auth/login','/api/auth/login-password','/api/auth/change-password-first','/api/auth/get-totp-qr','/api/auth/bind-totp-first','/api/me'].includes(c.req.path)) return next()
    const sid = getCookie(c, 'sid')
    if (!sid) return c.json({ error: 'unauthorized' }, 401)
    const s = await getSession(c.env.DB, sid)
    if (!s) return c.json({ error: 'unauthorized' }, 401)
    c.set('userId', s.user_id)
    const u = await getUserById(c.env.DB, s.user_id)
    
    // 必须基于员工记录获取职位和角色
    const { getUserPosition } = await import('./utils/db.js')
    const { getRoleByPositionCode } = await import('./utils/db.js')
    const position = await getUserPosition(c.env.DB, s.user_id)
    
    if (!position) {
      // 没有员工记录，不允许访问系统
      return c.json({ error: 'employee record not found, please contact administrator' }, 403)
    }
    
    // 基于职位确定角色
    const userRole = getRoleByPositionCode(position.code)
    c.set('userRole', userRole)
    await next()
  }
}

