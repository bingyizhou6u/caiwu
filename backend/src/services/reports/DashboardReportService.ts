/**
 * 仪表盘报表服务
 * 处理仪表盘统计数据的生成
 */

import { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from '../../db/schema.js'
import {
  cashFlows,
  accounts,
  arApDocs,
  projects,
  categories,
} from '../../db/schema.js'
import { sql, eq, and, gte, lte, desc, inArray } from 'drizzle-orm'
import { Logger } from '../../utils/logger.js'
import { getBusinessDate, getBusinessMonthStart, getBusinessTimezoneDisplay } from '../../utils/timezone.js'

export class DashboardReportService {
  constructor(
    private db: DrizzleD1Database<typeof schema>,
    private kv: KVNamespace
  ) { }

  async getDashboardStats(departmentId?: string) {
    // 使用业务时区 (UTC+4 迪拜时间) 计算日期
    const today = getBusinessDate()
    const thisMonthStart = getBusinessMonthStart()
    const thisMonthEnd = today

    const cacheKey = `report:dashboard:${today}:${departmentId || 'all'}`

    // Try Cache
    try {
      const cached = await this.kv.get(cacheKey, 'json')
      if (cached) {
        return cached
      }
    } catch (e) {
      Logger.warn('Cache read failed', { error: e })
    }

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

    // Note: borrowing stats removed - borrowing/lending now tracked via flows

    // 最近流水
    const recentConditions = []
    if (departmentId) {
      recentConditions.push(eq(cashFlows.departmentId, departmentId))
    }

    // D1 兼容性修复：使用顺序查询代替复杂 JOIN
    // 1. 查询最近的现金流水
    const recentFlows = await this.db
      .select()
      .from(cashFlows)
      .where(and(...recentConditions))
      .orderBy(desc(cashFlows.createdAt))
      .limit(10)
      .all()

    // 2. 批量查询关联数据
    const accountIds = [...new Set(recentFlows.map(f => f.accountId).filter(Boolean) as string[])]
    const categoryIds = [...new Set(recentFlows.map(f => f.categoryId).filter(Boolean) as string[])]
    const deptIds = [...new Set(recentFlows.map(f => f.departmentId).filter(Boolean) as string[])]

    const [accountsList, categoriesList, projectsList] = await Promise.all([
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
            .select({ id: projects.id, name: projects.name })
            .from(projects)
            .where(inArray(projects.id, deptIds))
            .all()
        : Promise.resolve([]),
    ])

    // 3. 创建映射表
    const accountMap = new Map(accountsList.map(a => [a.id, a]))
    const categoryMap = new Map(categoriesList.map(c => [c.id, c]))
    const deptMap = new Map(projectsList.map(d => [d.id, d]))

    // 4. 组装结果
    const recentFlowsWithDetails = recentFlows.map(flow => {
      const account = flow.accountId ? accountMap.get(flow.accountId) : null
      const category = flow.categoryId ? categoryMap.get(flow.categoryId) : null
      const department = flow.departmentId ? deptMap.get(flow.departmentId) : null
      return {
        flow,
        accountName: account?.name || null,
        accountCurrency: account?.currency || null,
        categoryName: category?.name || null,
        departmentName: department?.name || null,
      }
    })

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
      recentFlows: recentFlowsWithDetails.map(r => ({
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
