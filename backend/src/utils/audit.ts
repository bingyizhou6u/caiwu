import { getCookie } from 'hono/cookie'
import { getSession, createDb } from './db.js'
import { Logger } from './logger.js'

// 从Cloudflare请求头获取IP和IP归属地信息
function getIPInfo(c: any): { ip: string | null; ipLocation: string | null } {
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
      if (city) { parts.push(city) }
      if (country) { parts.push(country) }
      ipLocation = parts.join(', ')
    }

    return { ip, ipLocation }
  } catch (err) {
    // 如果获取IP信息失败，返回null，不影响主流程
    Logger.error('Failed to get IP info', { error: err })
    return { ip: null, ipLocation: null }
  }
}

export function logAuditAction(
  c: any,
  action: string,
  entity: string,
  entityId?: string,
  detail?: string
) {
  const employeeId = c.get('employeeId') as string | undefined
  const auditService = c.get('services')?.audit

  // 获取IP和IP归属地信息
  const { ip, ipLocation } = getIPInfo(c)

  if (!employeeId) {
    // 如果userId不存在，尝试从session中获取
    // 注意：AuditService 需要 actorId。如果 session 也拿不到，就无法记录（或者记录为 system?）
    const sid = getCookie(c, 'sid')
    if (sid && auditService) {
      getSession(createDb(c.env.DB), sid)
        .then(s => {
          if (s) {
            auditService
              .log(s.employeeId, action, entity, entityId, detail, ip, ipLocation)
              .catch((err: any) => {
                Logger.error('Audit log error', { error: err })
              })
          }
        })
        .catch(() => { })
    }
    return
  }

  if (!auditService) {
    Logger.error('AuditService not found in context')
    return
  }

  // 使用await确保日志记录完成，但使用catch避免阻塞主流程
  const promise = auditService
    .log(employeeId, action, entity, entityId, detail, ip, ipLocation)
    .catch((err: any) => {
      Logger.error('Audit log error', { error: err, action, entity, entityId, employeeId })
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
