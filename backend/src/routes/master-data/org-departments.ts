import { Hono } from 'hono'
import type { Env, AppVariables } from '../../types.js'
import { canRead } from '../../utils/permissions.js'
import { Errors } from '../../utils/errors.js'

export const orgDepartmentsRoutes = new Hono<{ Bindings: Env, Variables: AppVariables }>()

orgDepartmentsRoutes.get('/', async (c) => {
  if (!canRead(c)) throw Errors.FORBIDDEN()
  const projectId = c.req.query('project_id')
  const binds: any[] = []
  let sql = 'select id, project_id, parent_id, name, code, description, active, sort_order from org_departments where active = 1'

  if (projectId) {
    if (projectId === 'hq') {
      sql += ' and project_id is null'
    } else {
      sql += ' and project_id = ?'
      binds.push(projectId)
    }
  }

  sql += ' order by sort_order asc, name asc'
  const rows = await c.env.DB.prepare(sql).bind(...binds).all()
  return c.json({ results: rows.results ?? [] })
})
