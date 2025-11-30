/**
 * 部门和站点路由模块
 */

import { Hono } from 'hono'
import type { Env, AppVariables } from '../../types.js'
import { hasPermission } from '../../utils/permissions.js'
import { logAudit, logAuditAction } from '../../utils/audit.js'
import { uuid } from '../../utils/db.js'
import { SystemService } from '../../services/SystemService.js'
import { DepartmentService } from '../../services/DepartmentService.js'
import { Errors, AppError } from '../../utils/errors.js'
import { validateJson, getValidatedData } from '../../utils/validator.js'
import { createDepartmentSchema, createSiteSchema, updateDepartmentSchema, updateSiteSchema } from '../../schemas/master-data.schema.js'
import { z } from 'zod'

export const departmentsRoutes = new Hono<{ Bindings: Env, Variables: AppVariables }>()

// ========== 部门相关 ==========

// 获取部门列表
departmentsRoutes.get('/departments', async (c) => {
  // 所有人都可以查看
  const rows = await c.env.DB.prepare('select * from departments').all()
  return c.json({ results: rows.results ?? [] })
})

// 创建部门
departmentsRoutes.post('/departments', validateJson(createDepartmentSchema), async (c) => {
  if (!hasPermission(c, 'system', 'department', 'create')) throw Errors.FORBIDDEN()

  const body = getValidatedData<z.infer<typeof createDepartmentSchema>>(c)
  const systemService = new SystemService(c.env.DB)
  const hq = body.hq_id ? { id: body.hq_id } : await systemService.getOrCreateDefaultHQ()

  // 检查部门名称是否全局唯一
  const existed = await c.env.DB.prepare('select id from departments where name=?').bind(body.name).first<{ id: string }>()
  if (existed?.id) throw Errors.DUPLICATE('部门名称')

  const id = uuid()
  await c.env.DB.prepare('insert into departments(id,hq_id,name,active) values(?,?,?,1)')
    .bind(id, hq.id, body.name).run()

  // 为新创建的项目自动创建默认部门（人事部、财务部、行政部、开发部）
  const deptService = new DepartmentService(c.env.DB)
  const userId = c.get('userId') as string | undefined
  await deptService.createDefaultOrgDepartments(id, userId)

  logAuditAction(c, 'create', 'department', id, JSON.stringify({ name: body.name, hq_id: hq.id }))
  return c.json({ id, hq_id: hq.id, name: body.name })
})

// 更新部门
departmentsRoutes.put('/departments/:id', validateJson(updateDepartmentSchema), async (c) => {
  if (!hasPermission(c, 'system', 'department', 'update')) throw Errors.FORBIDDEN()

  const id = c.req.param('id')
  const body = getValidatedData<z.infer<typeof updateDepartmentSchema>>(c)

  // 如果更新名称，检查是否与其他部门重复
  if (body.name !== undefined) {
    const existed = await c.env.DB.prepare('select id from departments where name=? and id!=?').bind(body.name, id).first<{ id: string }>()
    if (existed?.id) throw Errors.DUPLICATE('部门名称')
  }

  const dept = await c.env.DB.prepare('select name from departments where id=?').bind(id).first<{ name: string }>()
  if (!dept) throw Errors.NOT_FOUND('部门')

  const updates: string[] = []
  const binds: any[] = []

  if (body.name !== undefined) {
    updates.push('name=?')
    binds.push(body.name)
  }
  if (body.hq_id !== undefined) {
    updates.push('hq_id=?')
    binds.push(body.hq_id)
  }
  if (body.active !== undefined) {
    updates.push('active=?')
    binds.push(body.active)
  }

  if (updates.length === 0) throw Errors.VALIDATION_ERROR('没有需要更新的字段')

  updates.push('updated_at=?')
  binds.push(Date.now(), id)

  await c.env.DB.prepare(`update departments set ${updates.join(',')} where id=?`).bind(...binds).run()
  logAuditAction(c, 'update', 'department', id, JSON.stringify(body))
  return c.json({ ok: true })
})

