import { Hono } from 'hono'
import type { Env, AppVariables } from '../types.js'
import { hasPermission } from '../utils/permissions.js'
import { logAudit, logAuditAction } from '../utils/audit.js'
import { v4 as uuid } from 'uuid'
import { Errors } from '../utils/errors.js'
import { validateJson, getValidatedData } from '../utils/validator.js'
import { createPositionSchema, updatePositionSchema } from '../schemas/business.schema.js'
import type { z } from 'zod'

export const positionPermissionsRoutes = new Hono<{ Bindings: Env, Variables: AppVariables }>()

// 获取所有职位列表（包括禁用的，用于权限管理）
positionPermissionsRoutes.get('/position-permissions', async (c) => {
  if (!hasPermission(c, 'system', 'position', 'view')) throw Errors.FORBIDDEN()
  
  const rows = await c.env.DB.prepare('select * from positions order by sort_order, name').all()
  return c.json({ results: rows.results ?? [] })
})

// 获取单个职位详情
positionPermissionsRoutes.get('/position-permissions/:id', async (c) => {
  if (!hasPermission(c, 'system', 'position', 'view')) throw Errors.FORBIDDEN()
  
  const id = c.req.param('id')
  const row = await c.env.DB.prepare('select * from positions where id=?').bind(id).first<any>()
  if (!row) throw Errors.NOT_FOUND()
  
  return c.json({
    ...row,
    permissions: typeof row.permissions === 'string' ? JSON.parse(row.permissions) : row.permissions
  })
})

// 创建新职位
positionPermissionsRoutes.post('/position-permissions', validateJson(createPositionSchema), async (c) => {
  if (!hasPermission(c, 'system', 'position', 'create')) throw Errors.FORBIDDEN()
  
  const body = getValidatedData<z.infer<typeof createPositionSchema>>(c)
  
  // 检查code是否已存在
  const existing = await c.env.DB.prepare('select id from positions where code=?').bind(body.code).first<{ id: string }>()
  if (existing) throw Errors.DUPLICATE('职位代码')
  
  const id = uuid()
  const now = Date.now()
  const permissionsJson = JSON.stringify(body.permissions)
  
  await c.env.DB.prepare(`
    insert into positions(id, code, name, level, scope, permissions, description, active, sort_order, created_at, updated_at)
    values(?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
  `).bind(
    id,
    body.code,
    body.name,
    body.level,
    body.scope,
    permissionsJson,
    body.description || null,
    body.sort_order || 0,
    now,
    now
  ).run()
  
  const userId = c.get('userId') as string | undefined
  if (userId) {
    logAuditAction(c, 'create', 'position', id, JSON.stringify(body))
  }
  
  return c.json({ id, ...body })
})

// 更新职位
positionPermissionsRoutes.put('/position-permissions/:id', validateJson(updatePositionSchema), async (c) => {
  if (!hasPermission(c, 'system', 'position', 'update')) throw Errors.FORBIDDEN()
  
  const id = c.req.param('id')
  const body = getValidatedData<z.infer<typeof updatePositionSchema>>(c)
  
  // 检查职位是否存在
  const existing = await c.env.DB.prepare('select * from positions where id=?').bind(id).first<any>()
  if (!existing) throw Errors.NOT_FOUND()
  
  // 如果更新code，检查是否与其他职位冲突
  if (body.code && body.code !== existing.code) {
    const codeExists = await c.env.DB.prepare('select id from positions where code=? and id!=?').bind(body.code, id).first<{ id: string }>()
    if (codeExists) throw Errors.DUPLICATE('职位代码')
  }
  
  const updates: string[] = []
  const binds: any[] = []
  
  if (body.code !== undefined) {
    updates.push('code = ?')
    binds.push(body.code)
  }
  if (body.name !== undefined) {
    updates.push('name = ?')
    binds.push(body.name)
  }
  if (body.level !== undefined) {
    updates.push('level = ?')
    binds.push(body.level)
  }
  if (body.scope !== undefined) {
    updates.push('scope = ?')
    binds.push(body.scope)
  }
  if (body.permissions !== undefined) {
    updates.push('permissions = ?')
    binds.push(JSON.stringify(body.permissions))
  }
  if (body.description !== undefined) {
    updates.push('description = ?')
    binds.push(body.description || null)
  }
  if (body.sort_order !== undefined) {
    updates.push('sort_order = ?')
    binds.push(body.sort_order)
  }
  if (body.active !== undefined) {
    updates.push('active = ?')
    binds.push(body.active)
  }
  
  if (updates.length === 0) {
    throw Errors.VALIDATION_ERROR('没有需要更新的字段')
  }
  
  updates.push('updated_at = ?')
  binds.push(Date.now())
  binds.push(id)
  
  await c.env.DB.prepare(`update positions set ${updates.join(', ')} where id=?`).bind(...binds).run()
  
  const userId = c.get('userId') as string | undefined
  if (userId) {
    logAuditAction(c, 'update', 'position', id, JSON.stringify(body))
  }
  
  return c.json({ id, ...body })
})

// 删除职位（软删除）
positionPermissionsRoutes.delete('/position-permissions/:id', async (c) => {
  if (!hasPermission(c, 'system', 'position', 'delete')) throw Errors.FORBIDDEN()
  
  const id = c.req.param('id')
  
  // 检查是否有员工使用此职位
  const employees = await c.env.DB.prepare('select count(*) as count from employees where position_id=? and active=1').bind(id).first<{ count: number }>()
  if (employees && employees.count > 0) {
    throw Errors.BUSINESS_ERROR('无法删除，该职位已分配给员工')
  }
  
  // 检查是否有用户使用此职位
  const users = await c.env.DB.prepare('select count(*) as count from users where position_id=? and active=1').bind(id).first<{ count: number }>()
  if (users && users.count > 0) {
    throw Errors.BUSINESS_ERROR('无法删除，该职位已分配给用户')
  }
  
  // 软删除
  await c.env.DB.prepare('update positions set active=0, updated_at=? where id=?').bind(Date.now(), id).run()
  
  const userId = c.get('userId') as string | undefined
  if (userId) {
    logAuditAction(c, 'delete', 'position', id)
  }
  
  return c.json({ success: true })
})

