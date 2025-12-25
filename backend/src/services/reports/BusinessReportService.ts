/**
 * 业务报表服务
 * 处理业务相关的报表：部门现金流、站点增长、员工薪资、年假等
 */

import { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from '../../db/schema.js'
import {
  cashFlows,
  departments,
  sites,
  employees,
  employeeLeaves,
  employeeSalaries,
  currencies,
} from '../../db/schema.js'
import { sql, eq, and, gte, lte, desc, inArray } from 'drizzle-orm'
import { AnnualLeaveService } from '../hr/AnnualLeaveService.js'
import { Logger } from '../../utils/logger.js'
import { query } from '../../utils/query-helpers.js'
import { getBusinessDate } from '../../utils/timezone.js'
import type { Context } from 'hono'
import type { Env, AppVariables } from '../../types.js'

export class BusinessReportService {
  constructor(
    private db: DrizzleD1Database<typeof schema>,
    private annualLeaveService: AnnualLeaveService,
    private kv: KVNamespace
  ) { }

  async getDepartmentCashFlow(start: string, end: string, departmentIds?: string[]) {
    const cacheKey = `report:dept_flow:${start}:${end}:${departmentIds ? departmentIds.sort().join(',') : 'all'}`

    try {
      const cached = await this.kv.get(cacheKey, 'json')
      if (cached) {
        return cached
      }
    } catch (e) {
      Logger.warn('Cache read failed', { error: e })
    }

    const conditions = [gte(cashFlows.bizDate, start), lte(cashFlows.bizDate, end)]

    let deptQuery = this.db
      .select({
        id: departments.id,
        name: departments.name,
        income_cents: sql<number>`coalesce(sum(case when ${cashFlows.type}='income' then ${cashFlows.amountCents} end), 0)`,
        expense_cents: sql<number>`coalesce(sum(case when ${cashFlows.type}='expense' then ${cashFlows.amountCents} end), 0)`,
        income_count: sql<number>`count(distinct case when ${cashFlows.type}='income' then ${cashFlows.id} end)`,
        expense_count: sql<number>`count(distinct case when ${cashFlows.type}='expense' then ${cashFlows.id} end)`,
      })
      .from(departments)
      .leftJoin(
        cashFlows,
        and(
          eq(cashFlows.departmentId, departments.id),
          gte(cashFlows.bizDate, start),
          lte(cashFlows.bizDate, end)
        )
      )
      .where(eq(departments.active, 1))
      .$dynamic()

    if (departmentIds && departmentIds.length > 0) {
      deptQuery = deptQuery.where(inArray(departments.id, departmentIds))
    }

    const rows = await query(
      this.db,
      'BusinessReportService.getDepartmentCashFlowReport.getRows',
      () => deptQuery.groupBy(departments.id, departments.name).orderBy(departments.name).all(),
      undefined
    )

    const result = rows.map(r => ({
      departmentId: r.id,
      departmentName: r.name,
      incomeCents: r.income_cents,
      expenseCents: r.expense_cents,
      incomeCount: r.income_count,
      expenseCount: r.expense_count,
      netCents: r.income_cents - r.expense_cents,
    }))

    try {
      await this.kv.put(cacheKey, JSON.stringify(result), { expirationTtl: 300 })
    } catch (e) {
      Logger.warn('Cache write failed', { error: e })
    }

    return result
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
    if (departmentId) {
      siteConditions.push(eq(sites.departmentId, departmentId))
    }

    const curRows = await this.db
      .select({
        site_id: sites.id,
        site_name: sites.name,
        income_cents: sql<number>`coalesce(sum(case when ${cashFlows.type}='income' then ${cashFlows.amountCents} end), 0)`,
        expense_cents: sql<number>`coalesce(sum(case when ${cashFlows.type}='expense' then ${cashFlows.amountCents} end), 0)`,
      })
      .from(sites)
      .leftJoin(
        cashFlows,
        and(
          eq(cashFlows.siteId, sites.id),
          gte(cashFlows.bizDate, start),
          lte(cashFlows.bizDate, end)
        )
      )
      .where(and(...siteConditions))
      .groupBy(sites.id, sites.name)
      .all()

    const prevRows = await this.db
      .select({
        site_id: sites.id,
        income_cents: sql<number>`coalesce(sum(case when ${cashFlows.type}='income' then ${cashFlows.amountCents} end), 0)`,
      })
      .from(sites)
      .leftJoin(
        cashFlows,
        and(
          eq(cashFlows.siteId, sites.id),
          gte(cashFlows.bizDate, prevStartStr),
          lte(cashFlows.bizDate, prevEndStr)
        )
      )
      .where(and(...siteConditions))
      .groupBy(sites.id)
      .all()

    const prevMap = new Map(prevRows.map(r => [r.site_id, r.income_cents]))

    return {
      rows: curRows.map(r => {
        const prevIncome = prevMap.get(r.site_id) || 0
        const growth_rate =
          prevIncome === 0
            ? r.income_cents > 0
              ? 1
              : 0
            : (r.income_cents - prevIncome) / prevIncome
        return {
          siteId: r.site_id,
          siteName: r.site_name,
          incomeCents: r.income_cents,
          expenseCents: r.expense_cents,
          netCents: r.income_cents - r.expense_cents,
          prevIncomeCents: prevIncome,
          growthRate: growth_rate,
        }
      }),
      prevRange: { start: prevStartStr, end: prevEndStr },
    }
  }

  async getNewSiteRevenue(start: string, end: string, days: number = 30, departmentId?: string) {
    const siteConditions = []
    if (departmentId) {
      siteConditions.push(eq(sites.departmentId, departmentId))
    }

    const sitesList = await this.db
      .select({
        id: sites.id,
        name: sites.name,
        departmentId: sites.departmentId,
        createdAt: sites.createdAt,
      })
      .from(sites)
      .where(and(...siteConditions))
      .all()

    const newSites = sitesList.filter(s => {
      if (!s.createdAt) {
        return false
      }
      const createdDate = new Date(s.createdAt)
      const startDate = new Date(start + 'T00:00:00Z')
      const daysDiff = Math.floor((startDate.getTime() - createdDate.getTime()) / 86400000)
      return daysDiff >= 0 && daysDiff <= days
    })

    const newSiteIds = newSites.map(s => s.id)
    if (newSiteIds.length === 0) {
      return { rows: [] }
    }

    const rows = await query(
      this.db,
      'BusinessReportService.getSiteGrowthReport.getRows',
      () => this.db
        .select({
          site_id: sites.id,
          site_name: sites.name,
          income_cents: sql<number>`coalesce(sum(case when ${cashFlows.type}='income' then ${cashFlows.amountCents} end), 0)`,
        })
        .from(sites)
        .leftJoin(
          cashFlows,
          and(
            eq(cashFlows.siteId, sites.id),
            gte(cashFlows.bizDate, start),
            lte(cashFlows.bizDate, end)
          )
        )
        .where(inArray(sites.id, newSiteIds))
        .groupBy(sites.id, sites.name)
        .all(),
      undefined
    )


    return {
      rows: rows.map(r => ({
        siteId: r.site_id,
        siteName: r.site_name,
        incomeCents: r.income_cents,
      })),
    }
  }

  async getEmployeeSalaryReport(
    year: number,
    month?: number,
    departmentId?: string,
    useCache = true
  ) {
    if (useCache) {
      const cacheKey = `report:salary:${year}:${month || 'all'}:${departmentId || 'all'}`
      try {
        const cached = await this.kv.get(cacheKey, 'json')
        if (cached) {
          return cached
        }
      } catch (e) {
        Logger.warn('Cache read failed for salary report', { error: e })
      }
    }

    const conditions = [eq(employees.active, 1)]
    if (departmentId) {
      conditions.push(eq(employees.departmentId, departmentId))
    }

    const emps = await this.db
      .select({
        id: employees.id,
        name: employees.name,
        departmentId: employees.departmentId,
        departmentName: departments.name,
        joinDate: employees.joinDate,
        status: employees.status,
        regularDate: employees.regularDate,
      })
      .from(employees)
      .leftJoin(departments, eq(employees.departmentId, departments.id))
      .where(and(...conditions))
      .orderBy(departments.name, employees.name)
      .all()

    const yearStart = `${year}-01-01`
    const yearEnd = `${year}-12-31`
    const empIds = emps.map(e => e.id)

    let allLeaves: any[] = []
    if (empIds.length > 0) {
      allLeaves = await this.db
        .select({
          employeeId: employeeLeaves.employeeId,
          leaveType: employeeLeaves.leaveType,
          startDate: employeeLeaves.startDate,
          endDate: employeeLeaves.endDate,
          days: employeeLeaves.days,
        })
        .from(employeeLeaves)
        .where(
          and(
            inArray(employeeLeaves.employeeId, empIds),
            eq(employeeLeaves.status, 'approved'),
            lte(employeeLeaves.startDate, yearEnd),
            gte(employeeLeaves.endDate, yearStart)
          )
        )
        .all()
    }

    const leavesByEmployee = new Map<string, any[]>()
    for (const leave of allLeaves) {
      if (!leave.employeeId) {
        continue
      }
      if (!leavesByEmployee.has(leave.employeeId)) {
        leavesByEmployee.set(leave.employeeId, [])
      }
      leavesByEmployee.get(leave.employeeId)!.push(leave)
    }

    let allSalaries: any[] = []
    if (empIds.length > 0) {
      // 检查 effectiveDate 字段是否存在（兼容旧数据库）
      try {
        allSalaries = await query(
          this.db,
          'BusinessReportService.getEmployeeSalaryReport.getSalaries',
          () => this.db
            .select({
              employeeId: employeeSalaries.employeeId,
              salaryType: employeeSalaries.salaryType,
              currencyId: employeeSalaries.currencyId,
              amountCents: employeeSalaries.amountCents,
              effectiveDate: employeeSalaries.effectiveDate,
              currencyCode: currencies.code,
            })
            .from(employeeSalaries)
            .leftJoin(currencies, eq(currencies.code, employeeSalaries.currencyId))
            .where(inArray(employeeSalaries.employeeId, empIds))
            .orderBy(
              employeeSalaries.employeeId,
              employeeSalaries.effectiveDate,
              sql`case when ${currencies.code} = 'USDT' then 0 else 1 end`,
              currencies.code
            )
            .all(),
          undefined
        )
      } catch (error: any) {
        // 如果 effectiveDate 字段不存在，使用简化查询
        if (error?.message?.includes('effective_date') || error?.message?.includes('no such column')) {
          allSalaries = await query(
            this.db,
            'BusinessReportService.getEmployeeSalaryReport.getSalariesFallback',
            () => this.db
              .select({
                employeeId: employeeSalaries.employeeId,
                salaryType: employeeSalaries.salaryType,
                currencyId: employeeSalaries.currencyId,
                amountCents: employeeSalaries.amountCents,
                effectiveDate: sql<string | null>`NULL`.as('effectiveDate'),
                currencyCode: currencies.code,
              })
              .from(employeeSalaries)
              .leftJoin(currencies, eq(currencies.code, employeeSalaries.currencyId))
              .where(inArray(employeeSalaries.employeeId, empIds))
              .orderBy(
                employeeSalaries.employeeId,
                sql`case when ${currencies.code} = 'USDT' then 0 else 1 end`,
                currencies.code
              )
              .all(),
            undefined
          )
        } else {
          throw error
        }
      }
    }

    const salariesByEmployee = new Map<string, Map<string, any[]>>()
    for (const salary of allSalaries) {
      if (!salary.employeeId) {
        continue
      }
      if (!salariesByEmployee.has(salary.employeeId)) {
        salariesByEmployee.set(salary.employeeId, new Map())
      }
      const empSalaries = salariesByEmployee.get(salary.employeeId)!
      const key = salary.salaryType || 'regular'
      if (!empSalaries.has(key)) {
        empSalaries.set(key, [])
      }
      empSalaries.get(key)!.push(salary)
    }

    const rows: any[] = []

    for (const emp of emps) {
      if (!emp.joinDate) {
        continue
      }
      const joinDate = new Date(emp.joinDate + 'T00:00:00Z')
      const joinYear = joinDate.getFullYear()
      const joinMonth = joinDate.getMonth() + 1
      const empLeaves = leavesByEmployee.get(emp.id) || []

      const calculateMonth = (m: number) => {
        if (joinYear > year || (joinYear === year && joinMonth > m)) {
          return null
        }

        let salaryCents = 0
        let workDays = 0
        const daysInMonth = new Date(year, m, 0).getDate()

        const monthEnd = `${year}-${String(m).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`
        const empSalariesMap = salariesByEmployee.get(emp.id)

        if (empSalariesMap) {
          const salaryType = emp.status === 'regular' ? 'regular' : 'probation'
          const multiCurrencySalaries = empSalariesMap.get(salaryType) || []

          if (multiCurrencySalaries.length > 0) {
            // 过滤有效的薪资记录（如果 effectiveDate 存在，则检查是否在月份结束日期之前）
            const validSalaries = multiCurrencySalaries.filter(s => {
              if (!s.effectiveDate || s.effectiveDate === null) return true
              return s.effectiveDate <= monthEnd
            })

            if (validSalaries.length > 0) {
              // 按 effectiveDate 降序排序（如果存在），否则保持原顺序
              validSalaries.sort((a, b) => {
                const dateA = a.effectiveDate || ''
                const dateB = b.effectiveDate || ''
                if (!dateA && !dateB) return 0
                if (!dateA) return 1
                if (!dateB) return -1
                return dateB.localeCompare(dateA)
              })

              // 优先选择 USDT 薪资，否则选择第一个
              const usdtSalary = validSalaries.find(s => s.currencyCode === 'USDT')
              salaryCents = usdtSalary ? usdtSalary.amountCents : validSalaries[0].amountCents
            }
          }
        }

        if (joinYear === year && joinMonth === m) {
          workDays = daysInMonth - joinDate.getDate() + 1
        } else {
          workDays = daysInMonth
        }

        const monthStart = `${year}-${String(m).padStart(2, '0')}-01`

        let leaveDaysToDeduct = 0
        for (const leave of empLeaves) {
          if (leave.startDate <= monthEnd && leave.endDate >= monthStart) {
            if (leave.leaveType !== 'annual') {
              const leaveStart = new Date(leave.startDate + 'T00:00:00Z')
              const leaveEnd = new Date(leave.endDate + 'T00:00:00Z')
              const monthStartDate = new Date(monthStart + 'T00:00:00Z')
              const monthEndDate = new Date(monthEnd + 'T00:00:00Z')

              const overlapStart = leaveStart > monthStartDate ? leaveStart : monthStartDate
              const overlapEnd = leaveEnd < monthEndDate ? leaveEnd : monthEndDate

              if (overlapStart <= overlapEnd) {
                const overlapDays =
                  Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
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
          actualSalaryCents: actualSalaryCents,
        }
      }

      if (month) {
        const res = calculateMonth(month)
        if (res) {
          rows.push(res)
        }
      } else {
        for (let m = 1; m <= 12; m++) {
          const res = calculateMonth(m)
          if (res) {
            rows.push(res)
          }
        }
      }
    }

    const result = { results: rows }

    if (useCache) {
      const cacheKey = `report:salary:${year}:${month || 'all'}:${departmentId || 'all'}`
      try {
        await this.kv.put(cacheKey, JSON.stringify(result), { expirationTtl: 3600 })
      } catch (e) {
        Logger.warn('Cache write failed for salary report', { error: e })
      }
    }

    return result
  }

  async getAnnualLeaveReport(departmentId?: string, orgDepartmentId?: string) {
    const conditions = [eq(employees.active, 1)]
    if (departmentId) {
      conditions.push(eq(employees.departmentId, departmentId))
    }
    if (orgDepartmentId) {
      conditions.push(eq(employees.orgDepartmentId, orgDepartmentId))
    }

    const emps = await this.db
      .select({
        id: employees.id,
        name: employees.name,
        joinDate: employees.joinDate,
        departmentId: employees.departmentId,
        orgDepartmentId: employees.orgDepartmentId,
      })
      .from(employees)
      .where(and(...conditions))
      .all()

    const results = await Promise.all(
      emps.map(async emp => {
        if (!emp.joinDate) {
          return null
        }
        const annualLeaveStats = await this.annualLeaveService.getAnnualLeaveStats(emp.id, emp.joinDate)
        return {
          employeeId: emp.id,
          employeeName: emp.name,
          departmentId: emp.departmentId,
          orgDepartmentId: emp.orgDepartmentId,
          joinDate: emp.joinDate,
          cycleMonths: annualLeaveStats.config.cycleMonths,
          cycleNumber: annualLeaveStats.cycle.cycleNumber,
          cycleStart: annualLeaveStats.cycle.cycleStart,
          cycleEnd: annualLeaveStats.cycle.cycleEnd,
          isFirstCycle: annualLeaveStats.cycle.isFirstCycle,
          entitledDays: annualLeaveStats.entitledDays,
          usedDays: annualLeaveStats.usedDays,
          remainingDays: annualLeaveStats.remainingDays,
        }
      })
    )

    return {
      results: results.filter(r => r !== null),
    }
  }
}

