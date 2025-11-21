/**
 * 简单的内存缓存工具（Worker实例级别）
 * 注意：Cloudflare Workers是无状态的，每个请求可能在不同的实例上执行
 * 这个缓存只在单个请求的生命周期内有效，主要用于减少同一请求内的重复查询
 */

// 简单的内存缓存（Map）
const cache = new Map<string, { data: any, expiresAt: number }>()

// 清理过期缓存的间隔（5分钟）
const CLEANUP_INTERVAL = 5 * 60 * 1000
let lastCleanup = Date.now()

/**
 * 清理过期的缓存项
 */
function cleanupExpiredCache() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) {
    return
  }
  
  for (const [key, value] of cache.entries()) {
    if (value.expiresAt < now) {
      cache.delete(key)
    }
  }
  lastCleanup = now
}

/**
 * 获取缓存值
 * @param key 缓存键
 * @returns 缓存值或null
 */
export function getCache<T>(key: string): T | null {
  cleanupExpiredCache()
  const item = cache.get(key)
  if (!item) return null
  if (item.expiresAt < Date.now()) {
    cache.delete(key)
    return null
  }
  return item.data as T
}

/**
 * 设置缓存值
 * @param key 缓存键
 * @param data 缓存数据
 * @param ttl 过期时间（毫秒），默认5分钟
 */
export function setCache<T>(key: string, data: T, ttl: number = 5 * 60 * 1000): void {
  cleanupExpiredCache()
  cache.set(key, {
    data,
    expiresAt: Date.now() + ttl
  })
}

/**
 * 删除缓存
 * @param key 缓存键
 */
export function deleteCache(key: string): void {
  cache.delete(key)
}

/**
 * 清空所有缓存
 */
export function clearCache(): void {
  cache.clear()
}

/**
 * 缓存键生成器
 */
export const cacheKeys = {
  categories: 'categories:all',
  categoriesByKind: (kind: string) => `categories:kind:${kind}`,
  accounts: 'accounts:all',
  departments: 'departments:all',
  currencies: 'currencies:all',
  positions: 'positions:all',
  employees: 'employees:active',
  sites: 'sites:all',
  orgDepartments: 'org_departments:all',
  orgDepartmentsByProject: (projectId: string | null) => `org_departments:project:${projectId || 'hq'}`,
}

