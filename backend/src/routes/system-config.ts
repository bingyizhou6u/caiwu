import { Hono } from 'hono'
import type { Env, AppVariables } from '../types.js'
import { isHQDirector } from '../utils/permissions.js'
import { logAuditAction } from '../utils/audit.js'
import { uuid } from '../utils/db.js'
import { Errors } from '../utils/errors.js'
import { validateJson, getValidatedData } from '../utils/validator.js'
import { updateSystemConfigSchema } from '../schemas/business.schema.js'
import type { z } from 'zod'

export const systemConfigRoutes = new Hono<{ Bindings: Env, Variables: AppVariables }>()

// 获取邮件提醒配置（无需认证，供登录时检查）
// 注意：此路由必须放在 /system-config/:key 之前，否则会被参数路由匹配
systemConfigRoutes.get('/system-config/email-notification/enabled', async (c) => {
  try {
    const row = await c.env.DB.prepare('select value from system_config where key=?').bind('email_notification_enabled').first<{ value: string }>()
    const enabled = row?.value === 'true'
    return c.json({ enabled })
  } catch (err: any) {
    // 如果查询失败，默认返回启用状态
    console.error('GET /system-config/email-notification/enabled error:', err)
    return c.json({ enabled: true })
  }
})

// 获取系统配置
systemConfigRoutes.get('/system-config', async (c) => {
  if (!isHQDirector(c)) throw Errors.FORBIDDEN()
  
  try {
    const rows = await c.env.DB.prepare('select * from system_config').all()
    const config: Record<string, any> = {}
    for (const row of (rows.results ?? [])) {
      const r = row as any
      // 尝试解析JSON值，如果不是JSON则使用原始值
      try {
        config[r.key] = JSON.parse(r.value)
      } catch {
        config[r.key] = r.value
      }
    }
    return c.json({ config })
  } catch (err: any) {
    console.error('GET /system-config error:', err)
    if (err && typeof err === 'object' && 'statusCode' in err) throw err
    throw Errors.INTERNAL_ERROR(err.message || '查询失败')
  }
})

// 更新系统配置
systemConfigRoutes.put('/system-config/:key', validateJson(updateSystemConfigSchema), async (c) => {
  if (!isHQDirector(c)) throw Errors.FORBIDDEN()
  
  try {
    const key = c.req.param('key')
    const body = getValidatedData<z.infer<typeof updateSystemConfigSchema>>(c)
    
    // 将值转换为字符串存储（如果是对象则转为JSON）
    const valueStr = typeof body.value === 'string' ? body.value : JSON.stringify(body.value)
    
    const userId = c.get('userId') as string | undefined
    const now = Date.now()
    
    // 检查配置是否存在
    const existing = await c.env.DB.prepare('select key from system_config where key=?').bind(key).first<{ key: string }>()
    
    if (existing) {
      // 更新现有配置
      await c.env.DB.prepare(`
        update system_config 
        set value=?, description=?, updated_at=?, updated_by=?
        where key=?
      `).bind(valueStr, body.description ?? null, now, userId ?? 'system', key).run()
    } else {
      // 创建新配置
      await c.env.DB.prepare(`
        insert into system_config (key, value, description, updated_at, updated_by)
        values(?,?,?,?,?)
      `).bind(key, valueStr, body.description ?? null, now, userId ?? 'system').run()
    }
    
    logAuditAction(c, 'update', 'system_config', key, JSON.stringify({ key, value: body.value }))
    return c.json({ ok: true })
  } catch (err: any) {
    console.error('PUT /system-config/:key error:', err)
    if (err && typeof err === 'object' && 'statusCode' in err) throw err
    throw Errors.INTERNAL_ERROR(err.message || '更新失败')
  }
})

// 获取单个配置项
systemConfigRoutes.get('/system-config/:key', async (c) => {
  if (!isHQDirector(c)) throw Errors.FORBIDDEN()
  
  try {
    const key = c.req.param('key')
    const row = await c.env.DB.prepare('select * from system_config where key=?').bind(key).first<any>()
    
    if (!row) {
      throw Errors.NOT_FOUND()
    }
    
    // 尝试解析JSON值
    let value: any
    try {
      value = JSON.parse(row.value)
    } catch {
      value = row.value
    }
    
    return c.json({ key: row.key, value, description: row.description })
  } catch (err: any) {
    console.error('GET /system-config/:key error:', err)
    if (err && typeof err === 'object' && 'statusCode' in err) throw err
    throw Errors.INTERNAL_ERROR(err.message || '查询失败')
  }
})

