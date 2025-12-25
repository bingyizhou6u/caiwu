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
import { eq, and, desc, sql, isNotNull } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import { Errors } from '../../utils/errors.js'
import { getBusinessDate } from '../../utils/timezone.js'

export class RentalPropertyService {
  constructor(private db: DrizzleD1Database<typeof schema>) { }

  async listProperties(query: { propertyType?: string; status?: string; departmentId?: string }) {
    const conditions = []
    if (query.propertyType) { conditions.push(eq(rentalProperties.propertyType, query.propertyType)) }
    if (query.status) { conditions.push(eq(rentalProperties.status, query.status)) }
    if (query.departmentId) { conditions.push(eq(rentalProperties.departmentId, query.departmentId)) }

    return await this.db
      .select({
        property: rentalProperties,
        departmentName: schema.departments.name,
        paymentAccountName: schema.accounts.name,
        currencyName: schema.currencies.name,
        createdByName: schema.employees.name,
        allocationsCount: sql<number>`(SELECT count(*) FROM ${dormitoryAllocations} WHERE ${dormitoryAllocations.propertyId} = ${rentalProperties.id} AND ${dormitoryAllocations.returnDate} IS NULL)`,
      })
      .from(rentalProperties)
      .leftJoin(schema.departments, eq(schema.departments.id, rentalProperties.departmentId))
      .leftJoin(schema.accounts, eq(schema.accounts.id, rentalProperties.paymentAccountId))
      .leftJoin(schema.currencies, eq(schema.currencies.code, rentalProperties.currency))
      .leftJoin(schema.employees, eq(schema.employees.id, rentalProperties.createdBy))
      .where(and(...conditions))
      .orderBy(desc(rentalProperties.createdAt))
      .execute()
  }

  async getProperty(id: string) {
    const property = await this.db
      .select({
        property: rentalProperties,
        departmentName: schema.departments.name,
        paymentAccountName: schema.accounts.name,
        currencyName: schema.currencies.name,
        createdByName: schema.employees.name,
      })
      .from(rentalProperties)
      .leftJoin(schema.departments, eq(schema.departments.id, rentalProperties.departmentId))
      .leftJoin(schema.accounts, eq(schema.accounts.id, rentalProperties.paymentAccountId))
      .leftJoin(schema.currencies, eq(schema.currencies.code, rentalProperties.currency))
      .leftJoin(schema.employees, eq(schema.employees.id, rentalProperties.createdBy))
      .where(eq(rentalProperties.id, id))
      .get()

    if (!property) {
      throw Errors.NOT_FOUND('物业')
    }

    // 并行获取相关数据
    const [changes] = await Promise.all([
      this.db
        .select()
        .from(rentalChanges)
        .where(eq(rentalChanges.propertyId, id))
        .orderBy(desc(rentalChanges.changeDate))
        .execute(),
    ])

    return {
      ...property.property,
      departmentName: property.departmentName,
      paymentAccountName: property.paymentAccountName,
      currencyName: property.currencyName,
      createdByName: property.createdByName,
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
    departmentId?: string
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
        departmentId: data.propertyType === 'office' ? data.departmentId : null,
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

