/**
 * 使用 KV 缓存的主数据服务
 * 为主数据查询添加 KV 缓存层，提供持久化缓存
 */

import { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from '../../db/schema.js'
import { MasterDataService } from './MasterDataService.js'
import { KVCache, createKVCache } from '../../utils/kv-cache.js'
import { cacheKeys, cacheTTL } from '../../utils/query-cache.js'

export class KVCachedMasterDataService extends MasterDataService {
  private kvCache: KVCache
  private cacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
  }

  constructor(db: DrizzleD1Database<typeof schema>, kv: KVNamespace) {
    super(db)
    this.kvCache = createKVCache(kv, cacheTTL.masterData)
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats() {
    const total = this.cacheStats.hits + this.cacheStats.misses
    return {
      hits: this.cacheStats.hits,
      misses: this.cacheStats.misses,
      sets: this.cacheStats.sets,
      hitRate: total > 0 ? (this.cacheStats.hits / total) * 100 : 0,
      total,
    }
  }

  /**
   * 重置缓存统计
   */
  resetCacheStats() {
    this.cacheStats = { hits: 0, misses: 0, sets: 0 }
  }

  // ========== Currencies ==========

  async getCurrencies(search?: string) {
    const cacheKey = `kv:${cacheKeys.masterData.currencies(search)}`
    const cached = await this.kvCache.get(cacheKey)
    if (cached) {
      this.cacheStats.hits++
      return cached as any
    }

    this.cacheStats.misses++
    const result = await super.getCurrencies(search)
    await this.kvCache.set(cacheKey, result, cacheTTL.masterData)
    this.cacheStats.sets++
    return result
  }

  // ========== Departments ==========

  async getDepartments() {
    const cacheKey = `kv:${cacheKeys.masterData.departments()}`
    const cached = await this.kvCache.get(cacheKey)
    if (cached) {
      this.cacheStats.hits++
      return cached as any
    }

    this.cacheStats.misses++
    const result = await super.getDepartments()
    await this.kvCache.set(cacheKey, result, cacheTTL.masterData)
    this.cacheStats.sets++
    return result
  }

  // ========== Sites ==========

  async getSites() {
    const cacheKey = `kv:${cacheKeys.masterData.sites()}`
    const cached = await this.kvCache.get(cacheKey)
    if (cached) {
      this.cacheStats.hits++
      return cached as any
    }

    this.cacheStats.misses++
    const result = await super.getSites()
    await this.kvCache.set(cacheKey, result, cacheTTL.masterData)
    this.cacheStats.sets++
    return result
  }

  // ========== Categories ==========

  async getCategories() {
    const cacheKey = `kv:${cacheKeys.masterData.categories()}`
    const cached = await this.kvCache.get(cacheKey)
    if (cached) {
      this.cacheStats.hits++
      return cached as any
    }

    this.cacheStats.misses++
    const result = await super.getCategories()
    await this.kvCache.set(cacheKey, result, cacheTTL.masterData)
    this.cacheStats.sets++
    return result
  }

  // ========== Vendors ==========

  async getVendors() {
    const cacheKey = `kv:${cacheKeys.masterData.vendors()}`
    const cached = await this.kvCache.get(cacheKey)
    if (cached) {
      this.cacheStats.hits++
      return cached as any
    }

    this.cacheStats.misses++
    const result = await super.getVendors()
    await this.kvCache.set(cacheKey, result, cacheTTL.masterData)
    this.cacheStats.sets++
    return result
  }

  // ========== Accounts ==========

  async getAccounts(search?: string) {
    const cacheKey = `kv:${cacheKeys.masterData.accounts(search)}`
    const cached = await this.kvCache.get(cacheKey)
    if (cached) {
      this.cacheStats.hits++
      return cached as any
    }

    this.cacheStats.misses++
    const result = await super.getAccounts(search)
    await this.kvCache.set(cacheKey, result, cacheTTL.masterData)
    this.cacheStats.sets++
    return result
  }

  // ========== Headquarters ==========

  async getHeadquarters() {
    const cacheKey = `kv:${cacheKeys.masterData.headquarters()}`
    const cached = await this.kvCache.get(cacheKey)
    if (cached) {
      this.cacheStats.hits++
      return cached as any
    }

    this.cacheStats.misses++
    const result = await super.getHeadquarters()
    await this.kvCache.set(cacheKey, result, cacheTTL.masterData)
    this.cacheStats.sets++
    return result
  }

  // ========== Positions ==========

  async getPositions() {
    const cacheKey = `kv:${cacheKeys.business.positions()}`
    const cached = await this.kvCache.get(cacheKey)
    if (cached) {
      this.cacheStats.hits++
      return cached as any
    }

    this.cacheStats.misses++
    const result = await super.getPositions()
    await this.kvCache.set(cacheKey, result, cacheTTL.business)
    this.cacheStats.sets++
    return result
  }

  // ========== Departments ==========

  async createDepartment(data: { name: string; hqId?: string; code?: string }) {
    const result = await super.createDepartment(data)
    await this.invalidateMasterDataCache()
    return result
  }

  async updateDepartment(id: string, data: { name?: string; hqId?: string; active?: number }) {
    const result = await super.updateDepartment(id, data)
    await this.invalidateMasterDataCache()
    return result
  }

  async deleteDepartment(id: string) {
    const result = await super.deleteDepartment(id)
    await this.invalidateMasterDataCache()
    return result
  }

  // ========== Sites ==========

  async createSite(data: { name: string; departmentId: string }) {
    const result = await super.createSite(data)
    await this.invalidateMasterDataCache()
    return result
  }

  async updateSite(id: string, data: { name?: string; departmentId?: string; active?: number }) {
    const result = await super.updateSite(id, data)
    await this.invalidateMasterDataCache()
    return result
  }

  async deleteSite(id: string) {
    const result = await super.deleteSite(id)
    await this.invalidateMasterDataCache()
    return result
  }

  // ========== Accounts ==========

  async createAccount(data: {
    name: string
    type: string
    currency?: string
    alias?: string
    accountNumber?: string
    openingCents?: number
  }) {
    const result = await super.createAccount(data)
    await this.invalidateMasterDataCache()
    return result
  }

  async updateAccount(
    id: string,
    data: {
      name?: string
      type?: string
      currency?: string
      alias?: string
      accountNumber?: string
      active?: number
    }
  ) {
    const result = await super.updateAccount(id, data)
    await this.invalidateMasterDataCache()
    return result
  }

  async deleteAccount(id: string) {
    const result = await super.deleteAccount(id)
    await this.invalidateMasterDataCache()
    return result
  }

  // ========== Vendors ==========

  async createVendor(data: {
    name: string
    contact?: string
    phone?: string
    email?: string
    address?: string
    memo?: string
  }) {
    const result = await super.createVendor(data)
    await this.invalidateMasterDataCache()
    return result
  }

  async updateVendor(
    id: string,
    data: {
      name?: string
      contact?: string
      phone?: string
      email?: string
      address?: string
      memo?: string
      active?: number
    }
  ) {
    const result = await super.updateVendor(id, data)
    await this.invalidateMasterDataCache()
    return result
  }

  async deleteVendor(id: string) {
    const result = await super.deleteVendor(id)
    await this.invalidateMasterDataCache()
    return result
  }

  // ========== Currencies ==========

  async createCurrency(data: { code: string; name: string }) {
    const result = await super.createCurrency(data)
    await this.invalidateMasterDataCache()
    return result
  }

  async updateCurrency(code: string, data: { name?: string; active?: number }) {
    const result = await super.updateCurrency(code, data)
    await this.invalidateMasterDataCache()
    return result
  }

  async deleteCurrency(code: string) {
    const result = await super.deleteCurrency(code)
    await this.invalidateMasterDataCache()
    return result
  }

  // ========== Categories ==========

  async createCategory(data: { name: string; kind: string; parentId?: string }) {
    const result = await super.createCategory(data)
    await this.invalidateMasterDataCache()
    return result
  }

  async updateCategory(id: string, data: { name?: string; kind?: string }) {
    const result = await super.updateCategory(id, data)
    await this.invalidateMasterDataCache()
    return result
  }

  async deleteCategory(id: string) {
    const result = await super.deleteCategory(id)
    await this.invalidateMasterDataCache()
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
