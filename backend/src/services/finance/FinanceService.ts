import { DrizzleD1Database } from 'drizzle-orm/d1'
import { eq, and, desc, sql, inArray, gte, lte, aliasedTable } from 'drizzle-orm'
import {
  cashFlows,
  accountTransactions,
  accounts,
  categories,
  sites,
  departments,
  borrowings,
  repayments,
  siteBills,
  employees,
  currencies,
} from '../db/schema.js'
import { uuid } from '../utils/db.js'
import { Errors, createError } from '../utils/errors.js'
import { ErrorCodes } from '../constants/errorCodes.js'
import { query } from '../utils/query-helpers.js'
import type { Context } from 'hono'
import type { Env, AppVariables } from '../types.js'

export class FinanceService {
  constructor(private db: DrizzleD1Database<any>) { }

  // --- Cash Flows ---

  async getNextVoucherNo(date: string, tx?: any) {
    const db = tx || this.db
    // 提取日期部分（支持 'YYYY-MM-DD' 或 'YYYY-MM-DD HH:mm:ss' 格式）
    const dateOnly = date.substring(0, 10)
    const result = await db
      .select({ count: sql<number>`count(1)` })
      .from(cashFlows)
      .where(sql`substr(${cashFlows.bizDate}, 1, 10) = ${dateOnly}`)
      .get()

    const count = result?.count ?? 0
    const seq = (count + 1).toString().padStart(3, '0')
    const day = dateOnly.replace(/-/g, '')
    return `JZ${day}-${seq}`
  }

  async getAccountBalanceBefore(accountId: string, date: string, timestamp: number, tx?: any) {
    // 查找此日期/时间之前的最后一笔交易
    // 逻辑：transaction_date < date OR (transaction_date = date AND created_at < timestamp)
    // 按 transaction_date 降序, created_at 降序排列，取第一条
    // 如果找到，返回 balance_after_cents。如果未找到，返回 opening_cents。

    const db = tx || this.db
    const lastTx = await db
      .select()
      .from(accountTransactions)
      .where(
        and(
          eq(accountTransactions.accountId, accountId),
          sql`(${accountTransactions.transactionDate} < ${date} OR (${accountTransactions.transactionDate} = ${date} AND ${accountTransactions.createdAt} < ${timestamp}))`
        )
      )
      .orderBy(desc(accountTransactions.transactionDate), desc(accountTransactions.createdAt))
      .limit(1)
      .get()

    if (lastTx) {
      return lastTx.balanceAfterCents
    }

    const account = await query(
      db as any,
      'FinanceService.getAccountBalanceBefore.getAccount',
      () => db.select().from(accounts).where(eq(accounts.id, accountId)).get(),
      undefined // 方法签名中没有 Context
    )

    return account?.openingCents ?? 0
  }

