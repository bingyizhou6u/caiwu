import { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from '../../db/schema'
import { siteBills, sites, accounts, categories, currencies, employees } from '../../db/schema'
import { eq, desc, and } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import { Errors } from '../../utils/errors.js'

export class SiteBillService {
  constructor(private db: DrizzleD1Database<typeof schema>) {}

  async getById(id: string) {
    const rows = await this.db
      .select({
        bill: siteBills,
        siteName: sites.name,
        siteCode: sites.siteCode,
        accountName: accounts.name,
        categoryName: categories.name,
        currencyName: currencies.name,
        creatorName: employees.name,
      })
      .from(siteBills)
      .leftJoin(sites, eq(sites.id, siteBills.siteId))
      .leftJoin(accounts, eq(accounts.id, siteBills.accountId))
      .leftJoin(categories, eq(categories.id, siteBills.categoryId))
      .leftJoin(currencies, eq(currencies.code, siteBills.currency))
      .leftJoin(employees, eq(employees.id, siteBills.createdBy))
      .where(eq(siteBills.id, id))
      .limit(1)
      .execute()

    return rows[0] || null
  }

  async list(limit: number = 200, whereClause?: any) {
    return await this.db
      .select({
        bill: siteBills,
        siteName: sites.name,
        siteCode: sites.siteCode,
        accountName: accounts.name,
        categoryName: categories.name,
        currencyName: currencies.name,
        creatorName: employees.name,
      })
      .from(siteBills)
      .leftJoin(sites, eq(sites.id, siteBills.siteId))
      .leftJoin(accounts, eq(accounts.id, siteBills.accountId))
      .leftJoin(categories, eq(categories.id, siteBills.categoryId))
      .leftJoin(currencies, eq(currencies.code, siteBills.currency))
      .leftJoin(employees, eq(employees.id, siteBills.createdBy))
      .where(whereClause)
      .orderBy(desc(siteBills.billDate), desc(siteBills.createdAt))
      .limit(limit)
      .execute()
  }

  async create(data: {
    siteId: string
    billDate: string
    billType: string
    amountCents: number
    currency: string
    description?: string
    accountId?: string
    categoryId?: string
    status?: string
    paymentDate?: string
    memo?: string
    createdBy?: string
  }) {
    const id = uuid()
    const now = Date.now()
    await this.db
      .insert(siteBills)
      .values({
        id,
        siteId: data.siteId,
        billDate: data.billDate,
        billType: data.billType,
        amountCents: data.amountCents,
        currency: data.currency,
        description: data.description,
        accountId: data.accountId,
        categoryId: data.categoryId,
        status: data.status ?? 'pending',
        paymentDate: data.paymentDate,
        memo: data.memo,
        createdBy: data.createdBy,
        createdAt: now,
        updatedAt: now,
      })
      .execute()
    return { id }
  }

  async update(id: string, data: Partial<typeof siteBills.$inferInsert>) {
    const updates: any = { updatedAt: Date.now() }
    if (data.billDate !== undefined) {updates.billDate = data.billDate}
    if (data.billType !== undefined) {updates.billType = data.billType}
    if (data.amountCents !== undefined) {updates.amountCents = data.amountCents}
    if (data.currency !== undefined) {updates.currency = data.currency}
    if (data.description !== undefined) {updates.description = data.description}
    if (data.accountId !== undefined) {updates.accountId = data.accountId}
    if (data.categoryId !== undefined) {updates.categoryId = data.categoryId}
    if (data.status !== undefined) {updates.status = data.status}
    if (data.paymentDate !== undefined) {updates.paymentDate = data.paymentDate}
    if (data.memo !== undefined) {updates.memo = data.memo}

    await this.db.update(siteBills).set(updates).where(eq(siteBills.id, id)).execute()
    return { ok: true }
  }

  async delete(id: string) {
    await this.db.delete(siteBills).where(eq(siteBills.id, id)).execute()
    return { ok: true }
  }
}
