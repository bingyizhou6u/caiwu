import { Hono } from 'hono'
import type { Env, AppVariables } from '../../types.js'
import { getUserPosition } from '../../utils/permissions.js'
import { Errors } from '../../utils/errors.js'

export const orgDepartmentsRoutes = new Hono<{ Bindings: Env, Variables: AppVariables }>()

// 获取组织部门列表（包含树形结构）
orgDepartmentsRoutes.get('/', async (c) => {
  if (!getUserPosition(c)) throw Errors.FORBIDDEN()
  const projectId = c.req.query('project_id')
  const binds: any[] = []
  let sql = `
    select od.id, od.project_id, od.parent_id, od.name, od.code, od.description, 
           od.allowed_modules, od.allowed_positions, od.default_position_id,
           od.active, od.sort_order, od.created_at, od.updated_at,
           p.name as default_position_name,
           parent.name as parent_name,
           d.name as project_name
    from org_departments od
    left join positions p on p.id = od.default_position_id
    left join org_departments parent on parent.id = od.parent_id
    left join departments d on d.id = od.project_id
    where od.active = 1
  `

  if (projectId) {
    if (projectId === 'hq') {
      sql += ' and od.project_id is null'
    } else {
      sql += ' and od.project_id = ?'
      binds.push(projectId)
    }
  }

  sql += ' order by od.project_id is null desc, od.sort_order asc, od.name asc'
  const rows = await c.env.DB.prepare(sql).bind(...binds).all()
  
  const results = (rows.results ?? []).map((row: any) => ({
    ...row,
    allowed_modules: row.allowed_modules ? JSON.parse(row.allowed_modules) : ['*'],
    allowed_positions: row.allowed_positions ? JSON.parse(row.allowed_positions) : null
  }))
  
  return c.json({ results })
})

// 获取单个部门详情
orgDepartmentsRoutes.get('/:id', async (c) => {
  if (!getUserPosition(c)) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  const row = await c.env.DB.prepare(`
    select od.id, od.project_id, od.parent_id, od.name, od.code, od.description, 
           od.allowed_modules, od.allowed_positions, od.default_position_id,
           od.active, od.sort_order, od.created_at, od.updated_at,
           p.name as default_position_name
    from org_departments od
    left join positions p on p.id = od.default_position_id
    where od.id = ?
  `).bind(id).first()
  
  if (!row) throw Errors.NOT_FOUND('部门不存在')
  
  return c.json({
    ...row,
    allowed_modules: (row as any).allowed_modules ? JSON.parse((row as any).allowed_modules) : ['*'],
    allowed_positions: (row as any).allowed_positions ? JSON.parse((row as any).allowed_positions) : null
  })
})