  async createCashFlow(
    data: {
      bizDate: string
      type: 'income' | 'expense'
      accountId: string
      amountCents: number
      categoryId?: string | null
      method?: string | null
      siteId?: string | null
      departmentId?: string | null
      counterparty?: string | null
      memo?: string | null
      voucherUrls?: string[]
      createdBy?: string
      voucherNo?: string
    },
    tx?: any
  ) {
    const db = tx || this.db
    const id = uuid()
    const now = Date.now()
    const voucherNo = data.voucherNo ?? (await this.getNextVoucherNo(data.bizDate, db))
    const voucherUrlJson = JSON.stringify(data.voucherUrls ?? [])

    // 1. 获取账户当前余额和版本号 (Explicitly get version for Optimistic Locking)
    const account = await db
      .select({
        openingCents: accounts.openingCents,
        version: accounts.version
      })
      .from(accounts)
      .where(eq(accounts.id, data.accountId))
      .get()

    if (!account) {
      throw createError(404, ErrorCodes.BUS_NOT_FOUND, '账户不存在')
    }

    // 计算之前的余额 (Logic remains mostly same, but we rely on transactions for history)
    // Note: getAccountBalanceBefore checks history. If no history, it uses account.openingCents.
    // However, strictly speaking for "current" balance to update, we should calculate from ALL transactions 
    // OR if we maintain a "current_balance" field on account (we don't seems to).
    // The previous logic was: `balanceBefore = await this.getAccountBalanceBefore(...)`
    // This looks at *history*. Use that for the *record* in transaction history.
    // BUT for checking "sufficient balance" effectively, we need the *latest* state.

    // PROBLEM: The system doesn't store "currentBalance" on the account table? 
    // Let's check schema for `accounts`.
    // Schema: `accounts` has `openingCents`, `active`, `version`. NO `currentBalanceCents`.
    // This means balance is *always* calculated on the fly or openingCents is the only "base".
    // IF balance is calculated on the fly from `accountTransactions`, then updates to `accounts` table 
    // won't prevent race conditions on *balance calculation* if we don't lock the `accountTransactions` table 
    // or use a serialized transaction.
    // Wait, the audit report said: "In createCashFlow ... calculates new balance ... and updates".
    // I need to check WHERE it updates.
    // The previous code verified: 
    //   await db.insert(accountTransactions).values(...)
    // It DOES NOT update `accounts` table with a new balance?
    // Let's re-read the `FinanceService.ts` code I saw earlier.

    /*
      const balanceBefore = await this.getAccountBalanceBefore(data.accountId, data.bizDate, now, db)
      ...
      const balanceAfter = balanceBefore + delta
      
      await db.insert(cashFlows)...
      await db.insert(accountTransactions)...
    */

    // IT DOES NOT UPDATE THE ACCOUNT TABLE BALANCE! 
    // So `accounts` table `version` field is useless for this specific race condition 
    // UNLESS we force a dummy update on `accounts` to act as a mutex.
    // Yes, that is the standard pattern when you don't store computed fields but need serialization.
    // We will update `accounts.version` to `version + 1`. 
    // If that fails, someone else inserted a flow in parallel.

    // 2. 乐观锁检查: 尝试更新 account version
    // 这充当了一个 "Mutex"，确保同一账户的交易是串行写入的 (至少在并发冲突时会失败)
    const updateResult = await db
      .update(accounts)
      .set({
        version: (account.version || 0) + 1,
        // D1/SQLite specific: ensuring we have a change
      })
      .where(and(eq(accounts.id, data.accountId), eq(accounts.version, account.version || 0)))
      .run()

    // @ts-ignore - D1 result handling
    if (updateResult.meta.changes === 0) {
      throw createError(
        409, // Conflict
        ErrorCodes.BUS_CONCURRENT_MODIFICATION,
        '账户状态已更变（并发冲突），请重试',
        { accountId: data.accountId }
      )
    }

    // 3. 重新计算余额 (Now we 'locked' the account virtually)
    // 注意: 由于我们刚刚"锁定"了版本号，此刻计算的 balanceBefore 应该是安全的，
    // 前提是所有修改都会经过这个锁。
    const balanceBefore = await this.getAccountBalanceBefore(data.accountId, data.bizDate, now, db)

    // 检查余额 (仅支出)
    if (data.type === 'expense') {
      if (balanceBefore < data.amountCents) {
        throw createError(
          400,
          ErrorCodes.BUSINESS_INSUFFICIENT_BALANCE,
          '账户余额不足',
          {
            accountId: data.accountId,
            balance: balanceBefore,
            required: data.amountCents,
          }
        )
      }
    }

    const delta = data.type === 'income' ? data.amountCents : -data.amountCents
    const balanceAfter = balanceBefore + delta

    await db
      .insert(cashFlows)
      .values({
        id,
        voucherNo,
        bizDate: data.bizDate,
        type: data.type,
        accountId: data.accountId,
        categoryId: data.categoryId,
        method: data.method,
        amountCents: data.amountCents,
        siteId: data.siteId,
        departmentId: data.departmentId,
        counterparty: data.counterparty,
        memo: data.memo,
        voucherUrl: voucherUrlJson,
        createdBy: data.createdBy ?? 'system',
        createdAt: now,
      })
      .execute()

    const transactionId = uuid()
    await db
      .insert(accountTransactions)
      .values({
        id: transactionId,
        accountId: data.accountId,
        flowId: id,
        transactionDate: data.bizDate,
        transactionType: data.type,
        amountCents: data.amountCents,
        balanceBeforeCents: balanceBefore,
        balanceAfterCents: balanceAfter,
        createdAt: now,
      })
      .execute()

    return { id, voucherNo }
  }

  async updateCashFlowVoucher(id: string, voucherUrls: string[], tx?: any) {
    const db = tx || this.db
    const voucherUrlJson = JSON.stringify(voucherUrls)
    await db
      .update(cashFlows)
      .set({ voucherUrl: voucherUrlJson })
      .where(eq(cashFlows.id, id))
      .execute()
  }

  async listCashFlows(page: number = 1, pageSize: number = 20, whereClause?: any) {
    const offset = (page - 1) * pageSize

    const countResult = await this.db
      .select({ count: sql<number>`count(1)` })
      .from(cashFlows)
      .where(whereClause)
      .get()

    const total = countResult?.count ?? 0

    const list = await this.db
      .select({
        flow: cashFlows,
        accountName: accounts.name,
        categoryName: categories.name,
      })
      .from(cashFlows)
      .leftJoin(accounts, eq(accounts.id, cashFlows.accountId))
      .leftJoin(categories, eq(categories.id, cashFlows.categoryId))
      .where(whereClause)
      .orderBy(desc(cashFlows.bizDate), desc(cashFlows.createdAt))
      .limit(pageSize)
      .offset(offset)
      .all()

    return { total, list }
  }

  async getAccountCurrency(accountId: string) {
    const account = await this.db
      .select({ currency: accounts.currency })
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .get()
    return account?.currency
  }

