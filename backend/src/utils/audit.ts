import { v4 as uuid } from 'uuid'
import { getCookie } from 'hono/cookie'
import { getSession, createDb } from './db.js'
import { DrizzleD1Database } from 'drizzle-orm/d1'
import { auditLogs } from '../db/schema.js'
import * as schema from '../db/schema.js'

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
  db: DrizzleD1Database<typeof schema>,
  actorId: string,
  action: string,
  entity: string,
  entityId?: string,
  detail?: string,
  ip?: string | null,
  ipLocation?: string | null
) {
  const id = uuid()
  await db.insert(auditLogs).values({
    id,
    actorId,
    action,
    entity,
    entityId: entityId ?? null,
    at: Date.now(),
    detail: detail ?? null,
    ip: ip ?? null,
    ipLocation: ipLocation ?? null
  }).execute()
}


export function logAuditAction(c: any, action: string, entity: string, entityId?: string, detail?: string) {
  const userId = c.get('userId') as string | undefined

  // 获取IP和IP归属地信息
  const { ip, ipLocation } = getIPInfo(c)

  if (!userId) {
    // 如果userId不存在，尝试从session中获取
    const sid = getCookie(c, 'sid')
    if (sid) {
      getSession(createDb(c.env.DB), sid).then(s => {
        if (s) {
          logAudit(createDb(c.env.DB), s.userId, action, entity, entityId, detail, ip, ipLocation).catch((err) => {
            console.error('Audit log error:', err)
          })
        }
      }).catch(() => { })
    }
    return
  }
  // 使用await确保日志记录完成，但使用catch避免阻塞主流程
  const promise = logAudit(createDb(c.env.DB), userId, action, entity, entityId, detail, ip, ipLocation).catch((err) => {
    console.error('Audit log error:', err, { action, entity, entityId, userId })
  })
  try {
    const ctx = (c as any).executionCtx
    if (ctx && typeof ctx.waitUntil === 'function') {
      ctx.waitUntil(promise)
    } else {
      // 测试环境或无 ExecutionContext 时直接跳过
      return
    }
  } catch {
    // 避免在无 executionCtx 时抛错阻断主流程
    return
  }
}
