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

export class FinanceService {
  constructor(private db: DrizzleD1Database<any>) {}

  // --- Cash Flows ---

  async getNextVoucherNo(date: string, tx?: any) {
    const db = tx || this.db
    const result = await db
      .select({ count: sql<number>`count(1)` })
      .from(cashFlows)
      .where(eq(cashFlows.bizDate, date))
      .get()

    const count = result?.count ?? 0
    const seq = (count + 1).toString().padStart(3, '0')
    const day = date.replace(/-/g, '')
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

    const account = await db.select().from(accounts).where(eq(accounts.id, accountId)).get()

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

    // 计算之前的余额
    const balanceBefore = await this.getAccountBalanceBefore(data.accountId, data.bizDate, now, db)
    
    // 检查账户余额（仅对支出类型）
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

  // --- Borrowings ---

  // --- Site Bills Logic moved to SiteBillService ---
}
