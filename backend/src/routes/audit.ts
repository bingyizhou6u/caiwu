import { Hono } from 'hono'
import type { Env, AppVariables } from '../types.js'
import { hasPermission } from '../utils/permissions.js'
import { logAudit, logAuditAction } from '../utils/audit.js'
import { uuid } from '../utils/db.js'
import { getUserByEmail } from '../utils/db.js'
import { Errors } from '../utils/errors.js'
import { validateQuery, getValidatedQuery } from '../utils/validator.js'
import { auditLogQuerySchema } from '../schemas/common.schema.js'
import type { z } from 'zod'

export const auditRoutes = new Hono<{ Bindings: Env, Variables: AppVariables }>()

// 构建审计日志查询条件
function buildAuditQuery(query: z.infer<typeof auditLogQuerySchema>) {
  const conditions: string[] = []
  const params: any[] = []

  if (query.action) {
    conditions.push('al.action = ?')
    params.push(query.action)
  }

  if (query.entity) {
    conditions.push('al.entity = ?')
    params.push(query.entity)
  }

  if (query.actor_id) {
    conditions.push('al.actor_id = ?')
    params.push(query.actor_id)
  }

  if (query.actor_keyword) {
    conditions.push('(e.name LIKE ? OR u.email LIKE ?)')
    params.push(`%${query.actor_keyword}%`, `%${query.actor_keyword}%`)
  }

  if (query.start_time) {
    conditions.push('al.at >= ?')
    params.push(query.start_time)
  }

  if (query.end_time) {
    conditions.push('al.at <= ?')
    params.push(query.end_time)
  }

  return { conditions, params }
}

auditRoutes.get('/audit-logs', validateQuery(auditLogQuerySchema), async (c) => {
  if (!hasPermission(c, 'system', 'audit', 'view')) throw Errors.FORBIDDEN()
  
  const query = getValidatedQuery<z.infer<typeof auditLogQuerySchema>>(c)
  const limit = query.limit ?? 100
  const offset = query.offset ?? 0

  const { conditions, params } = buildAuditQuery(query)
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const rows = await c.env.DB.prepare(`
    SELECT al.*, e.name as actor_name, u.email as actor_email
    FROM audit_logs al
    LEFT JOIN users u ON u.id = al.actor_id
    LEFT JOIN employees e ON e.email = u.email
    ${whereClause}
    ORDER BY al.at DESC
    LIMIT ? OFFSET ?
  `).bind(...params, limit, offset).all()

  const total = await c.env.DB.prepare(`
    SELECT count(1) as n 
    FROM audit_logs al
    LEFT JOIN users u ON u.id = al.actor_id
    LEFT JOIN employees e ON e.email = u.email
    ${whereClause}
  `).bind(...params).first<{ n: number }>()

  return c.json({ results: rows.results ?? [], total: total?.n ?? 0 })
})

// 获取筛选选项（所有操作类型和实体类型）
auditRoutes.get('/audit-logs/options', async (c) => {
  if (!hasPermission(c, 'system', 'audit', 'view')) throw Errors.FORBIDDEN()

  const actions = await c.env.DB.prepare(
    'SELECT DISTINCT action FROM audit_logs WHERE action IS NOT NULL ORDER BY action'
  ).all()

  const entities = await c.env.DB.prepare(
    'SELECT DISTINCT entity FROM audit_logs WHERE entity IS NOT NULL ORDER BY entity'
  ).all()

  const actors = await c.env.DB.prepare(`
    SELECT DISTINCT u.id, e.name, u.email
    FROM audit_logs al
    JOIN users u ON u.id = al.actor_id
    LEFT JOIN employees e ON e.email = u.email
    ORDER BY e.name, u.email
  `).all()

  return c.json({
    actions: (actions.results ?? []).map((r: any) => r.action),
    entities: (entities.results ?? []).map((r: any) => r.entity),
    actors: actors.results ?? []
  })
})

// 导出审计日志
auditRoutes.get('/audit-logs/export', validateQuery(auditLogQuerySchema), async (c) => {
  if (!hasPermission(c, 'system', 'audit', 'export')) throw Errors.FORBIDDEN()

  const query = getValidatedQuery<z.infer<typeof auditLogQuerySchema>>(c)
  const { conditions, params } = buildAuditQuery(query)
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  // 导出最多10000条
  const rows = await c.env.DB.prepare(`
    SELECT 
      al.at,
      e.name as actor_name,
      u.email as actor_email,
      al.action,
      al.entity,
      al.entity_id,
      al.ip,
      al.ip_location,
      al.detail
    FROM audit_logs al
    LEFT JOIN users u ON u.id = al.actor_id
    LEFT JOIN employees e ON e.email = u.email
    ${whereClause}
    ORDER BY al.at DESC
    LIMIT 10000
  `).bind(...params).all()

  // 生成CSV
  const headers = ['时间', '操作人', '邮箱', '操作', '实体类型', '实体ID', 'IP地址', 'IP归属地', '详情']
  const csvRows = [headers.join(',')]

  for (const row of (rows.results ?? []) as any[]) {
    const time = new Date(row.at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return ''
      const str = String(val)
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }
    csvRows.push([
      escapeCsv(time),
      escapeCsv(row.actor_name || ''),
      escapeCsv(row.actor_email || ''),
      escapeCsv(row.action),
      escapeCsv(row.entity),
      escapeCsv(row.entity_id || ''),
      escapeCsv(row.ip || ''),
      escapeCsv(row.ip_location || ''),
      escapeCsv(row.detail || '')
    ].join(','))
  }

  const csv = '\uFEFF' + csvRows.join('\n') // BOM for Excel

  logAuditAction(c, 'export', 'audit_log', undefined, JSON.stringify({ count: rows.results?.length ?? 0 }))

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="audit-logs-${new Date().toISOString().slice(0,10)}.csv"`
    }
  })
})

