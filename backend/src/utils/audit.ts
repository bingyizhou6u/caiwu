import { v4 as uuid } from 'uuid'
import { getCookie } from 'hono/cookie'
import { getSession } from './db.js'

// 从Cloudflare请求头获取IP和IP归属地信息
function getIPInfo(c: any): { ip: string | null, ipLocation: string | null } {
  try {
    // 获取客户端IP
    const cfIp = c.req.header('cf-connecting-ip')
    const forwardedFor = c.req.header('x-forwarded-for')
    const ip = cfIp || (forwardedFor ? forwardedFor.split(',')[0].trim() : null) || null

    // 获取IP归属地信息（从Cloudflare请求头）
    const country = c.req.header('cf-ipcountry') || null
    const city = c.req.header('cf-ipcity') || null

    let ipLocation: string | null = null
    if (country || city) {
      const parts: string[] = []
      if (city) parts.push(city)
      if (country) parts.push(country)
      ipLocation = parts.join(', ')
    }

    return { ip, ipLocation }
  } catch (err) {
    // 如果获取IP信息失败，返回null，不影响主流程
    console.error('Failed to get IP info:', err)
    return { ip: null, ipLocation: null }
  }
}

export async function logAudit(
  db: D1Database,
  actorId: string,
  action: string,
  entity: string,
  entityId?: string,
  detail?: string,
  ip?: string | null,
  ipLocation?: string | null
) {
  const id = uuid()
  await db.prepare('insert into audit_logs(id,actor_id,action,entity,entity_id,at,detail,ip,ip_location) values(?,?,?,?,?,?,?,?,?)')
    .bind(id, actorId, action, entity, entityId ?? null, Date.now(), detail ?? null, ip ?? null, ipLocation ?? null).run()
}

export function logAuditAction(c: any, action: string, entity: string, entityId?: string, detail?: string) {
  const userId = c.get('userId') as string | undefined

  // 获取IP和IP归属地信息
  const { ip, ipLocation } = getIPInfo(c)

  if (!userId) {
    // 如果userId不存在，尝试从session中获取
    const sid = getCookie(c, 'sid')
    if (sid) {
      getSession(c.env.DB, sid).then(s => {
        if (s) {
          logAudit(c.env.DB, s.user_id, action, entity, entityId, detail, ip, ipLocation).catch((err) => {
            console.error('Audit log error:', err)
          })
        }
      }).catch(() => { })
    }
    return
  }
  // 使用await确保日志记录完成，但使用catch避免阻塞主流程
  const promise = logAudit(c.env.DB, userId, action, entity, entityId, detail, ip, ipLocation).catch((err) => {
    console.error('Audit log error:', err, { action, entity, entityId, userId })
  })
  if (c.executionCtx && c.executionCtx.waitUntil) {
    console.log('Calling waitUntil for audit log')
    c.executionCtx.waitUntil(promise)
  } else {
    console.log('No executionCtx or waitUntil found')
  }
}

