import { Context } from 'hono'
import type { Env, AppVariables } from '../types.js'
import { IPWhitelistService } from '../services/IPWhitelistService.js'
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
          // If cache is missing (first run failed), we might have to fail open or closed.
          // Here we choose to fail open (allow) if we can't check, but log it.
          // OR best effort: if we have stale cache, use it?
          // Current logic: if refresh fails, we keep old cache values if they exist.
          // If no cache, we might error out.
          if (cachedRuleEnabled === null) {cachedRuleEnabled = false} // Default to disabled if init fails
        }
      }

      if (!cachedRuleEnabled) {
        return next()
      }

      if (cachedIPs && !cachedIPs.has(clientIP)) {
        Logger.warn(`Blocked IP: ${clientIP}`, { ip: clientIP }, c)
        return c.json({ error: 'Access denied: IP not whitelisted', ip: clientIP }, 403)
      }
    } catch (error) {
      Logger.error('IP Whitelist Middleware Error', { error }, c)
      return c.json({ error: 'Security check error' }, 500)
    }

    await next()
  }
}
