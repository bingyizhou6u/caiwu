/**
 * 财务报表服务
 * 处理财务相关的报表：AR/AP、费用、账户余额
 */

import { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from '../../db/schema.js'
import {
  arApDocs,
  cashFlows,
  accounts,
  categories,
  departments,
  sites,
  employees,
} from '../../db/schema.js'
import { sql, eq, and, gte, lte, desc, inArray } from 'drizzle-orm'
import { Logger } from '../../utils/logger.js'
import { query } from '../../utils/query-helpers.js'
import type { Context } from 'hono'
import type { Env, AppVariables } from '../../types/index.js'

export class FinancialReportService {
  constructor(
    private db: DrizzleD1Database<typeof schema>,
    private kv: KVNamespace
  ) { }

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

    // D1 兼容性修复：使用顺序查询代替复杂 JOIN
    // 1. 查询现金流水
    const flows = await this.db
      .select()
      .from(cashFlows)
      .where(and(...conditions))
      .orderBy(desc(cashFlows.bizDate), desc(cashFlows.createdAt))
      .all()

    if (flows.length === 0) {
      return { rows: [] }
    }

    // 2. 批量查询关联数据
    const accountIds = [...new Set(flows.map(f => f.accountId).filter(Boolean) as string[])]
    const categoryIds = [...new Set(flows.map(f => f.categoryId).filter(Boolean) as string[])]
    const deptIds = [...new Set(flows.map(f => f.departmentId).filter(Boolean) as string[])]
    const siteIds = [...new Set(flows.map(f => f.siteId).filter(Boolean) as string[])]

    const [accountsList, categoriesList, departmentsList, sitesList] = await Promise.all([
      accountIds.length > 0
        ? this.db
            .select({ id: accounts.id, name: accounts.name, currency: accounts.currency })
            .from(accounts)
            .where(inArray(accounts.id, accountIds))
            .all()
        : Promise.resolve([]),
      categoryIds.length > 0
        ? this.db
            .select({ id: categories.id, name: categories.name })
            .from(categories)
            .where(inArray(categories.id, categoryIds))
            .all()
        : Promise.resolve([]),
      deptIds.length > 0
        ? this.db
            .select({ id: departments.id, name: departments.name })
            .from(departments)
            .where(inArray(departments.id, deptIds))
            .all()
        : Promise.resolve([]),
      siteIds.length > 0
        ? this.db
            .select({ id: sites.id, name: sites.name })
            .from(sites)
            .where(inArray(sites.id, siteIds))
            .all()
        : Promise.resolve([]),
    ])

    // 3. 创建映射表
    const accountMap = new Map(accountsList.map(a => [a.id, a]))
    const categoryMap = new Map(categoriesList.map(c => [c.id, c]))
    const deptMap = new Map(departmentsList.map(d => [d.id, d]))
    const siteMap = new Map(sitesList.map(s => [s.id, s]))

    // 4. 组装结果
    return {
      rows: flows.map(flow => {
        const account = flow.accountId ? accountMap.get(flow.accountId) : null
        const category = flow.categoryId ? categoryMap.get(flow.categoryId) : null
        const department = flow.departmentId ? deptMap.get(flow.departmentId) : null
        const site = flow.siteId ? siteMap.get(flow.siteId) : null
        return {
          ...flow,
          accountName: account?.name || null,
          accountCurrency: account?.currency || null,
          categoryName: category?.name || null,
          departmentName: department?.name || null,
          siteName: site?.name || null,
        }
      }),
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
      Logger.warn('Cache read failed', { error: e })
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

    const priorFlows = await query(
      this.db,
      'FinancialReportService.getAccountBalanceReport.getPriorFlows',
      () => this.db
        .select({
          account_id: cashFlows.accountId,
          prior_net: sql<number>`coalesce(sum(case when ${cashFlows.type}='income' then ${cashFlows.amountCents} when ${cashFlows.type}='expense' then -${cashFlows.amountCents} else 0 end), 0)`,
        })
        .from(cashFlows)
        .where(and(inArray(cashFlows.accountId, accountIds), sql`${cashFlows.bizDate} < ${asOf}`))
        .groupBy(cashFlows.accountId)
        .all(),
      undefined
    )

    const periodFlows = await query(
      this.db,
      'FinancialReportService.getAccountBalanceReport.getPeriodFlows',
      () => this.db
        .select({
          account_id: cashFlows.accountId,
          income_cents: sql<number>`coalesce(sum(case when ${cashFlows.type}='income' then ${cashFlows.amountCents} else 0 end), 0)`,
          expense_cents: sql<number>`coalesce(sum(case when ${cashFlows.type}='expense' then ${cashFlows.amountCents} else 0 end), 0)`,
        })
        .from(cashFlows)
        .where(and(inArray(cashFlows.accountId, accountIds), eq(cashFlows.bizDate, asOf)))
        .groupBy(cashFlows.accountId)
        .all(),
      undefined
    )

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
      Logger.warn('Cache write failed', { error: e })
    }

    return result
  }

  // Note: getBorrowingSummary and getBorrowingDetail have been removed
  // Borrowing/lending is now tracked via flows with type = 'borrowing_in' | 'lending_out' | 'repayment_in' | 'repayment_out'
}
