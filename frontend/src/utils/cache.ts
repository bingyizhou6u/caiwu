/**
 * 数据缓存工具
 * 减少重复请求，提升性能
 */

interface CacheItem<T> {
  data: T
  timestamp: number
}

class DataCache {
  private cache = new Map<string, CacheItem<any>>()
  private defaultTTL = 5 * 60 * 1000 // 5分钟默认过期时间

  /**
   * 获取缓存数据
   */
  get<T>(key: string): T | null {
    const item = this.cache.get(key)
    if (!item) return null
    
    // 检查是否过期（使用默认TTL）
    if (Date.now() - item.timestamp > this.defaultTTL) {
      this.cache.delete(key)
      return null
    }
    
    return item.data as T
  }

  /**
   * 设置缓存数据
   */
  set<T>(key: string, data: T, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    })
    
    // 如果指定了TTL，设置过期清理
    if (ttl) {
      setTimeout(() => {
        this.cache.delete(key)
      }, ttl)
    }
  }

  /**
   * 删除缓存
   */
  delete(key: string): void {
    this.cache.delete(key)
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * 使特定前缀的缓存失效
   */
  invalidatePrefix(prefix: string): void {
    const keysToDelete: string[] = []
    this.cache.forEach((_, key) => {
      if (key.startsWith(prefix)) {
        keysToDelete.push(key)
      }
    })
    keysToDelete.forEach(key => this.cache.delete(key))
  }
}

// 单例实例
export const dataCache = new DataCache()

/**
 * 带缓存的请求函数
 */
export async function cachedRequest<T>(
  key: string,
  requestFn: () => Promise<T>,
  ttl?: number
): Promise<T> {
  // 先检查缓存
  const cached = dataCache.get<T>(key)
  if (cached !== null) {
    return cached
  }

  // 执行请求
  const data = await requestFn()
  
  // 缓存结果
  dataCache.set(key, data, ttl)
  
  return data
}

/**
 * 缓存键生成器
 */
export const cacheKeys = {
  currencies: 'currencies',
  departments: 'departments',
  accounts: 'accounts',
  expenseCategories: 'expense_categories',
  incomeCategories: 'income_categories',
  employees: (activeOnly?: boolean) => `employees${activeOnly ? '_active' : ''}`,
  sites: 'sites',
  vendors: 'vendors',
  rentalProperties: (params?: string) => `rental_properties${params ? `_${params}` : ''}`,
  rentalPayableBills: (status?: string) => `rental_payable_bills${status ? `_${status}` : ''}`,
}

