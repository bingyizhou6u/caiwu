import type { Env } from '../types.js'
import { Errors } from '../utils/errors.js'
import {
  fetchCloudflareIPListItems,
  addIPToCloudflareList,
  addIPsToCloudflareList,
  removeIPFromCloudflareList,
  removeIPsFromCloudflareList,
  getWhitelistRuleStatus,
  toggleWhitelistRule,
  getOrCreateWhitelistRule,
} from '../utils/cloudflare.js'

export class IPWhitelistService {
  constructor(private env: Env) {}

  async getIPList() {
    const cfItems = await fetchCloudflareIPListItems(this.env)
    return cfItems.map((item, index) => ({
      id: item.id,
      ipAddress: item.ip,
      description: item.comment || `IP whitelist: ${item.ip}`,
      cloudflareRuleId: item.id,
      createdAt: Date.now() - (cfItems.length - index) * 1000,
      updatedAt: Date.now() - (cfItems.length - index) * 1000,
    }))
  }

  async addIP(ip: string, description?: string) {
    // 先在本地检查重复项以避免 API 调用？
    // 但列表是远程的。
    const cfItems = await fetchCloudflareIPListItems(this.env)
    const existed = cfItems.find(item => item.ip === ip)
    if (existed) {
      throw Errors.DUPLICATE('IP地址')
    }

    const result = await addIPToCloudflareList(this.env, ip, description)
    if (!result.success) {
      console.error('Failed to add IP to Cloudflare list:', result.error)
      throw Errors.INTERNAL_ERROR(result.error || '添加IP到Cloudflare列表失败')
    }

    if (!result.itemId) {
      throw Errors.INTERNAL_ERROR('Cloudflare API returned no item ID')
    }

    return {
      id: result.itemId,
      ipAddress: ip,
      description: description || null,
      cloudflareRuleId: result.itemId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
  }

  async batchAddIPs(ips: Array<{ ip: string; description?: string }>) {
    const cfItems = await fetchCloudflareIPListItems(this.env)
    const existingIPs = new Set(cfItems.map(item => item.ip))
    const duplicateIPs = ips.filter(item => existingIPs.has(item.ip))

    if (duplicateIPs.length > 0) {
      throw Errors.BUSINESS_ERROR(
        `IP addresses already exist: ${duplicateIPs.map(item => item.ip).join(', ')}`
      )
    }

    const result = await addIPsToCloudflareList(this.env, ips)

    if (!result.success) {
      throw Errors.INTERNAL_ERROR('Batch add failed', {
        successCount: result.successCount,
        failedCount: result.failedCount,
        errors: result.errors,
      })
    }

    return {
      success: true,
      successCount: result.successCount,
      failedCount: result.failedCount,
      errors: result.errors,
    }
  }

  async batchDeleteIPs(ids: string[]) {
    const result = await removeIPsFromCloudflareList(this.env, ids)

    if (!result.success) {
      throw Errors.INTERNAL_ERROR('Batch delete failed', {
        successCount: result.successCount,
        failedCount: result.failedCount,
      })
    }

    // 获取已删除的 IP 以便记录审计日志（需要在删除前完成，或者由控制器传递？）
    // 控制器调用此方法。如果我想返回已删除的 IP，我应该之前就获取它们。
    // 但在这里我已经删除了它们。
    // 原始代码中的控制器在调用 remove 之前获取了它们。
    // 我会让控制器处理“删除前获取”的逻辑（如果它需要记录详细信息），
    // 或者我可以在这里处理。
    //目前，返回成功统计信息。
    return {
      success: true,
      successCount: result.successCount,
      failedCount: result.failedCount,
    }
  }

  async deleteIP(id: string) {
    const deleted = await removeIPFromCloudflareList(this.env, id)
    if (!deleted) {
      throw Errors.INTERNAL_ERROR('从Cloudflare列表移除IP失败')
    }
    return { ok: true }
  }

  async getRuleStatus() {
    const status = await getWhitelistRuleStatus(this.env)
    return status || { enabled: false }
  }

  async createRule() {
    const result = await getOrCreateWhitelistRule(this.env)
    if (!result) {
      throw Errors.INTERNAL_ERROR('创建规则失败')
    }
    return { ok: true, ruleId: result.ruleId, rulesetId: result.rulesetId }
  }

  async toggleRule(enabled: boolean) {
    const success = await toggleWhitelistRule(this.env, enabled)
    if (!success) {
      throw Errors.INTERNAL_ERROR('切换规则状态失败')
    }
    return { ok: true, enabled }
  }
}
