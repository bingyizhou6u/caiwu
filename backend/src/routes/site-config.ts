import { Hono } from 'hono'
import { v4 as uuid } from 'uuid'
import { isHQDirector } from '../utils/permissions.js'
import { logAuditAction } from '../utils/audit.js'
import type { Env } from '../types.js'
import { Errors } from '../utils/errors.js'
import { validateJson, getValidatedData } from '../utils/validator.js'
import { updateSiteConfigSchema, batchUpdateSiteConfigSchema } from '../schemas/business.schema.js'
import type { z } from 'zod'

const siteConfigRoutes = new Hono<{ Variables: { userId?: string, userRole?: string }, Bindings: Env }>()

// 获取所有配置
siteConfigRoutes.get('/site-config', async (c) => {
  if (!isHQDirector(c)) throw Errors.FORBIDDEN()
  
  try {
    const configs = await c.env.DB.prepare('select * from site_config order by config_key').all<{
      id: string
      config_key: string
      config_value: string | null
      description: string | null
      is_encrypted: number
      created_at: number
      updated_at: number
    }>()
    
    // 对于加密字段，返回时隐藏实际值（只显示是否已配置）
    const result = configs.results?.map(config => ({
      id: config.id,
      config_key: config.config_key,
      config_value: config.is_encrypted === 1 && config.config_value 
        ? '***已配置***' 
        : config.config_value || '',
      description: config.description,
      is_encrypted: config.is_encrypted === 1,
      created_at: config.created_at,
      updated_at: config.updated_at,
    })) || []
    
    return c.json(result)
  } catch (error: any) {
    console.error('Error fetching site config:', error)
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    throw Errors.INTERNAL_ERROR(error.message || '服务器内部错误')
  }
})

// 更新配置
siteConfigRoutes.put('/site-config/:key', validateJson(updateSiteConfigSchema), async (c) => {
  if (!isHQDirector(c)) throw Errors.FORBIDDEN()
  
  try {
    const key = c.req.param('key')
    const body = getValidatedData<z.infer<typeof updateSiteConfigSchema>>(c)
    
    // 检查配置项是否存在
    const existing = await c.env.DB.prepare('select * from site_config where config_key=?').bind(key).first<{
      id: string
      is_encrypted: number
    }>()
    
    if (!existing) {
      throw Errors.NOT_FOUND('config key')
    }
    
    // 更新配置值
    const now = Date.now()
    await c.env.DB.prepare('update site_config set config_value=?, updated_at=? where config_key=?')
      .bind(body.config_value, now, key).run()
    
    logAuditAction(c, 'update', 'site_config', key, JSON.stringify({ config_key: key }))
    
    return c.json({ ok: true })
  } catch (error: any) {
    console.error('Error updating site config:', error)
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    throw Errors.INTERNAL_ERROR(error.message || '服务器内部错误')
  }
})

// 批量更新配置
siteConfigRoutes.put('/site-config', validateJson(batchUpdateSiteConfigSchema), async (c) => {
  if (!isHQDirector(c)) throw Errors.FORBIDDEN()
  
  try {
    const body = getValidatedData<z.infer<typeof batchUpdateSiteConfigSchema>>(c)
    
    const now = Date.now()
    const keys = Object.keys(body).filter(key => typeof body[key] === 'string')
    
    if (keys.length === 0) {
      return c.json({ ok: true, updated: 0 })
    }
    
    // 优化：批量查询现有配置
    const placeholders = keys.map(() => '?').join(',')
    const existing = await c.env.DB.prepare(`
      select config_key from site_config where config_key in (${placeholders})
    `).bind(...keys).all<{ config_key: string }>()
    
    const existingKeys = new Set((existing.results || []).map(r => r.config_key))
    
    // 使用 batch API 批量更新
    const statements = keys
      .filter(key => existingKeys.has(key))
      .map(key => 
        c.env.DB.prepare('update site_config set config_value=?, updated_at=? where config_key=?')
          .bind(body[key], now, key)
      )
    
    if (statements.length > 0) {
      await c.env.DB.batch(statements)
    }
    
    logAuditAction(c, 'update', 'site_config', 'batch', JSON.stringify({ keys: Array.from(existingKeys) }))
    
    return c.json({ ok: true, updated: statements.length })
  } catch (error: any) {
    console.error('Error batch updating site config:', error)
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    throw Errors.INTERNAL_ERROR(error.message || '服务器内部错误')
  }
})

// 获取单个配置值（用于内部调用，不隐藏加密值）
export async function getSiteConfigValue(env: Env, key: string): Promise<string | null> {
  const config = await env.DB.prepare('select config_value from site_config where config_key=?')
    .bind(key).first<{ config_value: string | null }>()
  return config?.config_value || null
}

// 获取所有配置值（用于内部调用，不隐藏加密值）
export async function getAllSiteConfig(env: Env): Promise<Record<string, string>> {
  const configs = await env.DB.prepare('select config_key, config_value from site_config')
    .all<{ config_key: string, config_value: string | null }>()
  
  const result: Record<string, string> = {}
  for (const config of configs.results || []) {
    if (config.config_value) {
      result[config.config_key] = config.config_value
    }
  }
  return result
}

export default siteConfigRoutes

