/**
 * 币种管理服务
 */

import { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from '../../db/schema.js'
import { currencies, accounts } from '../../db/schema.js'
import { eq, or, sql, like } from 'drizzle-orm'
import { Errors } from '../../utils/errors.js'

export class CurrencyService {
  constructor(private db: DrizzleD1Database<typeof schema>) {}

  async getCurrencies(search?: string) {
    const query = this.db.select().from(currencies).orderBy(currencies.code)
    if (search) {
      const likeStr = `%${search.toUpperCase()}%`
      query.where(
        or(
          like(sql<string>`upper(${currencies.code})`, likeStr),
          like(sql<string>`upper(${currencies.name})`, likeStr)
        )
      )
    }
    return query.all()
  }

  async createCurrency(data: { code: string; name: string }) {
    const code = data.code.toUpperCase()
    const existing = await this.db.query.currencies.findFirst({ where: eq(currencies.code, code) })
    if (existing) {
      throw Errors.DUPLICATE('币种代码')
    }

    await this.db
      .insert(currencies)
      .values({
        code,
        name: data.name,
        active: 1,
      })
      .execute()

    return { code, name: data.name }
  }

  async updateCurrency(code: string, data: { name?: string; active?: number }) {
    const codeUpper = code.toUpperCase()
    const updates: any = {}
    if (data.name !== undefined) {updates.name = data.name}
    if (data.active !== undefined) {updates.active = data.active}

    if (Object.keys(updates).length === 0) {return { ok: true }}

    await this.db.update(currencies).set(updates).where(eq(currencies.code, codeUpper)).execute()
    return { ok: true }
  }

  async deleteCurrency(code: string) {
    const codeUpper = code.toUpperCase()
    const currency = await this.db.query.currencies.findFirst({
      where: eq(currencies.code, codeUpper),
    })
    if (!currency) {
      throw Errors.NOT_FOUND('币种')
    }

    const accountCount = await this.db.$count(accounts, eq(accounts.currency, codeUpper))
    if (accountCount > 0) {
      throw Errors.BUSINESS_ERROR('无法删除，该币种还有账户使用')
    }

    await this.db.delete(currencies).where(eq(currencies.code, codeUpper)).execute()
    return { ok: true, name: currency.name }
  }
}

