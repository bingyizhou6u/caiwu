/**
 * 主数据服务（门面模式）
 * 委托给具体的主数据服务类
 */

import { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from '../../db/schema.js'
import { ProjectDepartmentService } from './ProjectDepartmentService.js'
import { SiteService } from './SiteService.js'
import { AccountService } from '../finance/AccountService.js'
import { VendorService } from './VendorService.js'
import { CategoryService } from './CategoryService.js'
import { CurrencyService } from './CurrencyService.js'
import { HeadquartersService } from './HeadquartersService.js'
import { PositionService } from '../hr/PositionService.js'
import { OrgDepartmentService } from './OrgDepartmentService.js'

export class MasterDataService {
  private projectDepartmentService: ProjectDepartmentService
  private siteService: SiteService
  private accountService: AccountService
  private vendorService: VendorService
  private categoryService: CategoryService
  private currencyService: CurrencyService
  private headquartersService: HeadquartersService
  private positionService: PositionService
  private orgDepartmentService: OrgDepartmentService

  constructor(db: DrizzleD1Database<typeof schema>) {
    this.projectDepartmentService = new ProjectDepartmentService(db)
    this.siteService = new SiteService(db)
    this.accountService = new AccountService(db)
    this.vendorService = new VendorService(db)
    this.categoryService = new CategoryService(db)
    this.currencyService = new CurrencyService(db)
    this.headquartersService = new HeadquartersService(db)
    this.positionService = new PositionService(db)
    this.orgDepartmentService = new OrgDepartmentService(db)
  }

  // ========== Departments ==========

  async getDepartments() {
    return this.projectDepartmentService.getDepartments()
  }

  async createDepartment(data: { name: string; hqId?: string; code?: string }) {
    const result = await this.projectDepartmentService.createDepartment(data)
    // 注意：如果使用缓存版本，需要在子类中重写此方法以失效缓存
    return result
  }

  async updateDepartment(id: string, data: { name?: string; hqId?: string; active?: number; sortOrder?: number }) {
    const result = await this.projectDepartmentService.updateDepartment(id, data)
    // 注意：如果使用缓存版本，需要在子类中重写此方法以失效缓存
    return result
  }

  async deleteDepartment(id: string) {
    const result = await this.projectDepartmentService.deleteDepartment(id)
    // 注意：如果使用缓存版本，需要在子类中重写此方法以失效缓存
    return result
  }

  // ========== Sites ==========

  async getSites() {
    return this.siteService.getSites()
  }

  async createSite(data: { name: string; projectId: string }) {
    return this.siteService.createSite(data)
  }

  async updateSite(id: string, data: { name?: string; projectId?: string; active?: number }) {
    return this.siteService.updateSite(id, data)
  }

  async deleteSite(id: string) {
    return this.siteService.deleteSite(id)
  }

  // ========== Accounts ==========

  async getAccounts(search?: string) {
    return this.accountService.getAccounts(search)
  }

  async getAccountTransactions(accountId: string, page: number = 1, pageSize: number = 20) {
    return this.accountService.getAccountTransactions(accountId, page, pageSize)
  }

  async createAccount(data: {
    name: string
    type: string
    currency?: string
    alias?: string
    accountNumber?: string
    openingCents?: number
  }) {
    return this.accountService.createAccount(data)
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
    return this.accountService.updateAccount(id, data)
  }

  async deleteAccount(id: string) {
    return this.accountService.deleteAccount(id)
  }

  // ========== Vendors ==========

  async getVendors() {
    return this.vendorService.getVendors()
  }

  async getVendor(id: string) {
    return this.vendorService.getVendor(id)
  }

  async createVendor(data: {
    name: string
    contact?: string
    phone?: string
    email?: string
    address?: string
    memo?: string
  }) {
    return this.vendorService.createVendor(data)
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
    return this.vendorService.updateVendor(id, data)
  }

  async deleteVendor(id: string) {
    return this.vendorService.deleteVendor(id)
  }

  // ========== Headquarters ==========

  async getHeadquarters() {
    return this.headquartersService.getHeadquarters()
  }

  async updateHeadquarters(id: string, data: { name?: string; active?: number }) {
    return this.headquartersService.updateHeadquarters(id, data)
  }

  async deleteHeadquarters(id: string) {
    return this.headquartersService.deleteHeadquarters(id)
  }

  // ========== Currencies ==========

  async getCurrencies(search?: string) {
    return this.currencyService.getCurrencies(search)
  }

  async createCurrency(data: { code: string; name: string }) {
    return this.currencyService.createCurrency(data)
  }

  async updateCurrency(code: string, data: { name?: string; active?: number }) {
    return this.currencyService.updateCurrency(code, data)
  }

  async deleteCurrency(code: string) {
    return this.currencyService.deleteCurrency(code)
  }

  async batchOperation(
    entity: 'currency',
    ids: string[],
    operation: 'delete' | 'activate' | 'deactivate'
  ) {
    const results = {
      successCount: 0,
      failureCount: 0,
      failures: [] as { id: string; reason: string }[],
    }

    for (const id of ids) {
      try {
        if (entity === 'currency') {
          if (operation === 'delete') {
            await this.deleteCurrency(id)
          } else if (operation === 'activate') {
            await this.updateCurrency(id, { active: 1 })
          } else if (operation === 'deactivate') {
            await this.updateCurrency(id, { active: 0 })
          }
        }
        results.successCount++
      } catch (error: any) {
        results.failureCount++
        results.failures.push({
          id,
          reason: error.message || 'Unknown error',
        })
      }
    }

    return results
  }

  // ========== Categories ==========

  async getCategories() {
    return this.categoryService.getCategories()
  }

  async createCategory(data: { name: string; kind: string; parentId?: string }) {
    return this.categoryService.createCategory(data)
  }

  async updateCategory(id: string, data: { name?: string; kind?: string }) {
    return this.categoryService.updateCategory(id, data)
  }

  async deleteCategory(id: string) {
    return this.categoryService.deleteCategory(id)
  }

  // ========== Positions ==========

  async getPositions() {
    return this.positionService.getPositions()
  }

  async getAvailablePositions(orgProjectId: string) {
    return this.positionService.getAvailablePositions(orgProjectId)
  }

  // ========== Org Departments ==========

  async getOrgDepartments(projectId?: string) {
    return this.orgDepartmentService.getOrgDepartments(projectId)
  }

  async getOrgDepartment(id: string) {
    return this.orgDepartmentService.getOrgDepartment(id)
  }
}
