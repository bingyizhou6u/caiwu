import { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from '../../db/schema.js'
import {
  fixedAssets,
  fixedAssetDepreciations,
  fixedAssetChanges,
  projects,
  sites,
  vendors,
  currencies,
  employees,
  accounts,
  cashFlows,
  accountTransactions,
} from '../../db/schema.js'
import { eq, and, like, or, desc, sql, inArray } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import { Errors } from '../../utils/errors.js'
import { FinanceService } from '../finance/FinanceService.js'
import { QueryBuilder } from '../../utils/query-builder.js'
import { query } from '../../utils/query-helpers.js'
import { getBusinessDate } from '../../utils/timezone.js'
import type { Context } from 'hono'
import type { Env, AppVariables } from '../../types/index.js'

export class FixedAssetService {
  constructor(private db: DrizzleD1Database<typeof schema>) { }

  async list(query: {
    search?: string
    status?: string
    projectId?: string
    category?: string
    createdBy?: string
    limit?: number
    offset?: number
  }) {
    const conditions = []
    if (query.search) {
      const search = `%${query.search}%`
      conditions.push(
        or(
          like(fixedAssets.name, search),
          like(fixedAssets.assetCode, search),
          like(fixedAssets.custodian, search)
        )
      )
    }
    if (query.status) { conditions.push(eq(fixedAssets.status, query.status)) }
    if (query.projectId) { conditions.push(eq(fixedAssets.projectId, query.projectId)) }
    if (query.category) { conditions.push(eq(fixedAssets.category, query.category)) }
    if (query.createdBy) { conditions.push(eq(fixedAssets.createdBy, query.createdBy)) }

    const assets = await this.db
      .select()
      .from(fixedAssets)
      .where(and(...conditions))
      .orderBy(desc(fixedAssets.createdAt))
      .limit(query.limit || 100)
      .offset(query.offset || 0)
      .execute()

    // 使用 QueryBuilder 提取关联ID并批量获取
    const relatedIds = QueryBuilder.extractRelatedIds(assets, {
      projectId: a => a.projectId,
      siteId: a => a.siteId,
      vendorId: a => a.vendorId,
      employeeId: a => a.createdBy,
    })

    const currencyCodes = new Set(assets.map(a => a.currency).filter(Boolean))
    const relatedData = await QueryBuilder.fetchRelatedData(this.db, {
      ...relatedIds,
      currencyIds: Array.from(currencyCodes),
    })

    const deptMap = QueryBuilder.createMaps(relatedData.projects)
    const siteMap = QueryBuilder.createMaps(relatedData.sites)
    const vendorMap = QueryBuilder.createMaps(relatedData.vendors)
    const userMap = QueryBuilder.createMaps(relatedData.employees)
    // currencies 使用 code 作为 key，不是 id
    const currencyMap = new Map(relatedData.currencies.map(c => [c.code, c]))

    return assets.map(asset => ({
      asset,
      departmentName: asset.projectId ? deptMap.get(asset.projectId)?.name || null : null,
      siteName: asset.siteId ? siteMap.get(asset.siteId)?.name || null : null,
      vendorName: asset.vendorId ? vendorMap.get(asset.vendorId)?.name || null : null,
      currencyName: asset.currency ? currencyMap.get(asset.currency)?.name || null : null,
      createdByName: asset.createdBy ? userMap.get(asset.createdBy)?.email || null : null,
    }))
  }

  async getCategories() {
    // 使用Drizzle ORM的isNotNull函数替代原生SQL
    return await this.db
      .selectDistinct({ name: fixedAssets.category })
      .from(fixedAssets)
      .where(
        and(
          sql`${fixedAssets.category} IS NOT NULL`,
          sql`${fixedAssets.category} != ''`
        )
      )
      .orderBy(fixedAssets.category)
      .execute()
  }


  async get(id: string, c?: Context<{ Bindings: Env; Variables: AppVariables }>) {
    const asset = await query(
      this.db,
      'FixedAssetService.get.getAsset',
      () => this.db.select().from(fixedAssets).where(eq(fixedAssets.id, id)).get(),
      c
    )
    if (!asset) { return null }

    const [dept, site, vendor, currency, user] = await Promise.all([
      asset.projectId
        ? query(
          this.db,
          'FixedAssetService.get.getDepartment',
          () => this.db.select().from(projects).where(eq(projects.id, asset.projectId!)).get(),
          c
        )
        : Promise.resolve(null),
      asset.siteId
        ? query(
          this.db,
          'FixedAssetService.get.getSite',
          () => this.db.select().from(sites).where(eq(sites.id, asset.siteId!)).get(),
          c
        )
        : Promise.resolve(null),
      asset.vendorId
        ? query(
          this.db,
          'FixedAssetService.get.getVendor',
          () => this.db.select().from(vendors).where(eq(vendors.id, asset.vendorId!)).get(),
          c
        )
        : Promise.resolve(null),
      asset.currency
        ? query(
          this.db,
          'FixedAssetService.get.getCurrency',
          () => this.db.select().from(currencies).where(eq(currencies.code, asset.currency)).get(),
          c
        )
        : Promise.resolve(null),
      asset.createdBy
        ? query(
          this.db,
          'FixedAssetService.get.getEmployee',
          () => this.db.select().from(employees).where(eq(employees.id, asset.createdBy!)).get(),
          c
        )
        : Promise.resolve(null),
    ])

    const depreciations = await this.db
      .select()
      .from(fixedAssetDepreciations)
      .where(eq(fixedAssetDepreciations.assetId, id))
      .orderBy(desc(fixedAssetDepreciations.depreciationDate))
      .execute()

    const changes = await this.db
      .select()
      .from(fixedAssetChanges)
      .where(eq(fixedAssetChanges.assetId, id))
      .orderBy(desc(fixedAssetChanges.changeDate), desc(fixedAssetChanges.createdAt))
      .execute()

    // 提取变更记录中的关联ID
    const changeDeptIds = new Set<string>()
    const changeSiteIds = new Set<string>()
    const changeUserIds = new Set<string>()

    changes.forEach(c => {
      if (c.fromDeptId) changeDeptIds.add(c.fromDeptId)
      if (c.toDeptId) changeDeptIds.add(c.toDeptId)
      if (c.fromSiteId) changeSiteIds.add(c.fromSiteId)
      if (c.toSiteId) changeSiteIds.add(c.toSiteId)
      if (c.createdBy) changeUserIds.add(c.createdBy)
    })

    // 使用 QueryBuilder 批量获取关联数据
    const changeRelatedData = await QueryBuilder.fetchRelatedData(this.db, {
      projectIds: Array.from(changeDeptIds),
      siteIds: Array.from(changeSiteIds),
      employeeIds: Array.from(changeUserIds),
    })

    const changeDeptMap = QueryBuilder.createMaps(changeRelatedData.projects)
    const changeSiteMap = QueryBuilder.createMaps(changeRelatedData.sites)
    const changeUserMap = QueryBuilder.createMaps(changeRelatedData.employees)

    return {
      ...asset,
      departmentName: dept?.name || null,
      siteName: site?.name || null,
      vendorName: vendor?.name || null,
      currencyName: currency?.name || null,
      createdByName: user?.email || null,
      depreciations,
      changes: changes.map(c => ({
        ...c,
        fromDeptName: c.fromDeptId ? changeDeptMap.get(c.fromDeptId)?.name || null : null,
        toDeptName: c.toDeptId ? changeDeptMap.get(c.toDeptId)?.name || null : null,
        fromSiteName: c.fromSiteId ? changeSiteMap.get(c.fromSiteId)?.name || null : null,
        toSiteName: c.toSiteId ? changeSiteMap.get(c.toSiteId)?.name || null : null,
        createdByName: c.createdBy ? changeUserMap.get(c.createdBy)?.email || null : null,
      })),
    }
  }

  async create(data: {
    assetCode: string
    name: string
    category?: string
    purchaseDate?: string
    purchasePriceCents: number
    currency: string
    vendorId?: string
    projectId?: string
    siteId?: string
    custodian?: string
    status?: string
    depreciationMethod?: string
    usefulLifeYears?: number
    currentValueCents?: number
    memo?: string
    createdBy?: string
  }) {
    const existing = await this.db
      .select()
      .from(fixedAssets)
      .where(eq(fixedAssets.assetCode, data.assetCode))
      .get()
    if (existing) {
      throw Errors.DUPLICATE('资产代码')
    }

    const id = uuid()
    const now = Date.now()
    await this.db
      .insert(fixedAssets)
      .values({
        id,
        ...data,
        status: data.status || 'in_use',
        currentValueCents:
          data.currentValueCents !== undefined ? data.currentValueCents : data.purchasePriceCents,
        createdAt: now,
        updatedAt: now,
      })
      .execute()

    return { id, assetCode: data.assetCode }
  }

  async update(
    id: string,
    data: {
      name?: string
      category?: string
      purchaseDate?: string
      purchasePriceCents?: number
      currency?: string
      vendorId?: string
      projectId?: string
      siteId?: string
      custodian?: string
      status?: string
      memo?: string
      createdBy?: string // 用于变更日志
    }
    , c?: Context<{ Bindings: Env; Variables: AppVariables }>) {
    const existing = await query(
      this.db,
      'FixedAssetService.update.getAsset',
      () => this.db.select().from(fixedAssets).where(eq(fixedAssets.id, id)).get(),
      c
    )
    if (!existing) {
      throw Errors.NOT_FOUND()
    }

    const now = Date.now()
    await this.db
      .update(fixedAssets)
      .set({
        ...data,
        updatedAt: now,
      })
      .where(eq(fixedAssets.id, id))
      .execute()

    // 如果状态、部门、站点或保管人发生变化，记录变更日志
    if (data.status || data.projectId || data.siteId || data.custodian) {
      const changeId = uuid()
      await this.db
        .insert(fixedAssetChanges)
        .values({
          id: changeId,
          assetId: id,
          changeType: 'status_change',
          changeDate: getBusinessDate(),
          fromDeptId: existing.projectId,
          toDeptId: data.projectId !== undefined ? data.projectId : existing.projectId,
          fromSiteId: existing.siteId,
          toSiteId: data.siteId !== undefined ? data.siteId : existing.siteId,
          fromCustodian: existing.custodian,
          toCustodian: data.custodian !== undefined ? data.custodian : existing.custodian,
          fromStatus: existing.status,
          toStatus: data.status || existing.status,
          memo: data.memo,
          createdBy: data.createdBy,
          createdAt: now,
        })
        .execute()
    }

    return { ok: true }
  }

  async delete(id: string, c?: Context<{ Bindings: Env; Variables: AppVariables }>) {
    const asset = await query(
      this.db,
      'FixedAssetService.delete.getAsset',
      () => this.db.select().from(fixedAssets).where(eq(fixedAssets.id, id)).get(),
      c
    )
    if (!asset) {
      throw Errors.NOT_FOUND()
    }

    const depCount = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(fixedAssetDepreciations)
      .where(eq(fixedAssetDepreciations.assetId, id))
      .get()

    if (depCount && depCount.count > 0) {
      throw Errors.BUSINESS_ERROR('无法删除，该资产还有折旧记录')
    }

    await this.db.transaction(async tx => {
      await tx.delete(fixedAssetChanges).where(eq(fixedAssetChanges.assetId, id)).run()
      await tx.delete(fixedAssets).where(eq(fixedAssets.id, id)).run()
    })

    return asset
  }


  async purchase(data: {
    assetCode: string
    name: string
    category?: string
    purchaseDate?: string
    purchasePriceCents: number
    currency: string
    vendorId?: string
    projectId?: string
    siteId?: string
    custodian?: string
    depreciationMethod?: string
    usefulLifeYears?: number
    memo?: string
    accountId: string
    categoryId: string
    voucherUrl?: string
    createdBy?: string
  }) {
    const existing = await query(
      this.db,
      'FixedAssetService.create.checkAssetCode',
      () => this.db
        .select()
        .from(fixedAssets)
        .where(eq(fixedAssets.assetCode, data.assetCode))
        .get(),
      undefined
    )
    if (existing) {
      throw Errors.DUPLICATE('资产代码')
    }

    const account = await query(
      this.db,
      'FixedAssetService.create.getAccount',
      () => this.db
        .select()
        .from(accounts)
        .where(eq(accounts.id, data.accountId))
        .get(),
      undefined
    )
    if (!account) {
      throw Errors.NOT_FOUND('账户')
    }
    if (account.active === 0) {
      throw Errors.BUSINESS_ERROR('账户已停用')
    }
    if (account.currency !== data.currency) {
      throw Errors.BUSINESS_ERROR('账户币种不匹配')
    }

    const assetId = uuid()
    const flowId = uuid()
    const transactionId = uuid()
    const changeId = uuid()
    const now = Date.now()
    const purchaseDate = data.purchaseDate || getBusinessDate()
    const day = purchaseDate.replace(/-/g, '')

    // 生成凭证号
    const count = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(cashFlows)
      .where(eq(cashFlows.bizDate, purchaseDate))
      .get()
    const seq = ((count?.count ?? 0) + 1).toString().padStart(3, '0')
    const voucherNo = `JZ${day}-${seq}`

    const financeService = new FinanceService(this.db)
    const balanceBefore = await financeService.getAccountBalanceBefore(
      data.accountId,
      purchaseDate,
      now
    )
    const balanceAfter = balanceBefore - data.purchasePriceCents

    let vendorName: string | null = null
    if (data.vendorId) {
      const vendor = await query(
        this.db,
        'FixedAssetService.create.getVendor',
        () => this.db.select().from(vendors).where(eq(vendors.id, data.vendorId!)).get(),
        undefined
      )
      vendorName = vendor?.name || null
    }

    await this.db.transaction(async tx => {
      // 1. 创建资产
      await tx
        .insert(fixedAssets)
        .values({
          id: assetId,
          assetCode: data.assetCode,
          name: data.name,
          category: data.category,
          purchaseDate,
          purchasePriceCents: data.purchasePriceCents,
          currency: data.currency,
          vendorId: data.vendorId,
          projectId: data.projectId,
          siteId: data.siteId,
          custodian: data.custodian,
          status: 'in_use',
          depreciationMethod: data.depreciationMethod,
          usefulLifeYears: data.usefulLifeYears,
          currentValueCents: data.purchasePriceCents,
          memo: data.memo,
          createdBy: data.createdBy,
          createdAt: now,
          updatedAt: now,
        })
        .run()

      // 2. 创建现金流水
      await tx
        .insert(cashFlows)
        .values({
          id: flowId,
          voucherNo,
          bizDate: purchaseDate,
          type: 'expense',
          accountId: data.accountId,
          categoryId: data.categoryId,
          amountCents: data.purchasePriceCents,
          siteId: data.siteId,
          projectId: data.projectId,
          counterparty: vendorName,
          memo: `购买资产：${data.name}（${data.assetCode}）` + (data.memo ? `；${data.memo}` : ''),
          voucherUrl: data.voucherUrl,
          createdBy: data.createdBy,
          createdAt: now,
        })
        .run()

      // 3. 创建交易记录
      await tx
        .insert(accountTransactions)
        .values({
          id: transactionId,
          accountId: data.accountId,
          flowId,
          transactionDate: purchaseDate,
          transactionType: 'expense',
          amountCents: data.purchasePriceCents,
          balanceBeforeCents: balanceBefore,
          balanceAfterCents: balanceAfter,
          createdAt: now,
        })
        .run()

      // 4. 创建资产变更日志
      await tx
        .insert(fixedAssetChanges)
        .values({
          id: changeId,
          assetId,
          changeType: 'purchase',
          changeDate: purchaseDate,
          toStatus: 'in_use',
          memo: `购买资产：${data.name}`,
          createdBy: data.createdBy,
          createdAt: now,
        })
        .run()
    })

    return { id: assetId, assetCode: data.assetCode, flowId, voucherNo }
  }

  async sell(
    id: string,
    data: {
      saleDate: string
      salePriceCents: number
      saleBuyer?: string
      saleMemo?: string
      accountId: string
      categoryId: string
      currency: string
      voucherUrl?: string
      memo?: string
      createdBy?: string
    },
    c?: Context<{ Bindings: Env; Variables: AppVariables }>
  ) {
    const asset = await query(
      this.db,
      'FixedAssetService.sell.getAsset',
      () => this.db.select().from(fixedAssets).where(eq(fixedAssets.id, id)).get(),
      c
    )
    if (!asset) {
      throw Errors.NOT_FOUND('asset')
    }

    if (asset.status === 'sold') {
      throw Errors.BUSINESS_ERROR('资产已出售')
    }

    const account = await this.db
      .select()
      .from(accounts)
      .where(eq(accounts.id, data.accountId))
      .get()
    if (!account) {
      throw Errors.NOT_FOUND('账户')
    }
    if (account.active === 0) {
      throw Errors.BUSINESS_ERROR('账户已停用')
    }
    if (account.currency !== data.currency) {
      throw Errors.BUSINESS_ERROR('账户币种不匹配')
    }

    const flowId = uuid()
    const transactionId = uuid()
    const changeId = uuid()
    const now = Date.now()
    const day = data.saleDate.replace(/-/g, '')

    const count = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(cashFlows)
      .where(eq(cashFlows.bizDate, data.saleDate))
      .get()
    const seq = ((count?.count ?? 0) + 1).toString().padStart(3, '0')
    const voucherNo = `JZ${day}-${seq}`

    const financeService = new FinanceService(this.db)
    const balanceBefore = await financeService.getAccountBalanceBefore(
      data.accountId,
      data.saleDate,
      now
    )
    const balanceAfter = balanceBefore + data.salePriceCents

    await this.db.transaction(async tx => {
      // 1. 更新资产
      await tx
        .update(fixedAssets)
        .set({
          status: 'sold',
          saleDate: data.saleDate,
          salePriceCents: data.salePriceCents,
          saleBuyer: data.saleBuyer,
          saleMemo: data.saleMemo,
          updatedAt: now,
        })
        .where(eq(fixedAssets.id, id))
        .run()

      // 2. 创建现金流水
      await tx
        .insert(cashFlows)
        .values({
          id: flowId,
          voucherNo,
          bizDate: data.saleDate,
          type: 'income',
          accountId: data.accountId,
          categoryId: data.categoryId,
          amountCents: data.salePriceCents,
          siteId: asset.siteId,
          projectId: asset.projectId,
          counterparty: data.saleBuyer,
          memo:
            `卖出资产：${asset.name}（${asset.assetCode}）` +
            (data.saleMemo ? `；${data.saleMemo}` : ''),
          voucherUrl: data.voucherUrl,
          createdBy: data.createdBy,
          createdAt: now,
        })
        .run()

      // 3. 创建交易记录
      await tx
        .insert(accountTransactions)
        .values({
          id: transactionId,
          accountId: data.accountId,
          flowId,
          transactionDate: data.saleDate,
          transactionType: 'income',
          amountCents: data.salePriceCents,
          balanceBeforeCents: balanceBefore,
          balanceAfterCents: balanceAfter,
          createdAt: now,
        })
        .run()

      // 4. 创建资产变更日志
      await tx
        .insert(fixedAssetChanges)
        .values({
          id: changeId,
          assetId: id,
          changeType: 'sale',
          changeDate: data.saleDate,
          fromStatus: asset.status,
          toStatus: 'sold',
          memo:
            `卖出资产：${asset.name}，卖出价格：${(data.salePriceCents / 100).toFixed(2)} ${asset.currency}` +
            (data.memo ? `；${data.memo}` : ''),
          createdBy: data.createdBy,
          createdAt: now,
        })
        .run()
    })

    return { ok: true, flowId, voucherNo }
  }

}
