import { Hono } from 'hono'
import type { Env, AppVariables } from '../types.js'
import { Errors } from '../utils/errors.js'
import { logAuditAction } from '../utils/audit.js'

export const sessionsRoutes = new Hono<{ Bindings: Env, Variables: AppVariables }>()

interface Session {
  id: string
  user_id: string
  device_info: string | null
  ip_address: string | null
  user_agent: string | null
  created_at: number | null
  last_active_at: number | null
  expires_at: number
}

// 获取当前用户的所有会话
sessionsRoutes.get('/sessions', async (c) => {
  const userId = c.get('userId')
  if (!userId) throw Errors.UNAUTHORIZED()

  // 获取当前会话 ID（从 token 中）
  const currentSessionId = c.get('sessionId') as string | undefined

  const sessions = await c.env.DB.prepare(`
    SELECT id, device_info, ip_address, user_agent, created_at, last_active_at, expires_at
    FROM sessions 
    WHERE user_id = ? AND expires_at > ?
    ORDER BY last_active_at DESC
  `).bind(userId, Date.now()).all<Session>()

  const result = sessions.results.map(s => ({
    id: s.id,
    deviceInfo: parseDeviceInfo(s.user_agent),
    ipAddress: s.ip_address || '未知',
    createdAt: s.created_at,
    lastActiveAt: s.last_active_at,
    expiresAt: s.expires_at,
    isCurrent: s.id === currentSessionId
  }))

  return c.json({ sessions: result })
})

// 登出指定会话
sessionsRoutes.delete('/sessions/:id', async (c) => {
  const userId = c.get('userId')
  if (!userId) throw Errors.UNAUTHORIZED()

  const sessionId = c.req.param('id')
  
  // 验证会话属于当前用户
  const session = await c.env.DB.prepare(
    'SELECT id FROM sessions WHERE id = ? AND user_id = ?'
  ).bind(sessionId, userId).first<{ id: string }>()

  if (!session) {
    throw Errors.NOT_FOUND('会话')
  }

  // 删除会话
  await c.env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run()

  logAuditAction(c, 'logout_session', 'session', sessionId, JSON.stringify({ remote: true }))

  return c.json({ ok: true, message: '会话已登出' })
})

// 登出所有其他会话
sessionsRoutes.delete('/sessions', async (c) => {
  const userId = c.get('userId')
  if (!userId) throw Errors.UNAUTHORIZED()

  const currentSessionId = c.get('sessionId') as string | undefined

  // 删除除当前会话外的所有会话
  const result = await c.env.DB.prepare(
    'DELETE FROM sessions WHERE user_id = ? AND id != ?'
  ).bind(userId, currentSessionId || '').run()

  logAuditAction(c, 'logout_all_sessions', 'session', userId, JSON.stringify({ 
    count: result.meta.changes,
    keepCurrent: !!currentSessionId 
  }))

  return c.json({ ok: true, message: `已登出 ${result.meta.changes} 个其他会话` })
})

// 解析 User-Agent 为友好的设备信息
function parseDeviceInfo(userAgent: string | null): string {
  if (!userAgent) return '未知设备'

  const ua = userAgent.toLowerCase()
  
  // 检测浏览器
  let browser = '未知浏览器'
  if (ua.includes('chrome') && !ua.includes('edg')) browser = 'Chrome'
  else if (ua.includes('firefox')) browser = 'Firefox'
  else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari'
  else if (ua.includes('edg')) browser = 'Edge'
  else if (ua.includes('opera') || ua.includes('opr')) browser = 'Opera'

  // 检测操作系统
  let os = '未知系统'
  if (ua.includes('windows')) os = 'Windows'
  else if (ua.includes('mac os') || ua.includes('macos')) os = 'macOS'
  else if (ua.includes('linux') && !ua.includes('android')) os = 'Linux'
  else if (ua.includes('android')) os = 'Android'
  else if (ua.includes('iphone') || ua.includes('ipad')) os = 'iOS'

  // 检测设备类型
  let deviceType = '电脑'
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) deviceType = '手机'
  else if (ua.includes('ipad') || ua.includes('tablet')) deviceType = '平板'

  return `${browser} · ${os} · ${deviceType}`
}
