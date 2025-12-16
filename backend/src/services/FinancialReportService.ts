/**
 * 财务报表服务
 * 处理财务相关的报表：AR/AP、费用、账户余额、借款
 */

import { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from '../db/schema.js'
import {
  arApDocs,
  cashFlows,
  accounts,
  categories,
  departments,
  sites,
  borrowings,
  repayments,
  employees,
} from '../db/schema.js'
import { sql, eq, and, gte, lte, desc, inArray } from 'drizzle-orm'

export class FinancialReportService {
  constructor(
    private db: DrizzleD1Database<typeof schema>,
    private kv: KVNamespace
  ) {}

  async getArApSummary(kind: 'AR' | 'AP', start: string, end: string, departmentId?: string) {
    const conditions = [
      eq(arApDocs.kind, kind),
      gte(arApDocs.issueDate, start),
      lte(arApDocs.issueDate, end),
    ]
    if (departmentId) {
      conditions.push(eq(arApDocs.departmentId, departmentId))
    }

    const docs = await this.db
      .select({
        doc: arApDocs,
        settled_cents: sql<number>`coalesce((select sum(settle_amount_cents) from settlements where doc_id=${arApDocs.id}), 0)`,
      })
      .from(arApDocs)
      .where(and(...conditions))
      .all()

    let total = 0
    let settled = 0
    const byStatus: Record<string, number> = {}

    const rows = docs.map(d => {
      total += d.doc.amountCents
      settled += d.settled_cents
      const status = d.doc.status || 'unknown'
      byStatus[status] = (byStatus[status] || 0) + d.doc.amountCents
      return { ...d.doc, settledCents: d.settled_cents }
    })

    return { totalCents: total, settledCents: settled, byStatus: byStatus, rows }
  }

  async getArApDetail(kind: 'AR' | 'AP', start: string, end: string, departmentId?: string) {
    const conditions = [
      eq(arApDocs.kind, kind),
      gte(arApDocs.issueDate, start),
      lte(arApDocs.issueDate, end),
    ]
    if (departmentId) {
      conditions.push(eq(arApDocs.departmentId, departmentId))
    }

    const rows = await this.db
      .select({
        doc: arApDocs,
        settled_cents: sql<number>`coalesce((select sum(settle_amount_cents) from settlements where doc_id=${arApDocs.id}), 0)`,
      })
      .from(arApDocs)
      .where(and(...conditions))
      .all()

    return { rows: rows.map(r => ({ ...r.doc, settledCents: r.settled_cents })) }
  }

  async getExpenseSummary(start: string, end: string, departmentId?: string) {
    const conditions = [
      eq(cashFlows.type, 'expense'),
      gte(cashFlows.bizDate, start),
      lte(cashFlows.bizDate, end),
    ]
    if (departmentId) {
      conditions.push(eq(cashFlows.departmentId, departmentId))
    }

    const rows = await this.db
      .select({
        category_id: categories.id,
        category_name: categories.name,
        kind: categories.kind,
        total_cents: sql<number>`coalesce(sum(${cashFlows.amountCents}), 0)`
          .mapWith(Number)
          .as('total_cents'),
        count: sql<number>`count(*)`,
      })
      .from(categories)
      .leftJoin(cashFlows, and(eq(cashFlows.categoryId, categories.id), ...conditions))
      .where(eq(categories.kind, 'expense'))
      .groupBy(categories.id, categories.name, categories.kind)
      .orderBy(desc(sql`total_cents`))
      .all()

    return {
      rows: rows.map(r => ({
        categoryId: r.category_id,
        categoryName: r.category_name,
        kind: r.kind,
        totalCents: r.total_cents,
        count: r.count,
      })),
    }
  }

  async getExpenseDetail(start: string, end: string, categoryId?: string, departmentId?: string) {
    const conditions = [
      eq(cashFlows.type, 'expense'),
      gte(cashFlows.bizDate, start),
      lte(cashFlows.bizDate, end),
    ]
    if (categoryId) {
      conditions.push(eq(cashFlows.categoryId, categoryId))
    }
    if (departmentId) {
      conditions.push(eq(cashFlows.departmentId, departmentId))
    }

    const rows = await this.db
      .select({
        flow: cashFlows,
        account_name: accounts.name,
        account_currency: accounts.currency,
        category_name: categories.name,
        department_name: departments.name,
        site_name: sites.name,
      })
      .from(cashFlows)
      .leftJoin(accounts, eq(accounts.id, cashFlows.accountId))
      .leftJoin(categories, eq(categories.id, cashFlows.categoryId))
      .leftJoin(departments, eq(departments.id, cashFlows.departmentId))
      .leftJoin(sites, eq(sites.id, cashFlows.siteId))
      .where(and(...conditions))
      .orderBy(desc(cashFlows.bizDate), desc(cashFlows.createdAt))
      .all()

    return {
      rows: rows.map(r => ({
        ...r.flow,
        accountName: r.account_name,
        accountCurrency: r.account_currency,
        categoryName: r.category_name,
        departmentName: r.department_name,
        siteName: r.site_name,
      })),
    }
  }

  async getAccountBalance(asOf: string): Promise<{ rows: any[]; asOf: string }> {
    const cacheKey = `report:balance:${asOf}`

    try {
      const cached = await this.kv.get<{ rows: any[]; asOf: string }>(cacheKey, 'json')
      if (cached) {
        return cached
      }
    } catch (e) {
      console.warn('Cache read failed', e)
    }

    const activeAccounts = await this.db
      .select({
        id: accounts.id,
        name: accounts.name,
        type: accounts.type,
        currency: accounts.currency,
        account_number: accounts.accountNumber,
      })
      .from(accounts)
      .where(eq(accounts.active, 1))
      .orderBy(accounts.name)
      .all()

    const accountIds = activeAccounts.map(a => a.id)
    if (accountIds.length === 0) {
      return { rows: [], asOf: asOf }
    }

    const openingBalances = await this.db
      .select({
        account_id: schema.openingBalances.refId,
        ob: sql<number>`coalesce(sum(${schema.openingBalances.amountCents}), 0)`,
      })
      .from(schema.openingBalances)
      .where(
        and(
          eq(schema.openingBalances.type, 'account'),
          inArray(schema.openingBalances.refId, accountIds)
        )
      )
      .groupBy(schema.openingBalances.refId)
      .all()

    const priorFlows = await this.db
      .select({
        account_id: cashFlows.accountId,
        prior_net: sql<number>`coalesce(sum(case when ${cashFlows.type}='income' then ${cashFlows.amountCents} when ${cashFlows.type}='expense' then -${cashFlows.amountCents} else 0 end), 0)`,
      })
      .from(cashFlows)
      .where(and(inArray(cashFlows.accountId, accountIds), sql`${cashFlows.bizDate} < ${asOf}`))
      .groupBy(cashFlows.accountId)
      .all()

    const periodFlows = await this.db
      .select({
        account_id: cashFlows.accountId,
        income_cents: sql<number>`coalesce(sum(case when ${cashFlows.type}='income' then ${cashFlows.amountCents} else 0 end), 0)`,
        expense_cents: sql<number>`coalesce(sum(case when ${cashFlows.type}='expense' then ${cashFlows.amountCents} else 0 end), 0)`,
      })
      .from(cashFlows)
      .where(and(inArray(cashFlows.accountId, accountIds), eq(cashFlows.bizDate, asOf)))
      .groupBy(cashFlows.accountId)
      .all()

    const obMap = new Map(openingBalances.map(r => [r.account_id, r.ob]))
    const priorMap = new Map(priorFlows.map(r => [r.account_id, r.prior_net]))
    const periodMap = new Map(
      periodFlows.map(r => [r.account_id, { income: r.income_cents, expense: r.expense_cents }])
    )

    const rows = activeAccounts.map(acc => {
      const ob = obMap.get(acc.id) || 0
      const prior = priorMap.get(acc.id) || 0
      const period = periodMap.get(acc.id) || { income: 0, expense: 0 }
      const opening = ob + prior
      const closing = opening + period.income - period.expense

      return {
        accountId: acc.id,
        accountName: acc.name,
        accountType: acc.type,
        currency: acc.currency,
        accountNumber: acc.account_number,
        openingCents: opening,
        incomeCents: period.income,
        expenseCents: period.expense,
        closingCents: closing,
      }
    })

    const result = { rows, asOf: asOf }

    try {
      await this.kv.put(cacheKey, JSON.stringify(result), { expirationTtl: 60 })
    } catch (e) {
      console.warn('Cache write failed', e)
    }

    return result
  }

  async getBorrowingSummary(start?: string, end?: string, userId?: string) {
    const conditions = []
    if (start && end) {
      conditions.push(gte(borrowings.createdAt, new Date(start).getTime()))
      conditions.push(lte(borrowings.createdAt, new Date(end).getTime()))
    }
    if (userId) {
      conditions.push(eq(borrowings.userId, userId))
    }

    const rows = await this.db
      .select({
        userId: borrowings.userId,
        userName: employees.name,
        userEmail: employees.email,
        borrowedCents: sql<number>`coalesce(sum(${borrowings.amountCents}), 0)`,
        repaidCents: sql<number>`coalesce(sum(${repayments.amountCents}), 0)`,
      })
      .from(borrowings)
      .leftJoin(employees, eq(employees.id, borrowings.userId))
      .leftJoin(repayments, eq(repayments.borrowingId, borrowings.id))
      .where(and(...conditions))
      .groupBy(borrowings.userId, employees.name, employees.email)
      .all()

    return {
      results: rows.map(r => ({
        userId: r.userId,
        borrowerName: r.userName,
        borrowerEmail: r.userEmail,
        totalBorrowedCents: r.borrowedCents,
        totalRepaidCents: r.repaidCents,
        balanceCents: r.borrowedCents - r.repaidCents,
        currency: 'CNY',
      })),
    }
  }

  async getBorrowingDetail(userId: string, start?: string, end?: string) {
    const conditions = [eq(borrowings.userId, userId)]
    if (start && end) {
      conditions.push(gte(borrowings.createdAt, new Date(start).getTime()))
      conditions.push(lte(borrowings.createdAt, new Date(end).getTime()))
    }

    const borrowingRows = await this.db
      .select({
        borrowing: borrowings,
        userName: employees.name,
      })
      .from(borrowings)
      .leftJoin(employees, eq(employees.id, borrowings.userId))
      .where(and(...conditions))
      .orderBy(desc(borrowings.createdAt))
      .all()

    const borrowingIds = borrowingRows.map(b => b.borrowing.id)
    let repaymentRows: any[] = []

    if (borrowingIds.length > 0) {
      repaymentRows = await this.db
        .select()
        .from(repayments)
        .where(inArray(repayments.borrowingId, borrowingIds))
        .orderBy(desc(repayments.createdAt))
        .all()
    }

    const user = await this.db
      .select({
        id: employees.id,
        name: employees.name,
        email: employees.email,
      })
      .from(employees)
      .where(eq(employees.id, userId))
      .get()

    if (!user) {
      return {
        user: { id: userId, name: 'Unknown' },
        borrowings: [],
        repayments: [],
      }
    }

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      borrowings: borrowingRows.map(b => ({ ...b.borrowing, userName: b.userName })),
      repayments: repaymentRows,
    }
  }
}

