/**
 * 带缓存的主数据服务（装饰器模式）
 * 为主数据查询添加缓存层，减少数据库查询
 */

import { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from '../db/schema.js'
import { MasterDataService } from './MasterDataService.js'
import { QueryCache, cacheKeys, cacheTTL, createQueryCache } from '../../utils/query-cache.js'

export class CachedMasterDataService extends MasterDataService {
  private cache: QueryCache

  constructor(db: DrizzleD1Database<typeof schema>, cache?: QueryCache) {
    super(db)
    this.cache = cache || createQueryCache()
  }

  // ========== Currencies ==========

  async getCurrencies(search?: string) {
    const cacheKey = cacheKeys.masterData.currencies(search)
    const cached = await this.cache.get(cacheKey)
    if (cached) {
      return cached
    }

    const result = await super.getCurrencies(search)
    await this.cache.set(cacheKey, result, cacheTTL.masterData)
    return result
  }

  // ========== Departments ==========

  async getDepartments() {
    const cacheKey = cacheKeys.masterData.departments()
    const cached = await this.cache.get(cacheKey)
    if (cached) {
      return cached
    }

    const result = await super.getDepartments()
    await this.cache.set(cacheKey, result, cacheTTL.masterData)
    return result
  }

  // ========== Sites ==========

  async getSites() {
    const cacheKey = cacheKeys.masterData.sites()
    const cached = await this.cache.get(cacheKey)
    if (cached) {
      return cached
    }

    const result = await super.getSites()
    await this.cache.set(cacheKey, result, cacheTTL.masterData)
    return result
  }

  // ========== Categories ==========

  async getCategories() {
    const cacheKey = cacheKeys.masterData.categories()
    const cached = await this.cache.get(cacheKey)
    if (cached) {
      return cached
    }

    const result = await super.getCategories()
    await this.cache.set(cacheKey, result, cacheTTL.masterData)
    return result
  }

  // ========== Vendors ==========

  async getVendors(search?: string) {
    const cacheKey = cacheKeys.masterData.vendors(search)
    const cached = await this.cache.get(cacheKey)
    if (cached) {
      return cached
    }

    const result = await super.getVendors(search)
    await this.cache.set(cacheKey, result, cacheTTL.masterData)
    return result
  }

  // ========== Accounts ==========

  async getAccounts() {
    const cacheKey = cacheKeys.masterData.accounts()
    const cached = await this.cache.get(cacheKey)
    if (cached) {
      return cached
    }

    const result = await super.getAccounts()
    await this.cache.set(cacheKey, result, cacheTTL.masterData)
    return result
  }

  // ========== Headquarters ==========

  async getHeadquarters() {
    const cacheKey = cacheKeys.masterData.headquarters()
    const cached = await this.cache.get(cacheKey)
    if (cached) {
      return cached
    }

    const result = await super.getHeadquarters()
    await this.cache.set(cacheKey, result, cacheTTL.masterData)
    return result
  }

  /**
   * 使主数据缓存失效
   * 在创建/更新/删除主数据后调用
   */
  async invalidateMasterDataCache() {
    // 使所有主数据缓存失效
    await Promise.all([
      this.cache.delete(cacheKeys.masterData.currencies()),
      this.cache.delete(cacheKeys.masterData.departments()),
      this.cache.delete(cacheKeys.masterData.sites()),
      this.cache.delete(cacheKeys.masterData.categories()),
      this.cache.delete(cacheKeys.masterData.vendors()),
      this.cache.delete(cacheKeys.masterData.accounts()),
      this.cache.delete(cacheKeys.masterData.headquarters()),
    ])
  }
}
