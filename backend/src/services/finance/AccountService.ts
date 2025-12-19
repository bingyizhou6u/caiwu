/**
 * 账户管理服务
 */

import { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from '../../db/schema.js'
import { accounts, currencies, accountTransactions, cashFlows, categories } from '../../db/schema.js'
import { eq, desc, sql, like, or, and } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import { Errors } from '../../utils/errors.js'

export class AccountService {
  constructor(private db: DrizzleD1Database<typeof schema>) {}

  async getAccounts(search?: string) {
    const query = this.db
      .select({
        id: accounts.id,
        name: accounts.name,
        type: accounts.type,
        currency: accounts.currency,
        alias: accounts.alias,
        accountNumber: accounts.accountNumber,
        openingCents: accounts.openingCents,
        active: accounts.active,
        currencyName: currencies.name,
      })
      .from(accounts)
      .leftJoin(currencies, eq(currencies.code, accounts.currency))
      .orderBy(accounts.name)

    if (search) {
      const likeStr = `%${search.toLowerCase()}%`
      query.where(
        or(
          like(sql<string>`lower(${accounts.name})`, likeStr),
          like(sql<string>`lower(coalesce(${accounts.alias}, ''))`, likeStr),
          like(sql<string>`lower(coalesce(${accounts.accountNumber}, ''))`, likeStr)
        )
      )
    }

    return query.all()
  }

  async getAccountTransactions(accountId: string, page: number = 1, pageSize: number = 20) {
    const offset = (page - 1) * pageSize

    const countResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(accountTransactions)
      .where(eq(accountTransactions.accountId, accountId))
      .get()

    const total = countResult?.count ?? 0

    const list = await this.db
      .select({
        id: accountTransactions.id,
        transactionDate: accountTransactions.transactionDate,
        transactionType: accountTransactions.transactionType,
        amountCents: accountTransactions.amountCents,
        balanceBeforeCents: accountTransactions.balanceBeforeCents,
        balanceAfterCents: accountTransactions.balanceAfterCents,
        createdAt: accountTransactions.createdAt,
        voucherNo: cashFlows.voucherNo,
        memo: cashFlows.memo,
        counterparty: cashFlows.counterparty,
        voucherUrl: cashFlows.voucherUrl,
        categoryName: categories.name,
      })
      .from(accountTransactions)
      .leftJoin(cashFlows, eq(cashFlows.id, accountTransactions.flowId))
      .leftJoin(categories, eq(categories.id, cashFlows.categoryId))
      .where(eq(accountTransactions.accountId, accountId))
      .orderBy(desc(accountTransactions.transactionDate), desc(accountTransactions.createdAt))
      .limit(pageSize)
      .offset(offset)
      .all()

    return { total, list }
  }

  async createAccount(data: {
    name: string
    type: string
    currency?: string
    alias?: string
    accountNumber?: string
    openingCents?: number
  }) {
    const currencyCode = (data.currency ?? 'CNY').trim().toUpperCase()
    const cur = await this.db.query.currencies.findFirst({
      where: and(eq(currencies.code, currencyCode), eq(currencies.active, 1)),
    })
    if (!cur) {
      throw Errors.NOT_FOUND(`币种 ${currencyCode
    }`)}

    const id = uuid()
    await this.db
      .insert(accounts)
      .values({
        id,
        name: data.name,
        type: data.type,
        currency: currencyCode,
        alias: data.alias,
        accountNumber: data.accountNumber,
        openingCents: data.openingCents ?? 0,
        active: 1,
      })
      .execute()

    return { id, ...data, currency: currencyCode }
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
    const updates: any = {}
    if (data.name !== undefined) {updates.name = data.name}
    if (data.type !== undefined) {updates.type = data.type}
    if (data.currency !== undefined) {
      const code = data.currency.trim().toUpperCase()
      const cur = await this.db.query.currencies.findFirst({
        where: and(eq(currencies.code, code), eq(currencies.active, 1)),
      })
      if (!cur) {
        throw Errors.NOT_FOUND(`币种 ${code
    }`)}
      updates.currency = code
    }
    if (data.alias !== undefined) {updates.alias = data.alias}
    if (data.accountNumber !== undefined) {updates.accountNumber = data.accountNumber}
    if (data.active !== undefined) {updates.active = data.active}

    if (Object.keys(updates).length === 0) {throw Errors.VALIDATION_ERROR('没有需要更新的字段')}

    await this.db.update(accounts).set(updates).where(eq(accounts.id, id)).execute()
    return { ok: true }
  }

  async deleteAccount(id: string) {
    const account = await this.db.query.accounts.findFirst({ where: eq(accounts.id, id) })
    if (!account) {
      throw Errors.NOT_FOUND('账户')
    }

    const flowCount = await this.db.$count(cashFlows, eq(cashFlows.accountId, id))
    if (flowCount > 0) {
      throw Errors.BUSINESS_ERROR('无法删除，该账户还有流水记录')
    }

    await this.db.delete(accounts).where(eq(accounts.id, id)).execute()
    return { ok: true, name: account.name }
  }
}

