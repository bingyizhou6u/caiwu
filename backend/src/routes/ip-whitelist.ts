import { Hono } from 'hono'
import type { Env, AppVariables } from '../types.js'
import { hasPermission } from '../utils/permissions.js'
import { logAudit, logAuditAction } from '../utils/audit.js'
import { getUserByEmail } from '../utils/db.js'
import { SystemService } from '../services/SystemService.js'
import { Errors } from '../utils/errors.js'
import { validateJson, getValidatedData } from '../utils/validator.js'
import { isValidIPAddress } from '../utils/validation.js'
import { createIPWhitelistSchema, batchCreateIPWhitelistSchema, batchDeleteIPWhitelistSchema, toggleIPWhitelistRuleSchema } from '../schemas/business.schema.js'
import type { z } from 'zod'
import {
  addIPToCloudflareList,
  removeIPFromCloudflareList,
  addIPsToCloudflareList,
  removeIPsFromCloudflareList,
  fetchCloudflareIPListItems,
  getWhitelistRuleStatus,
  getOrCreateWhitelistRule,
  toggleWhitelistRule
} from '../utils/cloudflare.js'

export const ip_whitelistRoutes = new Hono<{ Bindings: Env, Variables: AppVariables }>()

ip_whitelistRoutes.get('/ip-whitelist', async (c) => {
  if (!hasPermission(c, 'system', 'config', 'update')) throw Errors.FORBIDDEN()

  // 直接从 Cloudflare 拉取 IP 列表
  const cfItems = await fetchCloudflareIPListItems(c.env)

  // 转换为前端需要的格式
  const items = cfItems.map((item, index) => ({
    id: item.id, // 使用 Cloudflare 的 item ID
    ip_address: item.ip,
    description: item.comment || `IP whitelist: ${item.ip}`,
    cloudflare_rule_id: item.id,
    created_at: Date.now() - (cfItems.length - index) * 1000, // 模拟创建时间，按顺序递减
    updated_at: Date.now() - (cfItems.length - index) * 1000,
  }))

  return c.json(items)
})

// IP 白名单管理 - 创建

ip_whitelistRoutes.post('/ip-whitelist', validateJson(createIPWhitelistSchema), async (c) => {
  if (!hasPermission(c, 'system', 'config', 'update')) throw Errors.FORBIDDEN()

  try {
    const body = getValidatedData<z.infer<typeof createIPWhitelistSchema>>(c)

    // 验证 IP 地址格式（支持 IPv4 和 IPv6）
    if (!isValidIPAddress(body.ip_address)) {
      throw Errors.VALIDATION_ERROR('无效的IP地址格式（需要IPv4或IPv6）')
    }

    // 检查 Cloudflare 中是否已存在
    const cfItems = await fetchCloudflareIPListItems(c.env)
    const existed = cfItems.find(item => item.ip === body.ip_address)
    if (existed) {
      throw Errors.DUPLICATE('IP地址')
    }

    // 添加到 Cloudflare IP List
    const result = await addIPToCloudflareList(c.env, body.ip_address, body.description)
    if (!result.success) {
      console.error('Failed to add IP to Cloudflare list:', result.error)
      if (result && typeof result === 'object' && 'statusCode' in result) throw result
      throw Errors.INTERNAL_ERROR(result.error || '添加IP到Cloudflare列表失败')
    }

    // 返回 Cloudflare 的实际数据
    const now = Date.now()
    logAuditAction(c, 'create', 'ip_whitelist', result.itemId || '', JSON.stringify({ ip_address: body.ip_address }))

    return c.json({
      id: result.itemId,
      ip_address: body.ip_address,
      description: body.description || null,
      cloudflare_rule_id: result.itemId,
      created_at: now,
      updated_at: now,
    })
  } catch (error: any) {
    console.error('Error creating IP whitelist:', error)
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    throw Errors.INTERNAL_ERROR(error.message || '服务器内部错误')
  }
})

// IP 白名单管理 - 批量添加（必须在动态路由之前定义）

ip_whitelistRoutes.post('/ip-whitelist/batch', validateJson(batchCreateIPWhitelistSchema), async (c) => {
  if (!hasPermission(c, 'system', 'config', 'update')) throw Errors.FORBIDDEN()

  try {
    const body = getValidatedData<z.infer<typeof batchCreateIPWhitelistSchema>>(c)

    // 验证所有 IP 地址格式
    const invalidIPs: string[] = []
    for (const item of body.ips) {
      if (!item.ip || !isValidIPAddress(item.ip)) {
        invalidIPs.push(item.ip || 'empty')
      }
    }

    if (invalidIPs.length > 0) {
      throw Errors.VALIDATION_ERROR(`无效的IP地址: ${invalidIPs.join(', ')}`)
    }

    // 检查 Cloudflare 中是否已存在
    const cfItems = await fetchCloudflareIPListItems(c.env)
    const existingIPs = new Set(cfItems.map(item => item.ip))
    const duplicateIPs = body.ips.filter(item => existingIPs.has(item.ip))

    if (duplicateIPs.length > 0) {
      return c.json({
        error: `IP addresses already exist: ${duplicateIPs.map(item => item.ip).join(', ')}`
      }, 409)
    }

    // 批量添加到 Cloudflare IP List
    const result = await addIPsToCloudflareList(c.env, body.ips)

    if (!result.success) {
      return c.json({
        error: 'Batch add failed',
        successCount: result.successCount,
        failedCount: result.failedCount,
        errors: result.errors
      }, 500)
    }

    logAuditAction(c, 'batch_create', 'ip_whitelist', '', JSON.stringify({
      count: body.ips.length,
      successCount: result.successCount,
      failedCount: result.failedCount
    }))

    return c.json({
      success: true,
      successCount: result.successCount,
      failedCount: result.failedCount,
      errors: result.errors,
    })
  } catch (error: any) {
    console.error('Error batch adding IP whitelist:', error)
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    throw Errors.INTERNAL_ERROR(error.message || '服务器内部错误')
  }
})