  /**
   * 红冲流水 - 生成反向记账记录
   * @param originalFlowId 原始流水ID
   * @param data 冲正数据（包含原因和操作人）
   * @returns 红冲记录信息
   */
  async reverseFlow(
    originalFlowId: string,
    data: {
      reversalReason: string // 冲正原因（必填）
      createdBy: string
    }
  ) {
    return await this.db.transaction(async tx => {
      // 1. 查找原始流水
      const originalFlow = await tx
        .select()
        .from(cashFlows)
        .where(eq(cashFlows.id, originalFlowId))
        .get()

      if (!originalFlow) {
        throw createError(404, ErrorCodes.BUS_NOT_FOUND, '原始流水不存在')
      }

      // 2. 检查是否已被冲正
      if (originalFlow.isReversed === 1) {
        throw createError(
          400,
          ErrorCodes.BUSINESS_ERROR,
          '该流水已被冲正，不能重复操作',
          { reversedByFlowId: originalFlow.reversedByFlowId }
        )
      }

      // 3. 检查是否为红冲记录（红冲记录不能再被冲正）
      if (originalFlow.isReversal === 1) {
        throw createError(
          400,
          ErrorCodes.BUSINESS_ERROR,
          '红冲记录不能再次冲正',
          { originalFlowId: originalFlow.reversalOfFlowId }
        )
      }

      // 4. 生成红冲记录
      const reversalId = uuid()
      const now = Date.now()
      const reversalDate = new Date().toISOString().split('T')[0]
      const reversalVoucherNo = await this.getNextVoucherNo(reversalDate, tx)

      // 红冲记录：收入变支出，支出变收入（金额相同）
      const reversalType = originalFlow.type === 'income' ? 'expense' : 'income'

      // 5. 获取账户余额并创建红冲流水
      const account = await tx
        .select({
          openingCents: accounts.openingCents,
          version: accounts.version,
        })
        .from(accounts)
        .where(eq(accounts.id, originalFlow.accountId))
        .get()

      if (!account) {
        throw createError(404, ErrorCodes.BUS_NOT_FOUND, '账户不存在')
      }

      // 6. 乐观锁更新账户版本
      const updateResult = await tx
        .update(accounts)
        .set({ version: (account.version || 0) + 1 })
        .where(and(eq(accounts.id, originalFlow.accountId), eq(accounts.version, account.version || 0)))
        .run()

      // @ts-ignore - D1 result handling
      if (updateResult.meta.changes === 0) {
        throw createError(
          409,
          ErrorCodes.BUS_CONCURRENT_MODIFICATION,
          '账户状态已更变（并发冲突），请重试',
          { accountId: originalFlow.accountId }
        )
      }

      // 7. 计算余额
      const balanceBefore = await this.getAccountBalanceBefore(
        originalFlow.accountId,
        reversalDate,
        now,
        tx
      )

      const delta = reversalType === 'income' ? originalFlow.amountCents : -originalFlow.amountCents
      const balanceAfter = balanceBefore + delta

      // 8. 插入红冲流水记录
      const voucherUrlJson = originalFlow.voucherUrl || JSON.stringify([])
      await tx
        .insert(cashFlows)
        .values({
          id: reversalId,
          voucherNo: reversalVoucherNo,
          bizDate: reversalDate,
          type: reversalType,
          accountId: originalFlow.accountId,
          categoryId: originalFlow.categoryId,
          method: originalFlow.method,
          amountCents: originalFlow.amountCents,
          siteId: originalFlow.siteId,
          departmentId: originalFlow.departmentId,
          counterparty: originalFlow.counterparty,
          memo: `【红冲】原凭证号:${originalFlow.voucherNo} | 冲正原因:${data.reversalReason}`,
          voucherUrl: voucherUrlJson,
          createdBy: data.createdBy,
          createdAt: now,
          // 红冲标记
          isReversal: 1,
          reversalOfFlowId: originalFlowId,
          isReversed: 0,
          reversedByFlowId: null,
        })
        .execute()

      // 9. 创建账户交易记录
      const transactionId = uuid()
      await tx
        .insert(accountTransactions)
        .values({
          id: transactionId,
          accountId: originalFlow.accountId,
          flowId: reversalId,
          transactionDate: reversalDate,
          transactionType: reversalType,
          amountCents: originalFlow.amountCents,
          balanceBeforeCents: balanceBefore,
          balanceAfterCents: balanceAfter,
          createdAt: now,
        })
        .execute()

      // 10. 标记原始流水已被冲正
      await tx
        .update(cashFlows)
        .set({
          isReversed: 1,
          reversedByFlowId: reversalId,
        })
        .where(eq(cashFlows.id, originalFlowId))
        .execute()

      return {
        ok: true,
        reversalId,
        reversalVoucherNo,
        originalVoucherNo: originalFlow.voucherNo,
      }
    })
  }

  // --- Borrowings ---

  // --- Site Bills Logic moved to SiteBillService ---
}
