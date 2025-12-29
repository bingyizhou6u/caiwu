/**
 * 物业管理服务
 * 处理租赁物业的CRUD和变更记录
 */

import { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from '../../db/schema.js'
import {
  rentalProperties,
  rentalChanges,
  dormitoryAllocations,
} from '../../db/schema.js'
import { eq, and, desc, sql, isNotNull, inArray } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import { Errors } from '../../utils/errors.js'
import { getBusinessDate } from '../../utils/timezone.js'

export class RentalPropertyService {
  constructor(private db: DrizzleD1Database<typeof schema>) { }

  async listProperties(query: { propertyType?: string; status?: string; projectId?: string }) {
    // D1 兼容性修复：使用顺序查询代替复杂 JOIN
    const conditions = []
    if (query.propertyType) { conditions.push(eq(rentalProperties.propertyType, query.propertyType)) }
    if (query.status) { conditions.push(eq(rentalProperties.status, query.status)) }
    if (query.projectId) { conditions.push(eq(rentalProperties.projectId, query.projectId)) }

    // 1. 查询物业列表
    const properties = await this.db
      .select()
      .from(rentalProperties)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(rentalProperties.createdAt))
      .execute()

    if (properties.length === 0) return []

    // 2. 收集关联 ID
    const deptIds = [...new Set(properties.map(p => p.projectId).filter(Boolean) as string[])]
    const accountIds = [...new Set(properties.map(p => p.paymentAccountId).filter(Boolean) as string[])]
    const currencyCodes = [...new Set(properties.map(p => p.currency).filter(Boolean) as string[])]
    const creatorIds = [...new Set(properties.map(p => p.createdBy).filter(Boolean) as string[])]
    const propertyIds = properties.map(p => p.id)

    // 3. 批量查询关联数据
    const [departments, accounts, currencies, creators] = await Promise.all([
      deptIds.length > 0
        ? this.db.select({ id: schema.projects.id, name: schema.projects.name })
          .from(schema.projects)
          .where(inArray(schema.projects.id, deptIds))
          .all()
        : Promise.resolve([]),
      accountIds.length > 0
        ? this.db.select({ id: schema.accounts.id, name: schema.accounts.name })
          .from(schema.accounts)
          .where(inArray(schema.accounts.id, accountIds))
          .all()
        : Promise.resolve([]),
      currencyCodes.length > 0
        ? this.db.select({ code: schema.currencies.code, name: schema.currencies.name })
          .from(schema.currencies)
          .where(inArray(schema.currencies.code, currencyCodes))
          .all()
        : Promise.resolve([]),
      creatorIds.length > 0
        ? this.db.select({ id: schema.employees.id, name: schema.employees.name })
          .from(schema.employees)
          .where(inArray(schema.employees.id, creatorIds))
          .all()
        : Promise.resolve([]),
    ])

    // 4. 查询分配数量
    // 4. 查询分配数量
    const allocCounts = propertyIds.length > 0
      ? await this.db
        .select({
          propertyId: dormitoryAllocations.propertyId,
          count: sql<number>`count(*)`
        })
        .from(dormitoryAllocations)
        .where(and(
          inArray(dormitoryAllocations.propertyId, propertyIds),
          sql`${dormitoryAllocations.returnDate} IS NULL`
        ))
        .groupBy(dormitoryAllocations.propertyId)
        .all()
      : []

    // 5. 构建 Map
    const deptMap = new Map(departments.map(d => [d.id, d.name]))
    const accountMap = new Map(accounts.map(a => [a.id, a.name]))
    const currencyMap = new Map(currencies.map(c => [c.code, c.name]))
    const creatorMap = new Map(creators.map(e => [e.id, e.name]))
    const allocMap = new Map(allocCounts.map(a => [a.propertyId, a.count]))

    // 6. 组装结果
    return properties.map(p => ({
      property: p,
      departmentName: p.projectId ? deptMap.get(p.projectId) || null : null,
      paymentAccountName: p.paymentAccountId ? accountMap.get(p.paymentAccountId) || null : null,
      currencyName: p.currency ? currencyMap.get(p.currency) || null : null,
      createdByName: p.createdBy ? creatorMap.get(p.createdBy) || null : null,
      allocationsCount: allocMap.get(p.id) || 0,
    }))
  }

  async getProperty(id: string) {
    // D1 兼容性修复：使用顺序查询代替复杂 JOIN

    // 1. 查询物业
    const property = await this.db
      .select()
      .from(rentalProperties)
      .where(eq(rentalProperties.id, id))
      .get()

    if (!property) {
      throw Errors.NOT_FOUND('物业')
    }

    // 2. 查询关联数据
    const [department, account, currency, creator, changes] = await Promise.all([
      property.projectId
        ? this.db.select({ name: schema.projects.name }).from(schema.projects)
          .where(eq(schema.projects.id, property.projectId)).get()
        : Promise.resolve(null),
      property.paymentAccountId
        ? this.db.select({ name: schema.accounts.name }).from(schema.accounts)
          .where(eq(schema.accounts.id, property.paymentAccountId)).get()
        : Promise.resolve(null),
      property.currency
        ? this.db.select({ name: schema.currencies.name }).from(schema.currencies)
          .where(eq(schema.currencies.code, property.currency)).get()
        : Promise.resolve(null),
      property.createdBy
        ? this.db.select({ name: schema.employees.name }).from(schema.employees)
          .where(eq(schema.employees.id, property.createdBy)).get()
        : Promise.resolve(null),
      this.db
        .select()
        .from(rentalChanges)
        .where(eq(rentalChanges.propertyId, id))
        .orderBy(desc(rentalChanges.changeDate))
        .execute(),
    ])

    return {
      ...property,
      departmentName: department?.name || null,
      paymentAccountName: account?.name || null,
      currencyName: currency?.name || null,
      createdByName: creator?.name || null,
      changes,
    }
  }

  async createProperty(data: {
    propertyCode: string
    name: string
    propertyType: string
    address?: string
    areaSqm?: number
    rentType?: string
    monthlyRentCents?: number
    yearlyRentCents?: number
    currency: string
    paymentPeriodMonths?: number
    landlordName?: string
    landlordContact?: string
    leaseStartDate?: string
    leaseEndDate?: string
    depositCents?: number
    paymentMethod?: string
    paymentAccountId?: string
    paymentDay?: number
    projectId?: string
    status?: string
    memo?: string
    contractFileUrl?: string
    createdBy?: string
  }) {
    const existing = await this.db
      .select({ id: rentalProperties.id })
      .from(rentalProperties)
      .where(eq(rentalProperties.propertyCode, data.propertyCode))
      .get()
    if (existing) {
      throw Errors.DUPLICATE('物业代码')
    }

    const id = uuid()
    const now = Date.now()

    await this.db
      .insert(rentalProperties)
      .values({
        id,
        propertyCode: data.propertyCode,
        name: data.name,
        propertyType: data.propertyType,
        address: data.address,
        areaSqm: data.areaSqm,
        rentType: data.rentType || 'monthly',
        monthlyRentCents: data.monthlyRentCents,
        yearlyRentCents: data.yearlyRentCents,
        currency: data.currency,
        paymentPeriodMonths: data.paymentPeriodMonths || 1,
        landlordName: data.landlordName,
        landlordContact: data.landlordContact,
        leaseStartDate: data.leaseStartDate,
        leaseEndDate: data.leaseEndDate,
        depositCents: data.depositCents,
        paymentMethod: data.paymentMethod,
        paymentAccountId: data.paymentAccountId,
        paymentDay: data.paymentDay || 1,
        projectId: data.propertyType === 'office' ? data.projectId : null,
        status: data.status || 'active',
        memo: data.memo,
        contractFileUrl: data.contractFileUrl,
        createdBy: data.createdBy,
        createdAt: now,
        updatedAt: now,
      })
      .execute()

    return { id }
  }

  async updateProperty(
    id: string,
    data: Partial<typeof rentalProperties.$inferInsert> & { createdBy?: string }
  ) {
    const existing = await this.db
      .select()
      .from(rentalProperties)
      .where(eq(rentalProperties.id, id))
      .get()
    if (!existing) {
      throw Errors.NOT_FOUND('物业')
    }

    const now = Date.now()

    // 检查是否需要记录变更日志
    const needsChangeLog =
      data.status !== undefined ||
      data.monthlyRentCents !== undefined ||
      data.yearlyRentCents !== undefined ||
      data.rentType !== undefined ||
      data.leaseStartDate !== undefined ||
      data.leaseEndDate !== undefined

    // 使用事务确保更新和变更日志的原子性
    await this.db.transaction(async tx => {
      await tx
        .update(rentalProperties)
        .set({ ...data, updatedAt: now })
        .where(eq(rentalProperties.id, id))
        .run()

      // 如果关键字段更新则记录变更
      if (needsChangeLog) {
        const changeId = uuid()
        await tx
          .insert(rentalChanges)
          .values({
            id: changeId,
            propertyId: id,
            changeType: 'modify',
            changeDate: getBusinessDate(),
            fromLeaseStart: existing.leaseStartDate,
            toLeaseStart:
              data.leaseStartDate !== undefined ? data.leaseStartDate : existing.leaseStartDate,
            fromLeaseEnd: existing.leaseEndDate,
            toLeaseEnd: data.leaseEndDate !== undefined ? data.leaseEndDate : existing.leaseEndDate,
            fromMonthlyRentCents: existing.monthlyRentCents,
            toMonthlyRentCents:
              data.monthlyRentCents !== undefined ? data.monthlyRentCents : existing.monthlyRentCents,
            fromStatus: existing.status,
            toStatus: data.status !== undefined ? data.status : existing.status,
            memo: data.memo,
            createdBy: data.createdBy,
            createdAt: now,
          })
          .run()
      }
    })
  }

  async deleteProperty(id: string) {
    const property = await this.db
      .select()
      .from(rentalProperties)
      .where(eq(rentalProperties.id, id))
      .get()
    if (!property) {
      throw Errors.NOT_FOUND('物业')
    }

    const paymentCount = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.rentalPayments)
      .where(eq(schema.rentalPayments.propertyId, id))
      .get()
    if (paymentCount && paymentCount.count > 0) {
      throw Errors.BUSINESS_ERROR('无法删除，该物业还有付款记录')
    }

    await this.db.transaction(async tx => {
      await tx.delete(rentalChanges).where(eq(rentalChanges.propertyId, id)).execute()
      await tx.delete(dormitoryAllocations).where(eq(dormitoryAllocations.propertyId, id)).execute()
      await tx.delete(rentalProperties).where(eq(rentalProperties.id, id)).execute()
    })

    return property
  }

  async listRentalChanges(propertyId: string) {
    return await this.db
      .select()
      .from(rentalChanges)
      .where(eq(rentalChanges.propertyId, propertyId))
      .orderBy(desc(rentalChanges.changeDate))
      .execute()
  }

  async createRentalChange(data: {
    propertyId: string
    changeType: string
    changeDate: string
    fromLeaseStart?: string | null
    toLeaseStart?: string | null
    fromLeaseEnd?: string | null
    toLeaseEnd?: string | null
    fromMonthlyRentCents?: number | null
    toMonthlyRentCents?: number | null
    fromStatus?: string | null
    toStatus?: string | null
    memo?: string | null
    createdBy?: string | null
  }) {
    const changeId = uuid()
    await this.db
      .insert(rentalChanges)
      .values({
        id: changeId,
        propertyId: data.propertyId,
        changeType: data.changeType,
        changeDate: data.changeDate,
        fromLeaseStart: data.fromLeaseStart,
        toLeaseStart: data.toLeaseStart,
        fromLeaseEnd: data.fromLeaseEnd,
        toLeaseEnd: data.toLeaseEnd,
        fromMonthlyRentCents: data.fromMonthlyRentCents,
        toMonthlyRentCents: data.toMonthlyRentCents,
        fromStatus: data.fromStatus,
        toStatus: data.toStatus,
        memo: data.memo,
        createdBy: data.createdBy,
        createdAt: Date.now(),
      })
      .execute()

    return { id: changeId }
  }
}

