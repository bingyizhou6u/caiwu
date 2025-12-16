/**
 * 仪表盘报表服务
 * 处理仪表盘统计数据的生成
 */

import { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from '../db/schema.js'
import {
  cashFlows,
  accounts,
  arApDocs,
  borrowings,
  repayments,
  departments,
  categories,
} from '../db/schema.js'
import { sql, eq, and, gte, lte, desc } from 'drizzle-orm'
import { Logger } from '../utils/logger.js'

export class DashboardReportService {
  constructor(
    private db: DrizzleD1Database<typeof schema>,
    private kv: KVNamespace
  ) {}

  async getDashboardStats(departmentId?: string) {
    const cacheKey = `report:dashboard:${new Date().toISOString().slice(0, 10)}:${departmentId || 'all'}`

    // Try Cache
    try {
      const cached = await this.kv.get(cacheKey, 'json')
      if (cached) {
        return cached
      }
    } catch (e) {
      Logger.warn('Cache read failed', { error: e })
    }

    const today = new Date().toISOString().slice(0, 10)
    const thisMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .slice(0, 10)
    const thisMonthEnd = today

    // 今日统计
    const todayConditions = [eq(cashFlows.bizDate, today)]
    if (departmentId) {
      todayConditions.push(eq(cashFlows.departmentId, departmentId))
    }

    const todayStats = await this.db
      .select({
        income_cents: sql<number>`coalesce(sum(case when ${cashFlows.type}='income' then ${cashFlows.amountCents} end), 0)`,
        expense_cents: sql<number>`coalesce(sum(case when ${cashFlows.type}='expense' then ${cashFlows.amountCents} end), 0)`,
        count: sql<number>`count(*)`,
      })
      .from(cashFlows)
      .where(and(...todayConditions))
      .get()

    // 本月统计
    const monthConditions = [
      gte(cashFlows.bizDate, thisMonthStart),
      lte(cashFlows.bizDate, thisMonthEnd),
    ]
    if (departmentId) {
      monthConditions.push(eq(cashFlows.departmentId, departmentId))
    }

    const monthStats = await this.db
      .select({
        income_cents: sql<number>`coalesce(sum(case when ${cashFlows.type}='income' then ${cashFlows.amountCents} end), 0)`,
        expense_cents: sql<number>`coalesce(sum(case when ${cashFlows.type}='expense' then ${cashFlows.amountCents} end), 0)`,
        count: sql<number>`count(*)`,
      })
      .from(cashFlows)
      .where(and(...monthConditions))
      .get()

    // 账户数量
    const accountsCount = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(accounts)
      .where(eq(accounts.active, 1))
      .get()

    // AR/AP 统计
    const arApConditions = [gte(arApDocs.issueDate, thisMonthStart)]
    if (departmentId) {
      arApConditions.push(eq(arApDocs.departmentId, departmentId))
    }

    const arApStats = await this.db
      .select({
        kind: arApDocs.kind,
        count: sql<number>`count(*)`,
        total_cents: sql<number>`coalesce(sum(${arApDocs.amountCents}), 0)`,
        open_cents: sql<number>`coalesce(sum(case when ${arApDocs.status}='open' then ${arApDocs.amountCents} end), 0)`,
      })
      .from(arApDocs)
      .where(and(...arApConditions))
      .groupBy(arApDocs.kind)
      .all()

    // 借款统计
    const borrowingStats = await this.db
      .select({
        borrower_count: sql<number>`count(distinct ${borrowings.userId})`,
        total_borrowed_cents: sql<number>`coalesce(sum(${borrowings.amountCents}), 0)`,
      })
      .from(borrowings)
      .get()

    const repaymentStats = await this.db
      .select({
        total_repaid_cents: sql<number>`coalesce(sum(${repayments.amountCents}), 0)`,
      })
      .from(repayments)
      .get()

    // 最近流水
    const recentConditions = []
    if (departmentId) {
      recentConditions.push(eq(cashFlows.departmentId, departmentId))
    }

    const recentFlows = await this.db
      .select({
        flow: cashFlows,
        accountName: accounts.name,
        accountCurrency: accounts.currency,
        categoryName: categories.name,
        departmentName: departments.name,
      })
      .from(cashFlows)
      .leftJoin(accounts, eq(accounts.id, cashFlows.accountId))
      .leftJoin(categories, eq(categories.id, cashFlows.categoryId))
      .leftJoin(departments, eq(departments.id, cashFlows.departmentId))
      .where(and(...recentConditions))
      .orderBy(desc(cashFlows.createdAt))
      .limit(10)
      .all()

    const result = {
      today: {
        incomeCents: todayStats?.income_cents || 0,
        expenseCents: todayStats?.expense_cents || 0,
        count: todayStats?.count || 0,
      },
      month: {
        incomeCents: monthStats?.income_cents || 0,
        expenseCents: monthStats?.expense_cents || 0,
        count: monthStats?.count || 0,
      },
      accounts: {
        total: accountsCount?.count || 0,
      },
      arAp: arApStats.reduce((acc: any, r) => {
        acc[r.kind] = {
          count: r.count,
          totalCents: r.total_cents,
          openCents: r.open_cents,
        }
        return acc
      }, {}),
      borrowings: {
        borrowerCount: borrowingStats?.borrower_count || 0,
        totalBorrowedCents: borrowingStats?.total_borrowed_cents || 0,
        totalRepaidCents: repaymentStats?.total_repaid_cents || 0,
        balanceCents:
          (borrowingStats?.total_borrowed_cents || 0) - (repaymentStats?.total_repaid_cents || 0),
      },
      recentFlows: recentFlows.map(r => ({
        ...r.flow,
        accountName: r.accountName,
        accountCurrency: r.accountCurrency,
        categoryName: r.categoryName,
        departmentName: r.departmentName,
      })),
    }

    // Cache for 5 minutes
    try {
      await this.kv.put(cacheKey, JSON.stringify(result), { expirationTtl: 300 })
    } catch (e) {
      Logger.warn('Cache write failed', { error: e })
    }

    return result
  }
}