// 删除部门
departmentsRoutes.delete('/departments/:id', async (c) => {
  try {
    if (!hasPermission(c, 'system', 'department', 'delete')) throw Errors.FORBIDDEN()

    const id = c.req.param('id')
    const dept = await c.env.DB.prepare('select name from departments where id=?').bind(id).first<{ name: string }>()
    if (!dept) throw Errors.NOT_FOUND('部门')

    // 检查是否有站点使用此部门
    const sites = await c.env.DB.prepare('select count(1) as cnt from sites where department_id=?').bind(id).first<{ cnt: number }>()
    if (sites && Number(sites.cnt) > 0) {
      throw Errors.BUSINESS_ERROR('无法删除，该项目下还有站点')
    }

    // 检查是否有员工使用此部门
    const employees = await c.env.DB.prepare('select count(1) as cnt from employees where department_id=?').bind(id).first<{ cnt: number }>()
    if (employees && Number(employees.cnt) > 0) {
      throw Errors.BUSINESS_ERROR('无法删除，该项目下还有员工')
    }

    // 检查是否有组织部门使用此部门（作为project_id）
    const orgDepts = await c.env.DB.prepare('select count(1) as cnt from org_departments where project_id=?').bind(id).first<{ cnt: number }>()
    if (orgDepts && Number(orgDepts.cnt) > 0) {
      throw Errors.BUSINESS_ERROR('无法删除，该项目下还有组织部门')
    }

    await c.env.DB.prepare('delete from departments where id=?').bind(id).run()
    logAuditAction(c, 'delete', 'department', id, JSON.stringify({ name: dept.name }))
    return c.json({ ok: true })
  } catch (e: any) {
    // 如果是AppError实例，直接抛出
    if (e instanceof AppError) {
      throw e
    }
    // 如果是包含statusCode的对象，也直接抛出（向后兼容）
    if (e && typeof e === 'object' && 'statusCode' in e) {
      throw e
    }
    console.error('Delete department error:', e)
    throw Errors.INTERNAL_ERROR(String(e?.message || e))
  }
})

// ========== 站点相关 ==========

// 获取站点列表
departmentsRoutes.get('/sites', async (c) => {
  // 所有人都可以查看
  const rows = await c.env.DB.prepare(`
    select s.*, d.name as department_name
    from sites s
    left join departments d on d.id = s.department_id
    order by s.name
  `).all()
  return c.json({ results: rows.results ?? [] })
})

// 创建站点
departmentsRoutes.post('/sites', validateJson(createSiteSchema), async (c) => {
  if (!hasPermission(c, 'site', 'info', 'create')) throw Errors.FORBIDDEN()

  const body = getValidatedData<z.infer<typeof createSiteSchema>>(c)

  // 同一部门下站点重名校验
  const existed = await c.env.DB.prepare('select id from sites where department_id=? and name=? and active=1')
    .bind(body.department_id, body.name).first<{ id: string }>()
  if (existed?.id) throw Errors.DUPLICATE('站点名称')

  const id = uuid()
  await c.env.DB.prepare('insert into sites(id,department_id,name,active) values(?,?,?,1)')
    .bind(id, body.department_id, body.name).run()

  logAuditAction(c, 'create', 'site', id, JSON.stringify({ name: body.name, department_id: body.department_id }))
  return c.json({ id, ...body })
})

// 更新站点
departmentsRoutes.put('/sites/:id', validateJson(updateSiteSchema), async (c) => {
  if (!hasPermission(c, 'site', 'info', 'update')) throw Errors.FORBIDDEN()

  const id = c.req.param('id')
  const body = getValidatedData<z.infer<typeof updateSiteSchema>>(c)

  const site = await c.env.DB.prepare('select name from sites where id=?').bind(id).first<{ name: string }>()
  if (!site) throw Errors.NOT_FOUND('站点')

  const updates: string[] = []
  const binds: any[] = []

  if (body.name !== undefined) {
    updates.push('name=?')
    binds.push(body.name)
  }
  if (body.department_id !== undefined) {
    updates.push('department_id=?')
    binds.push(body.department_id)
  }
  if (body.active !== undefined) {
    updates.push('active=?')
    binds.push(body.active)
  }

  if (updates.length === 0) throw Errors.VALIDATION_ERROR('没有需要更新的字段')

  updates.push('updated_at=?')
  binds.push(Date.now(), id)

  await c.env.DB.prepare(`update sites set ${updates.join(',')} where id=?`).bind(...binds).run()
  logAuditAction(c, 'update', 'site', id, JSON.stringify(body))
  return c.json({ ok: true })
})

// 删除站点
departmentsRoutes.delete('/sites/:id', async (c) => {
  if (!hasPermission(c, 'site', 'info', 'delete')) throw Errors.FORBIDDEN()

  const id = c.req.param('id')
  const site = await c.env.DB.prepare('select name from sites where id=?').bind(id).first<{ name: string }>()
  if (!site) throw Errors.NOT_FOUND('站点')

  await c.env.DB.prepare('delete from sites where id=?').bind(id).run()
  logAuditAction(c, 'delete', 'site', id, JSON.stringify({ name: site.name }))
  return c.json({ ok: true })
})

