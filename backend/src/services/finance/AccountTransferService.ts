import { DrizzleD1Database } from 'drizzle-orm/d1'
import { eq, desc, inArray } from 'drizzle-orm'
import { accountTransfers, accounts, accountTransactions } from '../../db/schema.js'
import { v4 as uuid } from 'uuid'
import { FinanceService } from './FinanceService.js'
import { getByIds } from '../../utils/query-helpers.js'
import type { Context } from 'hono'
import type { Env, AppVariables } from '../../types/index.js'

export class AccountTransferService {
  constructor(
    private db: DrizzleD1Database<any>,
    private financeService: FinanceService
  ) { }

  async list(limit: number = 200, whereClause?: any) {
    const transfers = await this.db
      .select()
      .from(accountTransfers)
      .where(whereClause)
      .orderBy(desc(accountTransfers.transferDate), desc(accountTransfers.createdAt))
      .limit(limit)
      .execute()

    const accountIds = new Set<string>()
    transfers.forEach(t => {
      accountIds.add(t.fromAccountId)
      accountIds.add(t.toAccountId)
    })

    // 使用批量查询优化
    const accountsList = await getByIds<typeof accounts.$inferSelect>(
      this.db,
      accounts,
      Array.from(accountIds),
      'AccountTransferService.list.getAccounts',
      { batchSize: 100, parallel: true },
      undefined
    )
    const accountMap = new Map(accountsList.map(a => [a.id, a]))

    return transfers.map(t => ({
      transfer: t,
      fromAccountName: accountMap.get(t.fromAccountId)?.name || null,
      fromAccountCurrency: accountMap.get(t.fromAccountId)?.currency || null,
      toAccountName: accountMap.get(t.toAccountId)?.name || null,
      toAccountCurrency: accountMap.get(t.toAccountId)?.currency || null,
    }))
  }

  async create(data: {
    transferDate: string
    fromAccountId: string
    toAccountId: string
    fromAmountCents: number
    toAmountCents: number
    exchangeRate?: number
    memo?: string
    voucherUrls?: string[]
    createdBy?: string
  }) {
    const id = uuid()
    const now = Date.now()
    const voucherUrlJson = JSON.stringify(data.voucherUrls ?? [])

    // 1. 创建转账记录
    await this.db
      .insert(accountTransfers)
      .values({
        id,
        transferDate: data.transferDate,
        fromAccountId: data.fromAccountId,
        toAccountId: data.toAccountId,
        fromCurrency: (await this.financeService.getAccountCurrency(data.fromAccountId)) || 'CNY',
        toCurrency: (await this.financeService.getAccountCurrency(data.toAccountId)) || 'CNY',
        fromAmountCents: data.fromAmountCents,
        toAmountCents: data.toAmountCents,
        exchangeRate: data.exchangeRate,
        memo: data.memo,
        voucherUrl: voucherUrlJson,
        createdBy: data.createdBy,
        createdAt: now,
      })
      .execute()

    // 2. 创建转出账户交易 (Out) - Needs access to getAccountBalanceBefore
    const fromBalanceBefore = await this.financeService.getAccountBalanceBefore(
      data.fromAccountId,
      data.transferDate,
      now
    )
    const fromBalanceAfter = fromBalanceBefore - data.fromAmountCents
    await this.db
      .insert(accountTransactions)
      .values({
        id: uuid(),
        accountId: data.fromAccountId,
        flowId: id, // 关联到转账 ID
        transactionDate: data.transferDate,
        transactionType: 'transfer_out',
        amountCents: -data.fromAmountCents,
        balanceBeforeCents: fromBalanceBefore,
        balanceAfterCents: fromBalanceAfter,
        createdAt: now,
      })
      .execute()

    // 3. 创建转入账户交易 (In)
    const toBalanceBefore = await this.financeService.getAccountBalanceBefore(
      data.toAccountId,
      data.transferDate,
      now
    )
    const toBalanceAfter = toBalanceBefore + data.toAmountCents
    await this.db
      .insert(accountTransactions)
      .values({
        id: uuid(),
        accountId: data.toAccountId,
        flowId: id, // 关联到转账 ID
        transactionDate: data.transferDate,
        transactionType: 'transfer_in',
        amountCents: data.toAmountCents,
        balanceBeforeCents: toBalanceBefore,
        balanceAfterCents: toBalanceAfter,
        createdAt: now,
      })
      .execute()

    return { id }
  }

  async getById(id: string) {
    const transfer = await this.db
      .select()
      .from(accountTransfers)
      .where(eq(accountTransfers.id, id))
      .get()
    if (!transfer) { return null }

    const [fromAccount, toAccount] = await Promise.all([
      this.db.select().from(accounts).where(eq(accounts.id, transfer.fromAccountId)).get(),
      this.db.select().from(accounts).where(eq(accounts.id, transfer.toAccountId)).get(),
    ])

    return {
      transfer,
      fromAccountName: fromAccount?.name || null,
      fromAccountCurrency: fromAccount?.currency || null,
      toAccountName: toAccount?.name || null,
      toAccountCurrency: toAccount?.currency || null,
    }
  }
}
