import { getCookie } from 'hono/cookie'
import type { Env, AppVariables } from './types.js'
import { getSessionWithUserAndPosition } from './utils/db.js'

// Auth middleware
// 优化版本：使用单个JOIN查询获取session、user和position信息，减少数据库往返次数
// 同时直接返回计算好的role，避免重复计算
// 将position信息也存储到context中，供后续路由使用
export function createAuthMiddleware() {
  return async (c: any, next: () => Promise<void>) => {
    if (['/api/health','/api/init-if-empty','/api/auth/login','/api/auth/login-password','/api/auth/change-password-first','/api/auth/get-totp-qr','/api/auth/bind-totp-first','/api/me'].includes(c.req.path)) return next()
    const sid = getCookie(c, 'sid')
    if (!sid) return c.json({ error: 'unauthorized' }, 401)
    
    // 使用优化的函数一次性获取session、user、position和role信息
    const sessionData = await getSessionWithUserAndPosition(c.env.DB, sid)
    if (!sessionData || !sessionData.session) return c.json({ error: 'unauthorized' }, 401)
    
    c.set('userId', sessionData.session.user_id)
    
    // 检查是否有职位（必须基于员工记录）
    if (!sessionData.position || !sessionData.role) {
      // 没有员工记录，不允许访问系统
      return c.json({ error: 'employee record not found, please contact administrator' }, 403)
    }
    
    // 直接使用已计算的role，避免重复计算
    c.set('userRole', sessionData.role)
    // 存储position信息，供后续路由使用（避免重复查询）
    c.set('userPosition', sessionData.position)
    await next()
  }
}

