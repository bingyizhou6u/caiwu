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
    getOrCreateWhitelistRule
} from '../utils/cloudflare.js'

export class IPWhitelistService {
    constructor(private env: Env) { }

    async getIPList() {
        const cfItems = await fetchCloudflareIPListItems(this.env)
        return cfItems.map((item, index) => ({
            id: item.id,
            ip_address: item.ip,
            description: item.comment || `IP whitelist: ${item.ip}`,
            cloudflare_rule_id: item.id,
            created_at: Date.now() - (cfItems.length - index) * 1000,
            updated_at: Date.now() - (cfItems.length - index) * 1000,
        }))
    }

    async addIP(ip: string, description?: string) {
        // Check for duplicates locally first to avoid API call if possible?
        // But the list is remote.
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
            ip_address: ip,
            description: description || null,
            cloudflare_rule_id: result.itemId,
            created_at: Date.now(),
            updated_at: Date.now(),
        }
    }

    async batchAddIPs(ips: Array<{ ip: string, description?: string }>) {
        const cfItems = await fetchCloudflareIPListItems(this.env)
        const existingIPs = new Set(cfItems.map(item => item.ip))
        const duplicateIPs = ips.filter(item => existingIPs.has(item.ip))

        if (duplicateIPs.length > 0) {
            throw Errors.BUSINESS_ERROR(`IP addresses already exist: ${duplicateIPs.map(item => item.ip).join(', ')}`)
        }

        const result = await addIPsToCloudflareList(this.env, ips)

        if (!result.success) {
            throw Errors.INTERNAL_ERROR('Batch add failed', {
                successCount: result.successCount,
                failedCount: result.failedCount,
                errors: result.errors
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
                failedCount: result.failedCount
            })
        }

        // Get deleted IPs for audit log (needs to be done before deletion or passed from controller? 
        // Controller calls this method. If I want to return deleted IPs, I should have fetched them before.
        // But here I already deleted them.
        // The controller in original code fetched them before calling remove.
        // I will let the controller handle the "fetching before delete" if it needs to log details, 
        // or I can do it here.
        // For now, return success stats.
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
