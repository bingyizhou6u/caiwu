import { Context } from 'hono'
import type { Env, AppVariables } from '../types/index.js'
import { IPWhitelistService } from '../services/system/IPWhitelistService.js'
import { Logger } from '../utils/logger.js'

// Simple in-memory cache for hot workers
let cachedIPs: Set<string> | null = null
let lastCacheTime = 0
const CACHE_TTL = 60 * 1000 // 1 minute
let cachedRuleEnabled: boolean | null = null

export function createIPWhitelistMiddleware() {
  return async (
    c: Context<{ Bindings: Env; Variables: AppVariables }>,
    next: () => Promise<void>
  ) => {
    // 1. Health checks should always be allowed
    if (c.req.path === '/api/health' || c.req.path === '/api/version') {
      return next()
    }

    // 2. Get client IP
    const clientIP = c.req.header('CF-Connecting-IP')
    if (!clientIP) {
      // If missing header (e.g. local dev), allow but log warning
      // In production behind CF, this header should always exist
      return next()
    }

    // Service instantiation (lightweight)
    const service = new IPWhitelistService(c.env)

    try {
      const now = Date.now()

      // Refresh cache if expired
      if (cachedRuleEnabled === null || !cachedIPs || now - lastCacheTime > CACHE_TTL) {
        try {
          // Get Rule Status
          const status = await service.getRuleStatus()
          cachedRuleEnabled = status?.enabled ?? false

          // Get IP List if rule is enabled (or just fetch to keep cache ready)
          // We fetch only if we need to update cache
          const items = await service.getIPList()
          cachedIPs = new Set(items.map((i: any) => i.ipAddress))

          lastCacheTime = now
        } catch (e) {
          Logger.error('Failed to refresh IP whitelist cache', { error: e }, c)
          // 安全策略：如果IP白名单规则已启用但缓存刷新失败，采用 fail-closed 策略（拒绝访问）
          // 这确保在安全控制无法验证时，不会意外允许未授权访问
          if (cachedRuleEnabled === null) {
            // 首次初始化失败：如果无法确定规则状态，默认禁用（fail-safe）
            cachedRuleEnabled = false
            Logger.warn('IP whitelist rule status unknown, defaulting to disabled (fail-safe)', {}, c)
          } else if (cachedRuleEnabled === true) {
            // 规则已启用但缓存刷新失败：使用旧缓存值（如果存在），否则拒绝访问
            if (!cachedIPs || cachedIPs.size === 0) {
              Logger.error(
                'IP whitelist is enabled but cache refresh failed and no stale cache available. Denying access (fail-closed).',
                { error: e },
                c
              )
              return c.json({ error: 'Security check error: Unable to verify IP whitelist' }, 500)
            }
            // 有旧缓存，使用它但记录警告
            Logger.warn(
              'Using stale IP whitelist cache due to refresh failure',
              { cacheAge: now - lastCacheTime },
              c
            )
          }
          // 如果规则已禁用，继续使用禁用状态（安全）
        }
      }

      if (!cachedRuleEnabled) {
        return next()
      }

      // 如果规则已启用，检查IP是否在白名单中
      if (cachedRuleEnabled && cachedIPs) {
        if (!cachedIPs.has(clientIP)) {
          Logger.warn(`Blocked IP: ${clientIP}`, { ip: clientIP }, c)
          return c.json({ error: 'Access denied: IP not whitelisted', ip: clientIP }, 403)
        }
      } else if (cachedRuleEnabled && !cachedIPs) {
        // 规则已启用但没有IP列表（不应该发生，但安全起见）
        Logger.error('IP whitelist is enabled but IP list is missing', {}, c)
        return c.json({ error: 'Security check error: IP whitelist configuration invalid' }, 500)
      }
    } catch (error) {
      Logger.error('IP Whitelist Middleware Error', { error }, c)
      return c.json({ error: 'Security check error' }, 500)
    }

    await next()
  }
}
