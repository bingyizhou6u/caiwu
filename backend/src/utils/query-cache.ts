/**
 * 数据库查询缓存工具
 * 使用 Cloudflare Cache API 缓存数据库查询结果，减少数据库负载
 */
import { Logger } from './logger.js'

/**
 * 查询缓存类
 * 使用 Cloudflare Cache API 实现查询结果缓存
 */
export class QueryCache {
  /**
   * 从缓存获取数据
   * @param key 缓存键
   * @returns 缓存的数据，如果不存在则返回 null
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      // 使用 Cloudflare Cache API
      const cache = typeof caches !== 'undefined' ? caches.default : null
      if (!cache) { return null }

      const request = new Request(`https://cache.local/${key}`)
      const cached = await cache.match(request)

      if (cached) {
        const data = await cached.json()
        return data as T
      }

      return null
    } catch {
      // 如果缓存不可用（如测试环境），返回 null
      return null
    }
  }

  /**
   * 设置缓存数据
   * @param key 缓存键
   * @param data 要缓存的数据
   * @param ttl 缓存时间（秒），默认 300 秒（5分钟）
   */
  async set<T>(key: string, data: T, ttl: number = 300): Promise<void> {
    try {
      const cache = typeof caches !== 'undefined' ? caches.default : null
      if (!cache) { return }

      const request = new Request(`https://cache.local/${key}`)

      // 创建响应对象，设置缓存头
      const response = new Response(JSON.stringify(data), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': `public, max-age=${ttl}`,
        },
      })

      // 使用 waitUntil 确保缓存操作不阻塞请求
      // 注意：在 Workers 环境中，需要使用 executionCtx.waitUntil
      await cache.put(request, response)
    } catch (error) {
      // 如果缓存不可用，静默失败，不影响主流程
      Logger.warn('[QueryCache] Cache set failed', { error })
    }
  }

  /**
   * 删除缓存
   * @param key 缓存键
   */
  async delete(key: string): Promise<void> {
    try {
      const cache = typeof caches !== 'undefined' ? caches.default : null
      if (!cache) { return }

      const request = new Request(`https://cache.local/${key}`)
      await cache.delete(request)
    } catch {
      // 如果缓存不可用，静默失败
    }
  }

  /**
   * 使特定前缀的缓存失效
   * @param _prefix 缓存键前缀
   */
  async invalidatePrefix(_prefix: string): Promise<void> {
    // Cloudflare Cache API 不支持按前缀删除
    // 需要在应用层面维护缓存键列表，或使用 KV 存储缓存键
    // 这里提供一个占位实现，实际使用时需要结合 KV 或内存存储
    Logger.warn('[QueryCache] invalidatePrefix not fully supported, consider using KV for key tracking')
  }
}

/**
 * 缓存键生成器
 * 统一管理缓存键的生成规则
 */
export const cacheKeys = {
  /**
   * 主数据缓存键
   */
  masterData: {
    currencies: (search?: string) => `master-data:currencies${search ? `:search:${search}` : ''}`,
    departments: () => 'master-data:departments',
    sites: () => 'master-data:sites',
    categories: () => 'master-data:categories',
    vendors: (search?: string) => `master-data:vendors${search ? `:search:${search}` : ''}`,
    accounts: (search?: string) => `master-data:accounts${search ? `:search:${search}` : ''}`,
    headquarters: () => 'master-data:headquarters',
  },

  /**
   * 业务数据缓存键
   */
  business: {
    employees: (filters?: string) => `business:employees${filters ? `:${filters}` : ''}`,
    positions: () => 'business:positions',
  },

  /**
   * 报表数据缓存键
   */
  reports: {
    dashboard: (userId: string) => `reports:dashboard:${userId}`,
    summary: (params: string) => `reports:summary:${params}`,
  },
}

/**
 * 缓存时间配置（秒）
 */
export const cacheTTL = {
  // 主数据：变化极少，缓存1小时
  masterData: 3600,
  // 业务数据：变化较少，缓存30分钟
  business: 1800,
  // 交易数据：变化频繁，缓存5分钟
  transaction: 300,
  // 报表数据：允许一定延迟，缓存10分钟
  report: 600,
}

/**
 * 创建查询缓存实例
 * 注意：在 Cloudflare Workers 环境中，Cache API 通过全局 caches 对象访问
 */
export function createQueryCache(): QueryCache {
  return new QueryCache()
}
