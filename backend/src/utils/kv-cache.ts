import { Logger } from './logger.js'
/**
 * KV 缓存工具
 * 使用 Cloudflare KV 存储热点数据，提供持久化缓存
 * 适用于主数据等变化较少但访问频繁的数据
 */

export interface KVCacheOptions {
  /**
   * KV 命名空间
   */
  kv: KVNamespace
  /**
   * 默认 TTL（秒）
   */
  defaultTTL?: number
}

/**
 * KV 缓存类
 * 使用 Cloudflare KV 实现持久化缓存
 */
export class KVCache {
  private kv: KVNamespace
  private defaultTTL: number

  constructor(options: KVCacheOptions) {
    this.kv = options.kv
    this.defaultTTL = options.defaultTTL || 3600 // 默认1小时
  }

  /**
   * 从 KV 获取数据
   * @param key 缓存键
   * @returns 缓存的数据，如果不存在或已过期则返回 null
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await this.kv.get(key, 'json')
      if (!cached) {
        return null
      }

      // 检查是否过期
      const data = cached as { value: T; expiresAt?: number }
      if (data.expiresAt && data.expiresAt < Date.now()) {
        // 异步删除过期数据
        this.kv.delete(key).catch(() => { })
        return null
      }

      return data.value
    } catch (error) {
      Logger.warn('[KVCache] Get failed:', error)
      return null
    }
  }

  /**
   * 设置 KV 缓存数据
   * @param key 缓存键
   * @param data 要缓存的数据
   * @param ttl 缓存时间（秒），默认使用 defaultTTL
   */
  async set<T>(key: string, data: T, ttl?: number): Promise<void> {
    try {
      const expiresAt = Date.now() + (ttl || this.defaultTTL) * 1000
      const value = {
        value: data,
        expiresAt,
        cachedAt: Date.now(),
      }

      await this.kv.put(key, JSON.stringify(value), {
        expirationTtl: ttl || this.defaultTTL,
      })
    } catch (error) {
      Logger.warn('[KVCache] Set failed:', error)
      // 静默失败，不影响主流程
    }
  }

  /**
   * 删除 KV 缓存
   * @param key 缓存键
   */
  async delete(key: string): Promise<void> {
    try {
      await this.kv.delete(key)
    } catch (error) {
      Logger.warn('[KVCache] Delete failed:', error)
    }
  }

  /**
   * 批量删除缓存（通过前缀）
   * 注意：KV 不支持直接按前缀查询，需要维护键列表
   * 这里提供一个辅助方法，实际使用时需要结合应用层维护键列表
   */
  async deleteByPrefix(prefix: string): Promise<void> {
    try {
      // KV 不支持直接按前缀删除，需要先列出所有键
      // 这里提供一个占位实现，实际使用时需要维护键列表
      Logger.warn('[KVCache] deleteByPrefix requires key tracking, consider maintaining a key list')
    } catch (error) {
      Logger.warn('[KVCache] DeleteByPrefix failed:', error)
    }
  }

  /**
   * 获取多个键的值
   * @param keys 缓存键数组
   * @returns 键值对映射
   */
  async getMany<T>(keys: string[]): Promise<Map<string, T>> {
    const results = new Map<string, T>()

    // 并行获取所有键
    const promises = keys.map(async (key) => {
      const value = await this.get<T>(key)
      if (value !== null) {
        results.set(key, value)
      }
    })

    await Promise.all(promises)
    return results
  }

  /**
   * 批量设置缓存
   * @param entries 键值对数组
   * @param ttl 缓存时间（秒）
   */
  async setMany<T>(entries: Array<{ key: string; value: T }>, ttl?: number): Promise<void> {
    const promises = entries.map(({ key, value }) => this.set(key, value, ttl))
    await Promise.all(promises)
  }
}

/**
 * 创建 KV 缓存实例
 */
export function createKVCache(kv: KVNamespace, defaultTTL?: number): KVCache {
  return new KVCache({ kv, defaultTTL })
}
