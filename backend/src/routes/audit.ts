import { Hono } from 'hono'
import type { Env, AppVariables } from '../types.js'
import { requireRole, requirePermission, canRead, canWrite } from '../utils/permissions.js'
import { logAudit, logAuditAction } from '../utils/audit.js'
import { uuid } from '../utils/db.js'
import {getUserByEmail, getOrCreateDefaultHQ, ensureDefaultCurrencies} from '../utils/db.js'
import { applyDataScope } from '../utils/permissions.js'
import { Errors } from '../utils/errors.js'
import { validateQuery, getValidatedQuery } from '../utils/validator.js'
import { auditLogQuerySchema } from '../schemas/common.schema.js'
import type { z } from 'zod'

export const auditRoutes = new Hono<{ Bindings: Env, Variables: AppVariables }>()

auditRoutes.get('/audit-logs', validateQuery(auditLogQuerySchema), async (c) => {
  if (!(await requireRole(c, ['manager']))) throw Errors.FORBIDDEN()
  const query = getValidatedQuery<z.infer<typeof auditLogQuerySchema>>(c)
  const limit = query.limit ?? 100
  const offset = query.offset ?? 0
  const rows = await c.env.DB.prepare(`
    select al.*, u.name as actor_name, u.email as actor_email
    from audit_logs al
    left join users u on u.id = al.actor_id
    order by al.at desc
    limit ? offset ?
  `).bind(limit, offset).all()
  const total = await c.env.DB.prepare('select count(1) as n from audit_logs').first<{ n: number }>()
  return c.json({ results: rows.results ?? [], total: total?.n ?? 0 })
})

