import { v4 as uuid } from 'uuid'
import { getCookie } from 'hono/cookie'
import { getSession } from './db.js'

export async function logAudit(db: D1Database, actorId: string, action: string, entity: string, entityId?: string, detail?: string) {
  const id = uuid()
  await db.prepare('insert into audit_logs(id,actor_id,action,entity,entity_id,at,detail) values(?,?,?,?,?,?,?)')
    .bind(id, actorId, action, entity, entityId ?? null, Date.now(), detail ?? null).run()
}

export function logAuditAction(c: any, action: string, entity: string, entityId?: string, detail?: string) {
  const userId = c.get('userId') as string | undefined
  if (!userId) {
    // 如果userId不存在，尝试从session中获取
    const sid = getCookie(c, 'sid')
    if (sid) {
      getSession(c.env.DB, sid).then(s => {
        if (s) {
          logAudit(c.env.DB, s.user_id, action, entity, entityId, detail).catch((err) => {
            console.error('Audit log error:', err)
          })
        }
      }).catch(() => {})
    }
    return
  }
  // 使用await确保日志记录完成，但使用catch避免阻塞主流程
  logAudit(c.env.DB, userId, action, entity, entityId, detail).catch((err) => {
    console.error('Audit log error:', err, { action, entity, entityId, userId })
  })
}

