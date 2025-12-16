/**
 * 使用 KV 缓存的主数据服务
 * 为主数据查询添加 KV 缓存层，提供持久化缓存
 */

import { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from '../db/schema.js'
import { MasterDataService } from './MasterDataService.js'
import { KVCache, createKVCache } from '../../utils/kv-cache.js'
import { cacheKeys, cacheTTL } from '../../utils/query-cache.js'

export class KVCachedMasterDataService extends MasterDataService {
  private kvCache: KVCache

  constructor(db: DrizzleD1Database<typeof schema>, kv: KVNamespace) {
    super(db)
    this.kvCache = createKVCache(kv, cacheTTL.masterData)
  }

  // ========== Currencies ==========

  async getCurrencies(search?: string) {
    const cacheKey = `kv:${cacheKeys.masterData.currencies(search)}`
    const cached = await this.kvCache.get(cacheKey)
    if (cached) {
      return cached
    }

    const result = await super.getCurrencies(search)
    await this.kvCache.set(cacheKey, result, cacheTTL.masterData)
    return result
  }

  // ========== Departments ==========

  async getDepartments() {
    const cacheKey = `kv:${cacheKeys.masterData.departments()}`
    const cached = await this.kvCache.get(cacheKey)
    if (cached) {
      return cached
    }

    const result = await super.getDepartments()
    await this.kvCache.set(cacheKey, result, cacheTTL.masterData)
    return result
  }

  // ========== Sites ==========

  async getSites() {
    const cacheKey = `kv:${cacheKeys.masterData.sites()}`
    const cached = await this.kvCache.get(cacheKey)
    if (cached) {
      return cached
    }

    const result = await super.getSites()
    await this.kvCache.set(cacheKey, result, cacheTTL.masterData)
    return result
  }

  // ========== Categories ==========

  async getCategories() {
    const cacheKey = `kv:${cacheKeys.masterData.categories()}`
    const cached = await this.kvCache.get(cacheKey)
    if (cached) {
      return cached
    }

    const result = await super.getCategories()
    await this.kvCache.set(cacheKey, result, cacheTTL.masterData)
    return result
  }

  // ========== Vendors ==========

  async getVendors() {
    const cacheKey = `kv:${cacheKeys.masterData.vendors()}`
    const cached = await this.kvCache.get(cacheKey)
    if (cached) {
      return cached
    }

    const result = await super.getVendors()
    await this.kvCache.set(cacheKey, result, cacheTTL.masterData)
    return result
  }

  // ========== Accounts ==========

  async getAccounts(search?: string) {
    const cacheKey = `kv:${cacheKeys.masterData.accounts()}${search ? `:search:${search}` : ''}`
    const cached = await this.kvCache.get(cacheKey)
    if (cached) {
      return cached
    }

    const result = await super.getAccounts(search)
    await this.kvCache.set(cacheKey, result, cacheTTL.masterData)
    return result
  }

  // ========== Headquarters ==========

  async getHeadquarters() {
    const cacheKey = `kv:${cacheKeys.masterData.headquarters()}`
    const cached = await this.kvCache.get(cacheKey)
    if (cached) {
      return cached
    }

    const result = await super.getHeadquarters()
    await this.kvCache.set(cacheKey, result, cacheTTL.masterData)
    return result
  }

  // ========== Positions ==========

  async getPositions() {
    const cacheKey = `kv:${cacheKeys.business.positions()}`
    const cached = await this.kvCache.get(cacheKey)
    if (cached) {
      return cached
    }

    const result = await super.getPositions()
    await this.kvCache.set(cacheKey, result, cacheTTL.business)
    return result
  }

  /**
   * 使主数据缓存失效
   * 在创建/更新/删除主数据后调用
   */
  async invalidateMasterDataCache() {
    const keys = [
      `kv:${cacheKeys.masterData.currencies()}`,
      `kv:${cacheKeys.masterData.departments()}`,
      `kv:${cacheKeys.masterData.sites()}`,
      `kv:${cacheKeys.masterData.categories()}`,
      `kv:${cacheKeys.masterData.vendors()}`,
      `kv:${cacheKeys.masterData.accounts()}`,
      `kv:${cacheKeys.masterData.headquarters()}`,
      `kv:${cacheKeys.business.positions()}`,
    ]

    await Promise.all(keys.map((key) => this.kvCache.delete(key)))
  }
}
