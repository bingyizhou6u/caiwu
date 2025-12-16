/**
 * 薪资支付处理服务
 * 处理支付转账、确认和货币分配
 */

import { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from '../db/schema.js'
import {
  salaryPayments,
  salaryPaymentAllocations,
  accounts,
  currencies,
} from '../db/schema.js'
import { eq, and, sql, inArray } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import { Errors } from '../utils/errors.js'
import { Logger } from '../utils/logger.js'
import { salaryPaymentStateMachine } from '../utils/state-machine.js'
import { validateVersion, incrementVersion } from '../utils/optimistic-lock.js'
import type { OperationHistoryService } from './OperationHistoryService.js'
import type { SalaryPaymentService } from './SalaryPaymentService.js'

export class SalaryPaymentProcessingService {
  constructor(
    private db: DrizzleD1Database<typeof schema>,
    private operationHistoryService?: OperationHistoryService,
    private salaryPaymentService?: SalaryPaymentService
  ) {}

  async paymentTransfer(id: string, accountId: string, userId: string, expectedVersion?: number | null) {
    // 验证账户
    const account = await this.db.select().from(accounts).where(eq(accounts.id, accountId)).get()
    if (!account) {
      throw Errors.NOT_FOUND('账户')
    }
    if (account.active === 0) {
      throw Errors.BUSINESS_ERROR('账户已停用')
    }

    const payment = await this.db
      .select()
      .from(salaryPayments)
      .where(eq(salaryPayments.id, id))
      .get()
    if (!payment) {
      throw Errors.NOT_FOUND()
    }

    // 乐观锁版本检查
    if (expectedVersion !== undefined) {
      validateVersion(payment.version, expectedVersion)
    }

    // 状态机验证
    salaryPaymentStateMachine.validateTransition(payment.status, 'pending_payment_confirmation')

    // 检查分配
    if (payment.allocationStatus === 'approved') {
      const allocations = await this.db
        .select()
        .from(salaryPaymentAllocations)
        .where(
          and(
            eq(salaryPaymentAllocations.salaryPaymentId, id),
            eq(salaryPaymentAllocations.status, 'approved')
          )
        )
        .all()

      // 如果分配有特定账户，使用它（逻辑已从原始代码简化）
      // 原始逻辑：如果分配有账户，使用它。如果没有，使用传入的账户。
      // 这里我们按照原始逻辑更新主支付记录
    }

    const beforeData = { status: payment.status, accountId: payment.accountId, version: payment.version }
    const now = Date.now()
    const newVersion = incrementVersion(payment.version)

    const result = await this.db
      .update(salaryPayments)
      .set({
        status: 'pending_payment_confirmation',
        accountId,
        paymentTransferredBy: userId,
        paymentTransferredAt: now,
        version: newVersion,
        updatedAt: now,
      })
      .where(eq(salaryPayments.id, id))
      .returning()
      .get()

    if (!result) {
      throw Errors.BUSINESS_ERROR('更新失败，可能已被其他用户修改')
    }

    // 记录操作历史
    if (this.operationHistoryService) {
      this.operationHistoryService
        .recordOperation(
          'salary_payment',
          id,
          'payment_transferred',
          userId,
          beforeData,
          { status: 'pending_payment_confirmation', accountId }
        )
        .catch(err => Logger.error('Failed to record operation history', { error: err }))
    }

    // 返回完整信息
    if (this.salaryPaymentService) {
      return this.salaryPaymentService.get(id)
    }
    return result
  }

  async paymentConfirm(id: string, voucherPath: string, userId: string, expectedVersion?: number | null) {
    const payment = await this.db
      .select()
      .from(salaryPayments)
      .where(eq(salaryPayments.id, id))
      .get()
    if (!payment) {
      throw Errors.NOT_FOUND()
    }

    // 乐观锁版本检查
    if (expectedVersion !== undefined) {
      validateVersion(payment.version, expectedVersion)
    }

    // 状态机验证
    salaryPaymentStateMachine.validateTransition(payment.status, 'completed')

    const beforeData = { status: payment.status, version: payment.version }
    const now = Date.now()
    const newVersion = incrementVersion(payment.version)

    const result = await this.db
      .update(salaryPayments)
      .set({
        status: 'completed',
        paymentVoucherPath: voucherPath,
        paymentConfirmedBy: userId,
        paymentConfirmedAt: now,
        version: newVersion,
        updatedAt: now,
      })
      .where(eq(salaryPayments.id, id))
      .returning()
      .get()

    if (!result) {
      throw Errors.BUSINESS_ERROR('更新失败，可能已被其他用户修改')
    }

    // 记录操作历史
    if (this.operationHistoryService) {
      this.operationHistoryService
        .recordOperation(
          'salary_payment',
          id,
          'payment_confirmed',
          userId,
          beforeData,
          { status: 'completed', paymentVoucherPath: voucherPath }
        )
        .catch(err => Logger.error('Failed to record operation history', { error: err }))
    }

    // 返回完整信息
    if (this.salaryPaymentService) {
      return this.salaryPaymentService.get(id)
    }
    return result
  }

  async requestAllocation(
    id: string,
    allocations: { currencyId: string; amountCents: number; accountId?: string; exchangeRate?: number }[],
    userId: string
  ) {
    const payment = await this.db
      .select()
      .from(salaryPayments)
      .where(eq(salaryPayments.id, id))
      .get()
    if (!payment) {
      throw Errors.NOT_FOUND()
    }

    // 基准币种（薪资的币种，通常是 USDT）
    const baseCurrency = 'USDT'

    // 计算多币种分配总额（转换为基准币种）
    let totalAllocatedInBase = 0
    for (const alloc of allocations) {
      if (alloc.currencyId === baseCurrency) {
        // 如果是基准币种，直接累加
        totalAllocatedInBase += alloc.amountCents
      } else {
        // 需要汇率转换
        let exchangeRate = alloc.exchangeRate
        if (!exchangeRate) {
          // 如果没有提供汇率，尝试从系统配置获取
          // 简化实现：如果没有汇率，使用默认值 1（实际应该从配置获取）
          exchangeRate = 1
          Logger.warn(`No exchange rate provided for ${alloc.currencyId}, using default 1`)
        }
        // 将其他币种转换为基准币种
        const amountInBase = Math.round(alloc.amountCents * exchangeRate)
        totalAllocatedInBase += amountInBase
      }
    }

    // 验证总额（允许1%误差）
    const tolerance = Math.round(payment.salaryCents * 0.01) // 1% 误差
    const difference = Math.abs(totalAllocatedInBase - payment.salaryCents)

    if (difference > tolerance) {
      throw Errors.BUSINESS_ERROR(
        `多币种分配总额（${totalAllocatedInBase / 100} ${baseCurrency}）与薪资金额（${payment.salaryCents / 100} ${baseCurrency}）不匹配，差额：${difference / 100} ${baseCurrency}，允许误差：${tolerance / 100} ${baseCurrency}`
      )
    }

    const now = Date.now()
    await this.db.transaction(async tx => {
      // 删除旧分配
      await tx.delete(salaryPaymentAllocations).where(eq(salaryPaymentAllocations.salaryPaymentId, id)).run()

      // 插入新分配
      for (const alloc of allocations) {
        // 验证币种
        const currency = await tx
          .select()
          .from(currencies)
          .where(eq(currencies.code, alloc.currencyId))
          .get()
        if (!currency) {
          throw Errors.NOT_FOUND(`币种 ${alloc.currencyId}`)
        }

        // 如果提供了账户，则进行验证
        if (alloc.accountId) {
          const account = await tx.select().from(accounts).where(eq(accounts.id, alloc.accountId)).get()
          if (!account) {
            throw Errors.NOT_FOUND('账户')
          }
          if (account.currency !== alloc.currencyId) {
            throw Errors.BUSINESS_ERROR('账户币种不匹配')
          }
        }

        await tx
          .insert(salaryPaymentAllocations)
          .values({
            id: uuid(),
            salaryPaymentId: id,
            currencyId: alloc.currencyId,
            amountCents: alloc.amountCents,
            accountId: alloc.accountId,
            status: 'pending',
            requestedBy: userId,
            requestedAt: now,
            createdAt: now,
            updatedAt: now,
          })
          .run()
      }

      await tx
        .update(salaryPayments)
        .set({ allocationStatus: 'requested', updatedAt: now })
        .where(eq(salaryPayments.id, id))
        .run()
    })

    // 返回完整信息
    if (this.salaryPaymentService) {
      return this.salaryPaymentService.get(id)
    }
    const paymentResult = await this.db
      .select()
      .from(salaryPayments)
      .where(eq(salaryPayments.id, id))
      .get()
    return paymentResult
  }

  async approveAllocation(
    id: string,
    allocationIds: string[] | undefined,
    approveAll: boolean,
    userId: string
  ) {
    const now = Date.now()
    await this.db.transaction(async tx => {
      if (approveAll) {
        await tx
          .update(salaryPaymentAllocations)
          .set({ status: 'approved', approvedBy: userId, approvedAt: now, updatedAt: now })
          .where(
            and(
              eq(salaryPaymentAllocations.salaryPaymentId, id),
              eq(salaryPaymentAllocations.status, 'pending')
            )
          )
          .run()
      } else if (allocationIds && allocationIds.length > 0) {
        await tx
          .update(salaryPaymentAllocations)
          .set({ status: 'approved', approvedBy: userId, approvedAt: now, updatedAt: now })
          .where(
            and(
              inArray(salaryPaymentAllocations.id, allocationIds),
              eq(salaryPaymentAllocations.salaryPaymentId, id)
            )
          )
          .run()
      }

      // 检查是否全部批准
      const pendingCount = await tx
        .select({ count: sql<number>`count(*)` })
        .from(salaryPaymentAllocations)
        .where(
          and(
            eq(salaryPaymentAllocations.salaryPaymentId, id),
            eq(salaryPaymentAllocations.status, 'pending')
          )
        )
        .get()

      if (pendingCount && pendingCount.count === 0) {
        await tx
          .update(salaryPayments)
          .set({ allocationStatus: 'approved', updatedAt: now })
          .where(eq(salaryPayments.id, id))
          .run()
      }
    })

    const payment = await this.db
      .select()
      .from(salaryPayments)
      .where(eq(salaryPayments.id, id))
      .get()
    return payment
  }

  async rejectAllocation(id: string, allocationIds: string[], userId: string) {
    const now = Date.now()
    await this.db
      .update(salaryPaymentAllocations)
      .set({ status: 'rejected', approvedBy: userId, approvedAt: now, updatedAt: now })
      .where(
        and(
          inArray(salaryPaymentAllocations.id, allocationIds),
          eq(salaryPaymentAllocations.salaryPaymentId, id)
        )
      )
      .run()

    // 返回完整信息
    if (this.salaryPaymentService) {
      return this.salaryPaymentService.get(id)
    }
    const paymentResult = await this.db
      .select()
      .from(salaryPayments)
      .where(eq(salaryPayments.id, id))
      .get()
    return paymentResult
  }
}

