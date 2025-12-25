/**
 * 租金支付服务
 * 处理租金支付记录和应付账单
 */

import { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from '../../db/schema.js'
import {
  rentalPayments,
  rentalProperties,
  rentalPayableBills,
  cashFlows,
  accountTransactions,
} from '../../db/schema.js'
import { eq, and, desc, sql, isNotNull, gte, lte, asc } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import { Errors } from '../../utils/errors.js'
import { FinanceService } from '../finance/FinanceService.js'
import { getBusinessDate } from '../../utils/timezone.js'

export class RentalPaymentService {
  constructor(private db: DrizzleD1Database<typeof schema>) { }

  async listPayments(query: { propertyId?: string; year?: number; month?: number }) {
    const conditions = []
    if (query.propertyId) { conditions.push(eq(rentalPayments.propertyId, query.propertyId)) }
    if (query.year) { conditions.push(eq(rentalPayments.year, query.year)) }
    if (query.month) { conditions.push(eq(rentalPayments.month, query.month)) }

    return await this.db
      .select({
        payment: rentalPayments,
        propertyCode: rentalProperties.propertyCode,
        propertyName: rentalProperties.name,
        propertyType: rentalProperties.propertyType,
        accountName: schema.accounts.name,
        categoryName: schema.categories.name,
        createdByName: schema.employees.name,
      })
      .from(rentalPayments)
      .leftJoin(rentalProperties, eq(rentalProperties.id, rentalPayments.propertyId))
      .leftJoin(schema.accounts, eq(schema.accounts.id, rentalPayments.accountId))
      .leftJoin(schema.categories, eq(schema.categories.id, rentalPayments.categoryId))
      .leftJoin(schema.employees, eq(schema.employees.id, rentalPayments.createdBy))
      .where(and(...conditions))
      .orderBy(
        desc(rentalPayments.year),
        desc(rentalPayments.month),
        desc(rentalPayments.createdAt)
      )
      .execute()
  }

  async createPayment(data: {
    propertyId: string
    paymentDate: string
    year: number
    month: number
    amountCents: number
    currency: string
    accountId: string
    categoryId?: string
    paymentMethod?: string
    voucherUrl?: string
    memo?: string
    createdBy?: string
  }) {
    const property = await this.db
      .select()
      .from(rentalProperties)
      .where(eq(rentalProperties.id, data.propertyId))
      .get()
    if (!property) {
      throw Errors.NOT_FOUND('物业')
    }

    const existing = await this.db
      .select()
      .from(rentalPayments)
      .where(
        and(
          eq(rentalPayments.propertyId, data.propertyId),
          eq(rentalPayments.year, data.year),
          eq(rentalPayments.month, data.month)
        )
      )
      .get()
    if (existing) {
      throw Errors.DUPLICATE('该月的付款记录')
    }

    const account = await this.db
      .select()
      .from(schema.accounts)
      .where(eq(schema.accounts.id, data.accountId))
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

    const paymentId = uuid()
    const now = Date.now()
    const flowId = uuid()
    const day = data.paymentDate.replace(/-/g, '')

    const financeService = new FinanceService(this.db)

    return await this.db.transaction(async tx => {
      const txFinanceService = new FinanceService(tx as any)

      await tx
        .insert(rentalPayments)
        .values({
          id: paymentId,
          propertyId: data.propertyId,
          paymentDate: data.paymentDate,
          year: data.year,
          month: data.month,
          amountCents: data.amountCents,
          currency: data.currency,
          accountId: data.accountId,
          categoryId: data.categoryId,
          paymentMethod: data.paymentMethod,
          voucherUrl: data.voucherUrl,
          memo: data.memo,
          createdBy: data.createdBy,
          createdAt: now,
          updatedAt: now,
        })
        .execute()

      const countRes = await tx
        .select({ count: sql<number>`count(*)` })
        .from(cashFlows)
        .where(eq(cashFlows.bizDate, data.paymentDate))
        .get()
      const seq = ((countRes?.count ?? 0) + 1).toString().padStart(3, '0')
      const voucherNo = `JZ${day}-${seq}`

      const balanceBefore = await txFinanceService.getAccountBalanceBefore(
        data.accountId,
        data.paymentDate,
        now
      )
      const balanceAfter = balanceBefore - data.amountCents

      await tx
        .insert(cashFlows)
        .values({
          id: flowId,
          voucherNo,
          bizDate: data.paymentDate,
          type: 'expense',
          accountId: data.accountId,
          categoryId: data.categoryId,
          method: data.paymentMethod,
          amountCents: data.amountCents,
          siteId: null,
          departmentId: property.departmentId,
          counterparty: property.landlordName,
          memo:
            `支付租金：${property.name}（${property.propertyCode}）` +
            (data.memo ? `；${data.memo}` : ''),
          voucherUrl: data.voucherUrl,
          createdBy: data.createdBy,
          createdAt: now,
        })
        .execute()

      const transactionId = uuid()
      await tx
        .insert(accountTransactions)
        .values({
          id: transactionId,
          accountId: data.accountId,
          flowId,
          transactionDate: data.paymentDate,
          transactionType: 'expense',
          amountCents: data.amountCents,
          balanceBeforeCents: balanceBefore,
          balanceAfterCents: balanceAfter,
          createdAt: now,
        })
        .execute()

      await tx
        .update(rentalPayableBills)
        .set({
          status: 'paid',
          paidDate: data.paymentDate,
          paidPaymentId: paymentId,
          updatedAt: now,
        })
        .where(
          and(
            eq(rentalPayableBills.propertyId, data.propertyId),
            eq(rentalPayableBills.year, data.year),
            eq(rentalPayableBills.month, data.month),
            eq(rentalPayableBills.status, 'unpaid')
          )
        )
        .execute()

      return { id: paymentId, flowId, voucherNo }
    })
  }

  async updatePayment(id: string, data: Partial<typeof rentalPayments.$inferInsert>) {
    const existing = await this.db
      .select()
      .from(rentalPayments)
      .where(eq(rentalPayments.id, id))
      .get()
    if (!existing) {
      throw Errors.NOT_FOUND('付款记录')
    }

    await this.db
      .update(rentalPayments)
      .set({ ...data, updatedAt: Date.now() })
      .where(eq(rentalPayments.id, id))
      .execute()
  }

  async deletePayment(id: string) {
    const payment = await this.db
      .select()
      .from(rentalPayments)
      .where(eq(rentalPayments.id, id))
      .get()
    if (!payment) {
      throw Errors.NOT_FOUND('付款记录')
    }

    const now = Date.now()

    // 使用事务确保所有删除操作的原子性
    await this.db.transaction(async tx => {
      // 1. 查找关联的现金流水 (通过 memo 匹配或通过应付账单的 paidPaymentId)
      // 根据 createPayment 的逻辑，我们需要通过 payable bill 找到 flowId
      // 或者直接通过 memo 中的物业信息匹配

      // 2. 重置关联的应付账单状态
      await tx
        .update(rentalPayableBills)
        .set({
          status: 'unpaid',
          paidDate: null,
          paidPaymentId: null,
          updatedAt: now,
        })
        .where(eq(rentalPayableBills.paidPaymentId, id))
        .run()

      // 3. 删除付款记录
      await tx.delete(rentalPayments).where(eq(rentalPayments.id, id)).run()
    })

    return payment
  }

  async generatePayableBills(userId?: string) {
    const now = Date.now()
    const today = new Date()
    const todayStr = getBusinessDate()

    const properties = await this.db
      .select()
      .from(rentalProperties)
      .where(
        and(
          eq(rentalProperties.status, 'active'),
          isNotNull(rentalProperties.leaseStartDate)
        )
      )
      .execute()

    const generated: any[] = []

    for (const prop of properties) {
      if (!prop.leaseStartDate || !prop.leaseEndDate) { continue }

      const leaseStart = new Date(prop.leaseStartDate)
      const leaseEnd = new Date(prop.leaseEndDate)
      const paymentPeriodMonths = prop.paymentPeriodMonths || 1
      const paymentDay = prop.paymentDay || 1

      let nextPaymentDate = new Date(leaseStart)

      while (nextPaymentDate <= today || nextPaymentDate.getDate() !== paymentDay) {
        if (nextPaymentDate <= today) {
          nextPaymentDate = new Date(nextPaymentDate)
          nextPaymentDate.setMonth(nextPaymentDate.getMonth() + paymentPeriodMonths)
          nextPaymentDate.setDate(paymentDay)
        } else {
          nextPaymentDate.setDate(paymentDay)
        }
      }

      if (nextPaymentDate > leaseEnd) { continue }

      const billDate = new Date(nextPaymentDate)
      billDate.setDate(billDate.getDate() - 15)
      const billDateStr = billDate.toISOString().split('T')[0]
      const dueDateStr = nextPaymentDate.toISOString().split('T')[0]

      if (billDateStr > todayStr) { continue }

      let amountCents = 0
      if (prop.rentType === 'yearly') {
        amountCents = Math.round((prop.yearlyRentCents || 0) / (12 / paymentPeriodMonths))
      } else {
        amountCents = Math.round((prop.monthlyRentCents || 0) * paymentPeriodMonths)
      }

      const existingBill = await this.db
        .select()
        .from(rentalPayableBills)
        .where(
          and(
            eq(rentalPayableBills.propertyId, prop.id),
            eq(rentalPayableBills.year, nextPaymentDate.getFullYear()),
            eq(rentalPayableBills.month, nextPaymentDate.getMonth() + 1),
            eq(rentalPayableBills.status, 'unpaid')
          )
        )
        .get()

      if (existingBill) { continue }

      const billId = uuid()
      await this.db
        .insert(rentalPayableBills)
        .values({
          id: billId,
          propertyId: prop.id,
          billDate: billDateStr,
          dueDate: dueDateStr,
          year: nextPaymentDate.getFullYear(),
          month: nextPaymentDate.getMonth() + 1,
          amountCents,
          currency: prop.currency,
          paymentPeriodMonths,
          status: 'unpaid',
          memo: `自动生成：${prop.name}（${prop.propertyCode}）`,
          createdBy: userId,
          createdAt: now,
          updatedAt: now,
        })
        .execute()

      generated.push({
        id: billId,
        propertyCode: prop.propertyCode,
        propertyName: prop.name,
        dueDate: dueDateStr,
        amountCents,
      })
    }

    return { generated: generated.length, bills: generated }
  }

  async listPayableBills(query: {
    propertyId?: string
    status?: string
    startDate?: string
    endDate?: string
  }) {
    const conditions = []
    if (query.propertyId) { conditions.push(eq(rentalPayableBills.propertyId, query.propertyId)) }
    if (query.status) { conditions.push(eq(rentalPayableBills.status, query.status)) }
    if (query.startDate) { conditions.push(gte(rentalPayableBills.dueDate, query.startDate)) }
    if (query.endDate) { conditions.push(lte(rentalPayableBills.dueDate, query.endDate)) }

    return await this.db
      .select({
        bill: rentalPayableBills,
        propertyCode: rentalProperties.propertyCode,
        propertyName: rentalProperties.name,
        propertyType: rentalProperties.propertyType,
        landlordName: rentalProperties.landlordName,
      })
      .from(rentalPayableBills)
      .leftJoin(rentalProperties, eq(rentalProperties.id, rentalPayableBills.propertyId))
      .where(and(...conditions))
      .orderBy(asc(rentalPayableBills.dueDate))
      .execute()
  }

  async markBillPaid(id: string) {
    const bill = await this.db
      .select()
      .from(rentalPayableBills)
      .where(eq(rentalPayableBills.id, id))
      .get()
    if (!bill) {
      throw Errors.NOT_FOUND('账单')
    }
    if (bill.status === 'paid') {
      throw Errors.BUSINESS_ERROR('账单已支付')
    }

    await this.db
      .update(rentalPayableBills)
      .set({
        status: 'paid',
        paidDate: getBusinessDate(),
        updatedAt: Date.now(),
      })
      .where(eq(rentalPayableBills.id, id))
      .execute()

    return { ok: true }
  }
}

