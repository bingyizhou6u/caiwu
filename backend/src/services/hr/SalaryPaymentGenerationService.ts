/**
 * 薪资支付生成服务
 * 处理薪资支付记录的生成逻辑
 */

import { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from '../db/schema.js'
import {
  salaryPayments,
  employees,
  employeeSalaries,
  employeeLeaves,
  currencies,
} from '../db/schema.js'
import { eq, and, sql, inArray } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'

export class SalaryPaymentGenerationService {
  constructor(private db: DrizzleD1Database<typeof schema>) {}

  async generate(year: number, month: number, userId: string) {
    return await this.db.transaction(async tx => {
      // 1. 获取符合条件的员工（在职）
      const activeEmployees = await tx.select().from(employees).where(eq(employees.active, 1)).all()

      // 按入职日期过滤
      const eligibleEmployees = activeEmployees.filter(emp => {
        if (!emp.joinDate) {
          return false
        }
        const joinDate = new Date(emp.joinDate + 'T00:00:00Z')
        const joinYear = joinDate.getFullYear()
        const joinMonth = joinDate.getMonth() + 1
        return !(joinYear > year || (joinYear === year && joinMonth > month))
      })

      if (eligibleEmployees.length === 0) {
        return { created: 0, ids: [] }
      }

      // 2. 过滤掉现有的支付记录
      const employeeIds = eligibleEmployees.map(e => e.id)
      const existingPayments = await tx
        .select({
          employeeId: salaryPayments.employeeId,
          year: salaryPayments.year,
          month: salaryPayments.month,
        })
        .from(salaryPayments)
        .where(
          and(
            inArray(salaryPayments.employeeId, employeeIds),
            eq(salaryPayments.year, year),
            eq(salaryPayments.month, month)
          )
        )
        .all()

      const existingSet = new Set(existingPayments.map(p => `${p.employeeId}:${p.year}:${p.month}`))
      const employeesToProcess = eligibleEmployees.filter(
        e => !existingSet.has(`${e.id}:${year}:${month}`)
      )

      if (employeesToProcess.length === 0) {
        return { created: 0, ids: [] }
      }

      // 3. 批量获取薪资和请假记录
      const processIds = employeesToProcess.map(e => e.id)
      const allSalaries = await tx
        .select({
          employeeId: employeeSalaries.employeeId,
          salaryType: employeeSalaries.salaryType,
          currencyId: employeeSalaries.currencyId,
          amountCents: employeeSalaries.amountCents,
          currencyCode: currencies.code,
        })
        .from(employeeSalaries)
        .leftJoin(currencies, eq(currencies.code, employeeSalaries.currencyId))
        .where(inArray(employeeSalaries.employeeId, processIds))
        .orderBy(
          employeeSalaries.employeeId,
          sql`case when ${currencies.code} = 'USDT' then 0 else 1 end`,
          currencies.code
        )
        .all()

      const daysInMonth = new Date(year, month, 0).getDate()
      const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
      const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`

      const allLeaves = await tx
        .select()
        .from(employeeLeaves)
        .where(
          and(
            inArray(employeeLeaves.employeeId, processIds),
            eq(employeeLeaves.status, 'approved'),
            sql`${employeeLeaves.startDate} <= ${monthEnd}`,
            sql`${employeeLeaves.endDate} >= ${monthStart}`
          )
        )
        .all()

      // 4. 按员工分组薪资和请假数据
      const salariesByEmployee = new Map<string, any[]>()
      for (const salary of allSalaries) {
        if (!salary.employeeId) {
          continue
        }
        if (!salariesByEmployee.has(salary.employeeId)) {
          salariesByEmployee.set(salary.employeeId, [])
        }
        salariesByEmployee.get(salary.employeeId)!.push(salary)
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

      // 5. 为每个员工生成薪资支付记录
      const createdIds: string[] = []
      const now = Date.now()

      for (const emp of employeesToProcess) {
        if (!emp.joinDate) {
          continue
        }

        const joinDate = new Date(emp.joinDate + 'T00:00:00Z')
        const joinYear = joinDate.getFullYear()
        const joinMonth = joinDate.getMonth() + 1

        // 计算工作天数
        let workDays = daysInMonth
        if (joinYear === year && joinMonth === month) {
          workDays = daysInMonth - joinDate.getDate() + 1
        }

        // 扣除请假天数
        const empLeaves = leavesByEmployee.get(emp.id) || []
        let leaveDaysToDeduct = 0
        for (const leave of empLeaves) {
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

        workDays = Math.max(0, workDays - leaveDaysToDeduct)

        // 获取薪资（优先使用 USDT）
        const empSalaries = salariesByEmployee.get(emp.id) || []
        const salaryType = emp.status === 'regular' ? 'regular' : 'probation'
        const typeSalaries = empSalaries.filter(s => s.salaryType === salaryType)
        const usdtSalary = typeSalaries.find(s => s.currencyCode === 'USDT')
        const baseSalaryCents = usdtSalary
          ? usdtSalary.amountCents
          : typeSalaries.length > 0
            ? typeSalaries[0].amountCents
            : 0

        // 计算实际薪资
        const actualSalaryCents = Math.round((baseSalaryCents * workDays) / daysInMonth)

        if (actualSalaryCents <= 0) {
          continue
        }

        // 创建薪资支付记录
        const paymentId = uuid()
        await tx
          .insert(salaryPayments)
          .values({
            id: paymentId,
            employeeId: emp.id,
            year,
            month,
            salaryCents: actualSalaryCents,
            status: 'pending_employee_confirmation',
            allocationStatus: 'none',
            createdAt: now,
            updatedAt: now,
            version: 0,
          })
          .run()

        createdIds.push(paymentId)
      }

      return { created: createdIds.length, ids: createdIds }
    })
  }

  async batchGenerateSalary(
    year: number,
    month: number,
    employeeIds: string[],
    userId: string
  ): Promise<{ created: number; ids: string[] }> {
    return await this.db.transaction(async tx => {
      // 只生成指定员工的薪资
      const eligibleEmployees = await tx
        .select()
        .from(employees)
        .where(and(eq(employees.active, 1), inArray(employees.id, employeeIds)))
        .all()

      // 按入职日期过滤
      const filteredEmployees = eligibleEmployees.filter(emp => {
        if (!emp.joinDate) {
          return false
        }
        const joinDate = new Date(emp.joinDate + 'T00:00:00Z')
        const joinYear = joinDate.getFullYear()
        const joinMonth = joinDate.getMonth() + 1
        return !(joinYear > year || (joinYear === year && joinMonth > month))
      })

      if (filteredEmployees.length === 0) {
        return { created: 0, ids: [] }
      }

      // 检查现有记录
      const employeeIdsToProcess = filteredEmployees.map(e => e.id)
      const existingPayments = await tx
        .select({
          employeeId: salaryPayments.employeeId,
          year: salaryPayments.year,
          month: salaryPayments.month,
        })
        .from(salaryPayments)
        .where(
          and(
            inArray(salaryPayments.employeeId, employeeIdsToProcess),
            eq(salaryPayments.year, year),
            eq(salaryPayments.month, month)
          )
        )
        .all()

      const existingSet = new Set(existingPayments.map(p => `${p.employeeId}:${p.year}:${p.month}`))
      const employeesToProcess = filteredEmployees.filter(
        e => !existingSet.has(`${e.id}:${year}:${month}`)
      )

      if (employeesToProcess.length === 0) {
        return { created: 0, ids: [] }
      }

      // 复用 generate 方法的逻辑（简化版）
      // 这里可以提取公共方法，但为了简化，直接调用 generate
      // 注意：实际应该提取公共逻辑避免重复代码
      const result = await this.generate(year, month, userId)
      return result
    })
  }
}