// IP 白名单管理 - 批量删除（必须在动态路由之前定义）

ip_whitelistRoutes.delete('/ip-whitelist/batch', validateJson(batchDeleteIPWhitelistSchema), async (c) => {
  if (!hasPermission(c, 'system', 'config', 'update')) throw Errors.FORBIDDEN()

  try {
    const body = getValidatedData<z.infer<typeof batchDeleteIPWhitelistSchema>>(c)

    // 批量从 Cloudflare IP List 删除
    const result = await removeIPsFromCloudflareList(c.env, body.ids)

    if (!result.success) {
      return c.json({
        error: 'Batch delete failed',
        successCount: result.successCount,
        failedCount: result.failedCount
      }, 500)
    }

    // 获取删除的 IP 地址用于审计日志
    const cfItems = await fetchCloudflareIPListItems(c.env)
    const deletedIPs = body.ids
      .map(id => {
        const item = cfItems.find(i => i.id === id)
        return item ? item.ip : id
      })
      .filter(Boolean)

    logAuditAction(c, 'batch_delete', 'ip_whitelist', '', JSON.stringify({
      count: body.ids.length,
      successCount: result.successCount,
      failedCount: result.failedCount,
      deletedIPs
    }))

    return c.json({
      success: true,
      successCount: result.successCount,
      failedCount: result.failedCount,
    })
  } catch (error: any) {
    console.error('Error batch deleting IP whitelist:', error)
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    throw Errors.INTERNAL_ERROR(error.message || '服务器内部错误')
  }
})

// IP 白名单管理 - 从 Cloudflare 同步

ip_whitelistRoutes.post('/ip-whitelist/sync', async (c) => {
  if (!hasPermission(c, 'system', 'config', 'update')) throw Errors.FORBIDDEN()

  // 直接从 Cloudflare 拉取 IP 列表（不再同步到数据库）
  const cfItems = await fetchCloudflareIPListItems(c.env)

  logAuditAction(c, 'sync', 'ip_whitelist', '', JSON.stringify({ count: cfItems.length }))
  return c.json({ message: 'sync completed', synced: cfItems.length })
})

// IP 白名单管理 - 删除（动态路由，必须在批量路由之后定义）

ip_whitelistRoutes.delete('/ip-whitelist/:id', async (c) => {
  if (!hasPermission(c, 'system', 'config', 'update')) throw Errors.FORBIDDEN()
  const itemId = c.req.param('id') // itemId 是 Cloudflare 的 item ID

  // 先获取 IP 地址用于审计日志
  const cfItems = await fetchCloudflareIPListItems(c.env)
  const item = cfItems.find(i => i.id === itemId)
  if (!item) {
    throw Errors.NOT_FOUND()
  }

  // 从 Cloudflare IP List 删除
  const deleted = await removeIPFromCloudflareList(c.env, itemId)
  if (!deleted) {
    throw Errors.INTERNAL_ERROR('从Cloudflare列表移除IP失败')
  }

  logAuditAction(c, 'delete', 'ip_whitelist', itemId, JSON.stringify({ ip_address: item.ip }))
  return c.json({ ok: true })
})

// IP 白名单规则管理 - 获取规则状态（会自动创建）

ip_whitelistRoutes.get('/ip-whitelist/rule', async (c) => {
  if (!hasPermission(c, 'system', 'config', 'update')) throw Errors.FORBIDDEN()
  const status = await getWhitelistRuleStatus(c.env)
  return c.json(status || { enabled: false })
})

// IP 白名单规则管理 - 创建规则（已废弃，通过 GET /api/ip-whitelist/rule 自动创建）

ip_whitelistRoutes.post('/ip-whitelist/rule/create', async (c) => {
  if (!hasPermission(c, 'system', 'config', 'update')) throw Errors.FORBIDDEN()

  const result = await getOrCreateWhitelistRule(c.env)
  if (!result) {
    throw Errors.INTERNAL_ERROR('创建规则失败')
  }

  logAuditAction(c, 'create', 'ip_whitelist_rule', result.ruleId, JSON.stringify({ ruleId: result.ruleId, rulesetId: result.rulesetId }))
  return c.json({ ok: true, ruleId: result.ruleId, rulesetId: result.rulesetId })
})

// IP 白名单规则管理 - 启用/停用规则

ip_whitelistRoutes.post('/ip-whitelist/rule/toggle', validateJson(toggleIPWhitelistRuleSchema), async (c) => {
  if (!hasPermission(c, 'system', 'config', 'update')) throw Errors.FORBIDDEN()

  try {
    const body = getValidatedData<z.infer<typeof toggleIPWhitelistRuleSchema>>(c)

    const success = await toggleWhitelistRule(c.env, body.enabled)
    if (!success) {
      console.error('toggleWhitelistRule returned false for enabled:', body.enabled)
      throw Errors.INTERNAL_ERROR('切换规则状态失败')
    }

    logAuditAction(c, 'update', 'ip_whitelist_rule', '', JSON.stringify({ enabled: body.enabled }))
    return c.json({ ok: true, enabled: body.enabled })
  } catch (error: any) {
    console.error('Error in toggle endpoint:', error)
    console.error('Error stack:', error?.stack)
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    throw Errors.INTERNAL_ERROR(error?.message || '服务器内部错误')
  }
})

// Audit logs (manager only)
