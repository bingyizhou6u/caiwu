import { Hono } from 'hono'
import type { Env, AppVariables } from '../types.js'
import { requireRole } from '../utils/permissions.js'
import { uuid } from '../utils/db.js'
import { logAuditAction } from '../utils/audit.js'
import { Errors } from '../utils/errors.js'
import { getCache, setCache, deleteCache, cacheKeys } from '../utils/cache.js'

export const rolePermissionsRoutes = new Hono<{ Bindings: Env, Variables: AppVariables }>()

// 获取所有角色权限配置
rolePermissionsRoutes.get('/role-permissions', async (c) => {
  if (!(await requireRole(c, ['manager']))) throw Errors.FORBIDDEN()
  
  // 尝试从缓存获取
  const cached = getCache<any[]>(cacheKeys.rolePermissions)
  if (cached) {
    return c.json({ results: cached })
  }
  
  const rows = await c.env.DB.prepare('select * from role_permissions order by role').all()
  const results = (rows.results ?? []).map((row: any) => ({
    ...row,
    permissions: typeof row.permissions === 'string' ? JSON.parse(row.permissions) : row.permissions
  }))
  
  // 缓存10分钟
  setCache(cacheKeys.rolePermissions, results, 10 * 60 * 1000)
  
  return c.json({ results })
})

// 获取单个角色权限配置
rolePermissionsRoutes.get('/role-permissions/:role', async (c) => {
  if (!(await requireRole(c, ['manager']))) throw Errors.FORBIDDEN()
  const role = c.req.param('role')
  const row = await c.env.DB.prepare('select * from role_permissions where role=?').bind(role).first<any>()
  if (!row) throw Errors.NOT_FOUND()
  return c.json({
    ...row,
    permissions: typeof row.permissions === 'string' ? JSON.parse(row.permissions) : row.permissions
  })
})

// 创建或更新角色权限配置
rolePermissionsRoutes.post('/role-permissions', async (c) => {
  if (!(await requireRole(c, ['manager']))) throw Errors.FORBIDDEN()
  const body = await c.req.json<{ role: string, permissions: any, description?: string }>()
  if (!body.role || !body.permissions) throw Errors.VALIDATION_ERROR('role and permissions参数必填')
  
  const allowedRoles = ['manager', 'finance', 'hr', 'auditor', 'read', 'employee']
  if (!allowedRoles.includes(body.role)) {
    throw Errors.VALIDATION_ERROR('无效的角色')
  }
  
  // 检查是否已存在
  const existing = await c.env.DB.prepare('select id from role_permissions where role=?').bind(body.role).first<{ id: string }>()
  
  const permissionsJson = JSON.stringify(body.permissions)
  const now = Date.now()
  
  if (existing) {
    // 更新
    await c.env.DB.prepare('update role_permissions set permissions=?, description=?, updated_at=? where role=?')
      .bind(permissionsJson, body.description || null, now, body.role).run()
    
    // 清除缓存
    deleteCache(cacheKeys.rolePermissions)
    deleteCache(cacheKeys.rolePermissionsByRole(body.role))
    
    logAuditAction(c, 'update', 'role_permissions', body.role, JSON.stringify({ permissions: body.permissions }))
    return c.json({ ok: true })
  } else {
    // 创建
    const id = uuid()
    await c.env.DB.prepare('insert into role_permissions(id,role,permissions,description,created_at,updated_at) values(?,?,?,?,?,?)')
      .bind(id, body.role, permissionsJson, body.description || null, now, now).run()
    
    // 清除缓存
    deleteCache(cacheKeys.rolePermissions)
    
    logAuditAction(c, 'create', 'role_permissions', body.role, JSON.stringify({ permissions: body.permissions }))
    return c.json({ ok: true, id })
  }
})

// 删除角色权限配置（不允许删除，只能更新）
rolePermissionsRoutes.delete('/role-permissions/:role', async (c) => {
  if (!(await requireRole(c, ['manager']))) throw Errors.FORBIDDEN()
  throw Errors.BUSINESS_ERROR('不能删除角色权限，只能更新')
})

// 获取当前用户的权限配置（用于前端权限控制）
// 优化版本：优先使用中间件中已获取的position.permissions，避免数据库查询
rolePermissionsRoutes.get('/my-permissions', async (c) => {
  const role = c.get('userRole') as string | undefined
  if (!role) throw Errors.UNAUTHORIZED('未授权')
  
  // 优先使用中间件中已获取的position信息（避免数据库查询）
  const position = c.get('userPosition')
  if (position?.permissions) {
    // 使用职位权限（新系统）
    return c.json({ permissions: position.permissions })
  }
  
  // 向后兼容：如果没有position权限，尝试从role_permissions表获取（旧系统）
  // 添加缓存以减少数据库查询
  const cacheKey = `role_permissions:${role}`
  const cached = getCache<any>(cacheKey)
  if (cached) {
    return c.json({ permissions: cached })
  }
  
  const row = await c.env.DB.prepare('select permissions from role_permissions where role=?').bind(role).first<{ permissions: string }>()
  if (!row) {
    // 如果没有配置，返回空权限（只读）
    const defaultPermissions = { menus: {}, actions: {} }
    setCache(cacheKey, defaultPermissions, 10 * 60 * 1000)
    return c.json({ permissions: defaultPermissions })
  }
  
  const permissions = typeof row.permissions === 'string' ? JSON.parse(row.permissions) : row.permissions
  // 缓存10分钟
  setCache(cacheKey, permissions, 10 * 60 * 1000)
  return c.json({ permissions })
})

