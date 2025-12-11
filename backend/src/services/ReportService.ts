import { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from '../db/schema.js'
import { sql, eq, and, gte, lte, desc, inArray } from 'drizzle-orm'
import {
    cashFlows, accounts, arApDocs, borrowings, repayments,
    departments, sites, categories, employees, employeeLeaves
} from '../db/schema.js'

export class ReportService {
    constructor(private db: DrizzleD1Database<typeof schema>) { }

    async getDashboardStats(departmentId?: string) {
        const today = new Date().toISOString().slice(0, 10)
        const thisMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
        const thisMonthEnd = today

        // 今日统计
        const todayConditions = [eq(cashFlows.bizDate, today)]
        if (departmentId) todayConditions.push(eq(cashFlows.departmentId, departmentId))

        const todayStats = await this.db.select({
            income_cents: sql<number>`coalesce(sum(case when ${cashFlows.type}='income' then ${cashFlows.amountCents} end), 0)`,
            expense_cents: sql<number>`coalesce(sum(case when ${cashFlows.type}='expense' then ${cashFlows.amountCents} end), 0)`,
            count: sql<number>`count(*)`
        }).from(cashFlows).where(and(...todayConditions)).get()

        // 本月统计
        const monthConditions = [gte(cashFlows.bizDate, thisMonthStart), lte(cashFlows.bizDate, thisMonthEnd)]
        if (departmentId) monthConditions.push(eq(cashFlows.departmentId, departmentId))

        const monthStats = await this.db.select({
            income_cents: sql<number>`coalesce(sum(case when ${cashFlows.type}='income' then ${cashFlows.amountCents} end), 0)`,
            expense_cents: sql<number>`coalesce(sum(case when ${cashFlows.type}='expense' then ${cashFlows.amountCents} end), 0)`,
            count: sql<number>`count(*)`
        }).from(cashFlows).where(and(...monthConditions)).get()

        // 账户数量
        const accountsCount = await this.db.select({ count: sql<number>`count(*)` })
            .from(accounts).where(eq(accounts.active, 1)).get()

        // AR/AP 统计
        const arApConditions = [gte(arApDocs.issueDate, thisMonthStart)]
        if (departmentId) arApConditions.push(eq(arApDocs.departmentId, departmentId))

        const arApStats = await this.db.select({
            kind: arApDocs.kind,
            count: sql<number>`count(*)`,
            total_cents: sql<number>`coalesce(sum(${arApDocs.amountCents}), 0)`,
            open_cents: sql<number>`coalesce(sum(case when ${arApDocs.status}='open' then ${arApDocs.amountCents} end), 0)`
        }).from(arApDocs).where(and(...arApConditions)).groupBy(arApDocs.kind).all()

        // 借款统计
        const borrowingStats = await this.db.select({
            borrower_count: sql<number>`count(distinct ${borrowings.userId})`,
            total_borrowed_cents: sql<number>`coalesce(sum(${borrowings.amountCents}), 0)`
        }).from(borrowings).get()

        const repaymentStats = await this.db.select({
            total_repaid_cents: sql<number>`coalesce(sum(${repayments.amountCents}), 0)`
        }).from(repayments).get()

        // 最近流水
        const recentConditions = []
        if (departmentId) recentConditions.push(eq(cashFlows.departmentId, departmentId))

        const recentFlows = await this.db.select({
            flow: cashFlows,
            accountName: accounts.name,
            accountCurrency: accounts.currency,
            categoryName: categories.name,
            departmentName: departments.name
        })
            .from(cashFlows)
            .leftJoin(accounts, eq(accounts.id, cashFlows.accountId))
            .leftJoin(categories, eq(categories.id, cashFlows.categoryId))
            .leftJoin(departments, eq(departments.id, cashFlows.departmentId))
            .where(and(...recentConditions))
            .orderBy(desc(cashFlows.createdAt))
            .limit(10)
            .all()

        return {
            today: {
                incomeCents: todayStats?.income_cents || 0,
                expenseCents: todayStats?.expense_cents || 0,
                count: todayStats?.count || 0
            },
            month: {
                incomeCents: monthStats?.income_cents || 0,
                expenseCents: monthStats?.expense_cents || 0,
                count: monthStats?.count || 0
            },
            accounts: {
                total: accountsCount?.count || 0
            },
            arAp: arApStats.reduce((acc: any, r) => {
                acc[r.kind] = {
                    count: r.count,
                    totalCents: r.total_cents,
                    openCents: r.open_cents
                }
                return acc
            }, {}),
            borrowings: {
                borrowerCount: borrowingStats?.borrower_count || 0,
                totalBorrowedCents: borrowingStats?.total_borrowed_cents || 0,
                totalRepaidCents: repaymentStats?.total_repaid_cents || 0,
                balanceCents: (borrowingStats?.total_borrowed_cents || 0) - (repaymentStats?.total_repaid_cents || 0)
            },
            recentFlows: recentFlows.map(r => ({
                ...r.flow,
                accountName: r.accountName,
                accountCurrency: r.accountCurrency,
                categoryName: r.categoryName,
                departmentName: r.departmentName
            }))
        }
    }

    async getDepartmentCashFlow(start: string, end: string, departmentIds?: string[]) {
        const conditions = [
            gte(cashFlows.bizDate, start),
            lte(cashFlows.bizDate, end)
        ]

        // 注意：原始逻辑是 departments 连接 cash_flows。
        //这里改为从 departments 查询并左连接 cash_flows。

        let deptQuery = this.db.select({
            id: departments.id,
            name: departments.name,
            income_cents: sql<number>`coalesce(sum(case when ${cashFlows.type}='income' then ${cashFlows.amountCents} end), 0)`,
            expense_cents: sql<number>`coalesce(sum(case when ${cashFlows.type}='expense' then ${cashFlows.amountCents} end), 0)`,
            income_count: sql<number>`count(distinct case when ${cashFlows.type}='income' then ${cashFlows.id} end)`,
            expense_count: sql<number>`count(distinct case when ${cashFlows.type}='expense' then ${cashFlows.id} end)`
        })
            .from(departments)
            .leftJoin(cashFlows, and(
                eq(cashFlows.departmentId, departments.id),
                gte(cashFlows.bizDate, start),
                lte(cashFlows.bizDate, end)
            ))
            .where(eq(departments.active, 1))
            .$dynamic()

        if (departmentIds && departmentIds.length > 0) {
            deptQuery = deptQuery.where(inArray(departments.id, departmentIds))
        }

        const rows = await deptQuery.groupBy(departments.id, departments.name).orderBy(departments.name).all()

        return rows.map(r => ({
            departmentId: r.id,
            departmentName: r.name,
            incomeCents: r.income_cents,
            expenseCents: r.expense_cents,
            incomeCount: r.income_count,
            expenseCount: r.expense_count,
            netCents: r.income_cents - r.expense_cents
        }))
    }

    async getSiteGrowth(start: string, end: string, departmentId?: string) {
        const startDate = new Date(start + 'T00:00:00Z')
        const endDate = new Date(end + 'T00:00:00Z')
        const days = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1)
        const prevEnd = new Date(startDate.getTime() - 86400000)
        const prevStart = new Date(prevEnd.getTime() - (days - 1) * 86400000)
        const prevStartStr = prevStart.toISOString().slice(0, 10)
        const prevEndStr = prevEnd.toISOString().slice(0, 10)

        const siteConditions = []
        if (departmentId) siteConditions.push(eq(sites.departmentId, departmentId))

        // 当前周期
        const curRows = await this.db.select({
            site_id: sites.id,
            site_name: sites.name,
            income_cents: sql<number>`coalesce(sum(case when ${cashFlows.type}='income' then ${cashFlows.amountCents} end), 0)`,
            expense_cents: sql<number>`coalesce(sum(case when ${cashFlows.type}='expense' then ${cashFlows.amountCents} end), 0)`
        })
            .from(sites)
            .leftJoin(cashFlows, and(
                eq(cashFlows.siteId, sites.id),
                gte(cashFlows.bizDate, start),
                lte(cashFlows.bizDate, end)
            ))
            .where(and(...siteConditions))
            .groupBy(sites.id, sites.name)
            .all()

        // 上一周期
        const prevRows = await this.db.select({
            site_id: sites.id,
            income_cents: sql<number>`coalesce(sum(case when ${cashFlows.type}='income' then ${cashFlows.amountCents} end), 0)`
        })
            .from(sites)
            .leftJoin(cashFlows, and(
                eq(cashFlows.siteId, sites.id),
                gte(cashFlows.bizDate, prevStartStr),
                lte(cashFlows.bizDate, prevEndStr)
            ))
            .where(and(...siteConditions))
            .groupBy(sites.id)
            .all()

        const prevMap = new Map(prevRows.map(r => [r.site_id, r.income_cents]))

        return {
            rows: curRows.map(r => {
                const prevIncome = prevMap.get(r.site_id) || 0
                const growth_rate = prevIncome === 0 ? (r.income_cents > 0 ? 1 : 0) : (r.income_cents - prevIncome) / prevIncome
                return {
                    siteId: r.site_id,
                    siteName: r.site_name,
                    incomeCents: r.income_cents,
                    expenseCents: r.expense_cents,
                    netCents: r.income_cents - r.expense_cents,
                    prevIncomeCents: prevIncome,
                    growthRate: growth_rate
                }
            }),
            prevRange: { start: prevStartStr, end: prevEndStr }
        }
    }

    async getArApSummary(kind: 'AR' | 'AP', start: string, end: string, departmentId?: string) {
        const conditions = [
            eq(arApDocs.kind, kind),
            gte(arApDocs.issueDate, start),
            lte(arApDocs.issueDate, end)
        ]
        if (departmentId) conditions.push(eq(arApDocs.departmentId, departmentId))

        const docs = await this.db.select({
            doc: arApDocs,
            settled_cents: sql<number>`coalesce((select sum(settle_amount_cents) from settlements where doc_id=${arApDocs.id}), 0)`
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
            lte(arApDocs.issueDate, end)
        ]
        if (departmentId) conditions.push(eq(arApDocs.departmentId, departmentId))

        // 注意：parties 表尚未在 schema.ts 中定义。
        // 目前省略 party_name，后续如需关联可添加。

        const rows = await this.db.select({
            doc: arApDocs,
            settled_cents: sql<number>`coalesce((select sum(settle_amount_cents) from settlements where doc_id=${arApDocs.id}), 0)`
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
            lte(cashFlows.bizDate, end)
        ]
        if (departmentId) conditions.push(eq(cashFlows.departmentId, departmentId))

        const rows = await this.db.select({
            category_id: categories.id,
            category_name: categories.name,
            kind: categories.kind,
            total_cents: sql<number>`coalesce(sum(${cashFlows.amountCents}), 0)`.mapWith(Number).as('total_cents'),
            count: sql<number>`count(*)`
        })
            .from(categories)
            .leftJoin(cashFlows, and(
                eq(cashFlows.categoryId, categories.id),
                ...conditions
            ))
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
                count: r.count
            }))
        }
    }

    async getExpenseDetail(start: string, end: string, categoryId?: string, departmentId?: string) {
        const conditions = [
            eq(cashFlows.type, 'expense'),
            gte(cashFlows.bizDate, start),
            lte(cashFlows.bizDate, end)
        ]
        if (categoryId) conditions.push(eq(cashFlows.categoryId, categoryId))
        if (departmentId) conditions.push(eq(cashFlows.departmentId, departmentId))

        const rows = await this.db.select({
            flow: cashFlows,
            account_name: accounts.name,
            account_currency: accounts.currency,
            category_name: categories.name,
            department_name: departments.name,
            site_name: sites.name
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
                siteName: r.site_name
            }))
        }
    }

    async getAccountBalance(asOf: string) {
        const activeAccounts = await this.db.select({
            id: accounts.id,
            name: accounts.name,
            type: accounts.type,
            currency: accounts.currency,
            account_number: accounts.accountNumber
        }).from(accounts).where(eq(accounts.active, 1)).orderBy(accounts.name).all()

        const accountIds = activeAccounts.map(a => a.id)
        if (accountIds.length === 0) return { rows: [], asOf: asOf }

        // 期初余额
        const openingBalances = await this.db.select({
            account_id: schema.openingBalances.refId,
            ob: sql<number>`coalesce(sum(${schema.openingBalances.amountCents}), 0)`
        }).from(schema.openingBalances)
            .where(and(
                eq(schema.openingBalances.type, 'account'),
                inArray(schema.openingBalances.refId, accountIds)
            ))
            .groupBy(schema.openingBalances.refId)
            .all()

        // 期初至查询日期的流水
        const priorFlows = await this.db.select({
            account_id: cashFlows.accountId,
            prior_net: sql<number>`coalesce(sum(case when ${cashFlows.type}='income' then ${cashFlows.amountCents} when ${cashFlows.type}='expense' then -${cashFlows.amountCents} else 0 end), 0)`
        }).from(cashFlows)
            .where(and(
                inArray(cashFlows.accountId, accountIds),
                sql`${cashFlows.bizDate} < ${asOf}`
            ))
            .groupBy(cashFlows.accountId)
            .all()

        // 查询日期的当期流水
        const periodFlows = await this.db.select({
            account_id: cashFlows.accountId,
            income_cents: sql<number>`coalesce(sum(case when ${cashFlows.type}='income' then ${cashFlows.amountCents} else 0 end), 0)`,
            expense_cents: sql<number>`coalesce(sum(case when ${cashFlows.type}='expense' then ${cashFlows.amountCents} else 0 end), 0)`
        }).from(cashFlows)
            .where(and(
                inArray(cashFlows.accountId, accountIds),
                eq(cashFlows.bizDate, asOf)
            ))
            .groupBy(cashFlows.accountId)
            .all()

        const obMap = new Map(openingBalances.map(r => [r.account_id, r.ob]))
        const priorMap = new Map(priorFlows.map(r => [r.account_id, r.prior_net]))
        const periodMap = new Map(periodFlows.map(r => [r.account_id, { income: r.income_cents, expense: r.expense_cents }]))

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
                closingCents: closing
            }
        })

        return { rows, asOf: asOf }
    }

    async getBorrowingSummary(start?: string, end?: string, userId?: string) {
        const conditions = []
        if (start && end) {
            conditions.push(gte(borrowings.createdAt, new Date(start).getTime()))
            conditions.push(lte(borrowings.createdAt, new Date(end).getTime()))
        }
        if (userId) conditions.push(eq(borrowings.userId, userId))

        const rows = await this.db.select({
            userId: borrowings.userId,
            userName: employees.name,
            userEmail: employees.email,
            borrowedCents: sql<number>`coalesce(sum(${borrowings.amountCents}), 0)`,
            repaidCents: sql<number>`coalesce(sum(${repayments.amountCents}), 0)`
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
                currency: 'CNY' // TODO: 支持多币种 (按币种分组)
            }))
        }
    }

    async getBorrowingDetail(userId: string, start?: string, end?: string) {
        const conditions = [eq(borrowings.userId, userId)]
        if (start && end) {
            conditions.push(gte(borrowings.createdAt, new Date(start).getTime()))
            conditions.push(lte(borrowings.createdAt, new Date(end).getTime()))
        }

        const borrowingRows = await this.db.select({
            borrowing: borrowings,
            userName: employees.name
        })
            .from(borrowings)
            .leftJoin(employees, eq(employees.id, borrowings.userId))
            .where(and(...conditions))
            .orderBy(desc(borrowings.createdAt))
            .all()

        const borrowingIds = borrowingRows.map(b => b.borrowing.id)
        let repaymentRows: any[] = []

        if (borrowingIds.length > 0) {
            repaymentRows = await this.db.select().from(repayments)
                .where(inArray(repayments.borrowingId, borrowingIds))
                .orderBy(desc(repayments.createdAt))
                .all()
        }

        // 获取用户信息
        const user = await this.db.select({
            id: employees.id,
            name: employees.name,
            email: employees.email
        }).from(employees).where(eq(employees.id, userId)).get()

        if (!user) {
            // 通常不会发生
            return {
                user: { id: userId, name: 'Unknown' },
                borrowings: [],
                repayments: []
            }
        }

        return {
            user: {
                id: user.id,
                name: user.name,
                email: user.email
            },
            borrowings: borrowingRows.map(b => ({ ...b.borrowing, userName: b.userName })),
            repayments: repaymentRows
        }
    }

    async getNewSiteRevenue(start: string, end: string, days: number = 30, departmentId?: string) {
        // SQLite julianday 逻辑需要使用 raw SQL 或 sql 模板
        const conditions = [
            sql`julianday(${end}) - julianday(datetime(${sites.createdAt}/1000, 'unixepoch')) <= ${days}`,
            sql`${sites.createdAt} is not null`
        ]
        if (departmentId) conditions.push(eq(sites.departmentId, departmentId))

        const rows = await this.db.select({
            site_id: sites.id,
            site_name: sites.name,
            site_created_at: sites.createdAt,
            income_cents: sql<number>`coalesce(sum(case when ${cashFlows.type}='income' then ${cashFlows.amountCents} end), 0)`,
            expense_cents: sql<number>`coalesce(sum(case when ${cashFlows.type}='expense' then ${cashFlows.amountCents} end), 0)`,
            income_count: sql<number>`count(distinct case when ${cashFlows.type}='income' then ${cashFlows.id} end)`
        })
            .from(sites)
            .leftJoin(cashFlows, and(
                eq(cashFlows.siteId, sites.id),
                gte(cashFlows.bizDate, start),
                lte(cashFlows.bizDate, end)
            ))
            .where(and(...conditions))
            .groupBy(sites.id, sites.name, sites.createdAt)
            .orderBy(desc(sites.createdAt))
            .all()

        return {
            rows: rows.map(r => ({
                ...r,
                net_cents: r.income_cents - r.expense_cents
            }))
        }
    }

    async getEmployeeSalaryReport(year: number, month?: number, departmentId?: string) {
        const conditions = [eq(employees.active, 1)]
        if (departmentId) conditions.push(eq(employees.departmentId, departmentId))

        const emps = await this.db.select({
            id: employees.id,
            name: employees.name,
            departmentId: employees.departmentId,
            departmentName: departments.name,
            joinDate: employees.joinDate,
            status: employees.status,
            regularDate: employees.regularDate
        })
            .from(employees)
            .leftJoin(departments, eq(employees.departmentId, departments.id))
            .where(and(...conditions))
            .orderBy(departments.name, employees.name)
            .all()

        // 获取请假记录
        const yearStart = `${year}-01-01`
        const yearEnd = `${year}-12-31`
        const empIds = emps.map(e => e.id)

        let allLeaves: any[] = []
        if (empIds.length > 0) {
            allLeaves = await this.db.select({
                employeeId: employeeLeaves.employeeId,
                leaveType: employeeLeaves.leaveType,
                startDate: employeeLeaves.startDate,
                endDate: employeeLeaves.endDate,
                days: employeeLeaves.days
            })
                .from(employeeLeaves)
                .where(and(
                    inArray(employeeLeaves.employeeId, empIds),
                    eq(employeeLeaves.status, 'approved'),
                    lte(employeeLeaves.startDate, yearEnd),
                    gte(employeeLeaves.endDate, yearStart)
                ))
                .all()
        }

        const leavesByEmployee = new Map<string, any[]>()
        for (const leave of allLeaves) {
            if (!leave.employeeId) continue
            if (!leavesByEmployee.has(leave.employeeId)) {
                leavesByEmployee.set(leave.employeeId, [])
            }
            leavesByEmployee.get(leave.employeeId)!.push(leave)
        }

        const rows: any[] = []

        for (const emp of emps) {
            if (!emp.joinDate) continue
            const joinDate = new Date(emp.joinDate + 'T00:00:00Z')
            const joinYear = joinDate.getFullYear()
            const joinMonth = joinDate.getMonth() + 1
            const empLeaves = leavesByEmployee.get(emp.id) || []

            const calculateMonth = (m: number) => {
                if (joinYear > year || (joinYear === year && joinMonth > m)) return null

                let salaryCents = 0
                let workDays = 0
                const daysInMonth = new Date(year, m, 0).getDate()

                // 注意：薪资数据来源于 employee_salaries 表
                // TODO: 集成 employee_salaries 表以正确支持多币种

                if (joinYear === year && joinMonth === m) {
                    workDays = daysInMonth - joinDate.getDate() + 1
                } else {
                    workDays = daysInMonth
                }

                const monthStart = `${year}-${String(m).padStart(2, '0')}-01`
                const monthEnd = `${year}-${String(m).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`

                let leaveDaysToDeduct = 0
                for (const leave of empLeaves) {
                    if (leave.startDate <= monthEnd && leave.endDate >= monthStart) {
                        if (leave.leaveType !== 'annual') {
                            // 重叠计算
                            const leaveStart = new Date(leave.startDate + 'T00:00:00Z')
                            const leaveEnd = new Date(leave.endDate + 'T00:00:00Z')
                            const monthStartDate = new Date(monthStart + 'T00:00:00Z')
                            const monthEndDate = new Date(monthEnd + 'T00:00:00Z')

                            const overlapStart = leaveStart > monthStartDate ? leaveStart : monthStartDate
                            const overlapEnd = leaveEnd < monthEndDate ? leaveEnd : monthEndDate

                            if (overlapStart <= overlapEnd) {
                                const overlapDays = Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
                                leaveDaysToDeduct += overlapDays
                            }
                        }
                    }
                }

                workDays = Math.max(0, workDays - leaveDaysToDeduct)
                const actualSalaryCents = Math.round((salaryCents * workDays) / daysInMonth)

                return {
                    employeeId: emp.id,
                    employeeName: emp.name,
                    departmentId: emp.departmentId,
                    departmentName: emp.departmentName,
                    year: year,
                    month: m,
                    joinDate: emp.joinDate,
                    status: emp.status,
                    baseSalaryCents: salaryCents,
                    workDays: workDays,
                    daysInMonth: daysInMonth,
                    leaveDays: leaveDaysToDeduct,
                    actualSalaryCents: actualSalaryCents
                }
            }

            if (month) {
                const res = calculateMonth(month)
                if (res) rows.push(res)
            } else {
                for (let m = 1; m <= 12; m++) {
                    const res = calculateMonth(m)
                    if (res) rows.push(res)
                }
            }
        }

        return { results: rows }
    }

    async getAnnualLeaveReport(departmentId?: string, orgDepartmentId?: string) {
        const conditions = [eq(employees.active, 1)]
        if (departmentId) conditions.push(eq(employees.departmentId, departmentId))
        if (orgDepartmentId) conditions.push(eq(employees.orgDepartmentId, orgDepartmentId))

        const emps = await this.db.select({
            id: employees.id,
            name: employees.name,
            joinDate: employees.joinDate,
            departmentId: employees.departmentId,
            orgDepartmentId: employees.orgDepartmentId
        })
            .from(employees)
            .where(and(...conditions))
            .all()

        const { getAnnualLeaveStats } = await import('./AnnualLeaveService.js')

        const results = []
        for (const emp of emps) {
            if (!emp.joinDate) continue
            const stats = await getAnnualLeaveStats(this.db, emp.id, emp.joinDate)
            results.push({
                employeeId: emp.id,
                employeeName: emp.name,
                departmentId: emp.departmentId,
                orgDepartmentId: emp.orgDepartmentId,
                ...stats
            })
        }

        return { results }
    }
}
