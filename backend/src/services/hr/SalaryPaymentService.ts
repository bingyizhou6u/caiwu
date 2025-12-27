/**
 * 薪资支付服务（核心流程）
 * 处理薪资支付的查询、确认、审批和删除
 */

import { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from '../../db/schema.js'
import {
  salaryPayments,
  salaryPaymentAllocations,
  employees,
  projects,
  orgDepartments,
  positions,
} from '../../db/schema.js'
import { eq, and, sql, inArray, desc } from 'drizzle-orm'
import { Errors } from '../../utils/errors.js'
import { Logger } from '../../utils/logger.js'
import { salaryPaymentStateMachine } from '../../utils/state-machine.js'
import { validateVersion, incrementVersion } from '../../utils/optimistic-lock.js'
import type { OperationHistoryService } from '../system/OperationHistoryService.js'
import { query as dbQuery } from '../../utils/query-helpers.js'
import type { Context } from 'hono'
import type { Env, AppVariables } from '../../types/index.js'

export class SalaryPaymentService {
  constructor(
    private db: DrizzleD1Database<typeof schema>,
    private operationHistoryService?: OperationHistoryService
  ) { }

  async list(
    query: { year?: number; month?: number; status?: string; employeeId?: string },
    userId?: string,
    isTeamMember = false
  ) {
    const conditions = []
    if (query.year) {
      conditions.push(eq(salaryPayments.year, query.year))
    }
    if (query.month) {
      conditions.push(eq(salaryPayments.month, query.month))
    }
    if (query.status) {
      conditions.push(eq(salaryPayments.status, query.status))
    }
    if (query.employeeId) {
      conditions.push(eq(salaryPayments.employeeId, query.employeeId))
    }

    // D1 兼容性修复：使用顺序查询代替复杂 JOIN
    // 1. 查询薪资支付记录
    const payments = await dbQuery(
      this.db,
      'SalaryPaymentService.list.getPayments',
      () => this.db
        .select()
        .from(salaryPayments)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(salaryPayments.year), desc(salaryPayments.month))
        .all(),
      undefined
    )

    if (payments.length === 0) {
      return []
    }

    // 2. 批量获取员工信息
    const employeeIds = [...new Set(payments.map(p => p.employeeId).filter(Boolean) as string[])]
    const employeesList = employeeIds.length > 0
      ? await dbQuery(
          this.db,
          'SalaryPaymentService.list.getEmployees',
          () => this.db
            .select({
              id: employees.id,
              name: employees.name,
              projectId: employees.projectId,
              orgProjectId: employees.orgProjectId,
              positionId: employees.positionId,
            })
            .from(employees)
            .where(inArray(employees.id, employeeIds))
            .all(),
          undefined
        )
      : []

    // 3. 批量获取部门和职位信息
    const deptIds = [...new Set(employeesList.map(e => e.projectId).filter(Boolean) as string[])]
    const orgDeptIds = [...new Set(employeesList.map(e => e.orgProjectId).filter(Boolean) as string[])]
    const positionIds = [...new Set(employeesList.map(e => e.positionId).filter(Boolean) as string[])]

    const [projectsList, orgDepartmentsList, positionsList] = await Promise.all([
      deptIds.length > 0
        ? dbQuery(
            this.db,
            'SalaryPaymentService.list.getDepartments',
            () => this.db
              .select({ id: projects.id, name: projects.name })
              .from(projects)
              .where(inArray(projects.id, deptIds))
              .all(),
            undefined
          )
        : Promise.resolve([]),
      orgDeptIds.length > 0
        ? dbQuery(
            this.db,
            'SalaryPaymentService.list.getOrgDepartments',
            () => this.db
              .select({ id: orgDepartments.id, name: orgDepartments.name })
              .from(orgDepartments)
              .where(inArray(orgDepartments.id, orgDeptIds))
              .all(),
            undefined
          )
        : Promise.resolve([]),
      positionIds.length > 0
        ? dbQuery(
            this.db,
            'SalaryPaymentService.list.getPositions',
            () => this.db
              .select({ id: positions.id, name: positions.name })
              .from(positions)
              .where(inArray(positions.id, positionIds))
              .all(),
            undefined
          )
        : Promise.resolve([]),
    ])

    // 4. 创建映射表
    const employeeMap = new Map(employeesList.map(e => [e.id, e]))
    const deptMap = new Map(projectsList.map(d => [d.id, d]))
    const orgDeptMap = new Map(orgDepartmentsList.map(od => [od.id, od]))
    const positionMap = new Map(positionsList.map(p => [p.id, p]))

    // 5. 组装结果
    const paymentsWithEmployeeInfo = payments.map(payment => {
      const employee = payment.employeeId ? employeeMap.get(payment.employeeId) : null
      const department = employee?.projectId ? deptMap.get(employee.projectId) : null
      const orgDepartment = employee?.orgProjectId ? orgDeptMap.get(employee.orgProjectId) : null
      const position = employee?.positionId ? positionMap.get(employee.positionId) : null

      return {
        payment,
        employeeName: employee?.name || null,
        employeeEmail: employee?.email || null,
        departmentName: department?.name || null,
        orgDepartmentName: orgDepartment?.name || null,
        positionName: position?.name || null,
      }
    })

    // 获取分配情况 - 添加性能监控
    const paymentIds = payments.map((p: any) => p.payment.id)
    let allocations: any[] = []
    if (paymentIds.length > 0) {
      allocations = await dbQuery(
        this.db,
        'SalaryPaymentService.list.getAllocations',
        () => this.db
          .select()
          .from(salaryPaymentAllocations)
          .where(inArray(salaryPaymentAllocations.salaryPaymentId, paymentIds))
          .all(),
        undefined
      )
    }

    const allocationsMap = new Map()
    allocations.forEach(a => {
      if (!allocationsMap.has(a.salaryPaymentId)) {
        allocationsMap.set(a.salaryPaymentId, [])
      }
      allocationsMap.get(a.salaryPaymentId).push(a)
    })

    return payments.map((p: any) => ({
      ...p.payment,
      employeeName: p.employeeName,
      departmentName: p.departmentName,
      allocations: allocationsMap.get(p.payment.id) || [],
    }))
  }

  async get(id: string) {
    // D1 兼容性修复：使用顺序查询代替复杂 JOIN
    const payment = await dbQuery(
      this.db,
      'SalaryPaymentService.get.getPayment',
      () => this.db
        .select()
        .from(salaryPayments)
        .where(eq(salaryPayments.id, id))
        .get(),
      undefined
    )

    if (!payment) {
      return null
    }

    // 批量查询员工和部门信息
    const employee = payment.employeeId
      ? await dbQuery(
          this.db,
          'SalaryPaymentService.get.getEmployee',
          () => this.db
            .select({
              id: employees.id,
              name: employees.name,
              projectId: employees.projectId,
            })
            .from(employees)
            .where(eq(employees.id, payment.employeeId))
            .get(),
          undefined
        )
      : null

    const department = employee?.projectId
      ? await dbQuery(
          this.db,
          'SalaryPaymentService.get.getDepartment',
          () => this.db
            .select({ id: projects.id, name: projects.name })
            .from(projects)
            .where(eq(projects.id, employee.projectId))
            .get(),
          undefined
        )
      : null

    const allocations = await this.db
      .select()
      .from(salaryPaymentAllocations)
      .where(eq(salaryPaymentAllocations.salaryPaymentId, id))
      .all()

    return {
      ...payment,
      employeeName: employee?.name || null,
      departmentName: payment.departmentName,
      allocations,
    }
  }

  async employeeConfirm(id: string, userId: string, expectedVersion?: number | null) {
    const payment = await this.db
      .select()
      .from(salaryPayments)
      .where(eq(salaryPayments.id, id))
      .get()
    if (!payment) {
      throw Errors.NOT_FOUND()
    }

    // 乐观锁版本检查
    if (expectedVersion !== undefined) {
      validateVersion(payment.version, expectedVersion)
    }

    // 状态机验证
    salaryPaymentStateMachine.validateTransition(payment.status, 'pending_finance_approval')

    const beforeData = { status: payment.status, version: payment.version }
    const now = Date.now()
    const newVersion = incrementVersion(payment.version)

    const result = await this.db
      .update(salaryPayments)
      .set({
        status: 'pending_finance_approval',
        employeeConfirmedBy: userId,
        employeeConfirmedAt: now,
        version: newVersion,
        updatedAt: now,
      })
      .where(eq(salaryPayments.id, id))
      .returning()
      .get()

    if (!result) {
      throw Errors.BUSINESS_ERROR('更新失败，可能已被其他用户修改')
    }

    // 记录操作历史
    if (this.operationHistoryService) {
      this.operationHistoryService
        .recordOperation(
          'salary_payment',
          id,
          'employee_confirmed',
          userId,
          beforeData,
          { status: 'pending_finance_approval' }
        )
        .catch(err => Logger.error('Failed to record operation history', { error: err }))
    }

    return this.get(id)
  }

  async financeApprove(id: string, userId: string, expectedVersion?: number | null) {
    // 检查分配状态
    const payment = await this.db
      .select()
      .from(salaryPayments)
      .where(eq(salaryPayments.id, id))
      .get()
    if (!payment) {
      throw Errors.NOT_FOUND()
    }

    // 乐观锁版本检查
    if (expectedVersion !== undefined && expectedVersion !== null) {
      validateVersion(payment.version, expectedVersion)
    }

    // 状态机验证
    salaryPaymentStateMachine.validateTransition(payment.status, 'pending_payment')

    if (payment.allocationStatus === 'requested') {
      throw Errors.BUSINESS_ERROR('必须先批准货币分配')
    }

    if (payment.allocationStatus === 'approved') {
      const pendingAllocations = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(salaryPaymentAllocations)
        .where(
          and(
            eq(salaryPaymentAllocations.salaryPaymentId, id),
            sql`${salaryPaymentAllocations.status} != 'approved'`
          )
        )
        .get()

      if (pendingAllocations && pendingAllocations.count > 0) {
        throw Errors.BUSINESS_ERROR('所有分配必须已批准')
      }
    }

    const beforeData = { status: payment.status, version: payment.version }
    const now = Date.now()
    const newVersion = incrementVersion(payment.version)

    await this.db
      .update(salaryPayments)
      .set({
        status: 'pending_payment',
        financeApprovedBy: userId,
        financeApprovedAt: now,
        version: newVersion,
        updatedAt: now,
      })
      .where(eq(salaryPayments.id, id))
      .run()

    // 记录操作历史
    if (this.operationHistoryService) {
      this.operationHistoryService
        .recordOperation(
          'salary_payment',
          id,
          'finance_approved',
          userId,
          beforeData,
          { status: 'pending_payment' }
        )
        .catch(err => Logger.error('Failed to record operation history', { error: err }))
    }

    return this.get(id)
  }

  async delete(id: string) {
    const payment = await this.db
      .select()
      .from(salaryPayments)
      .where(eq(salaryPayments.id, id))
      .get()
    if (!payment) {
      throw Errors.NOT_FOUND()
    }

    // 只有特定状态可以删除
    const allowedStatuses = ['pending_employee_confirmation', 'pending_finance_approval']
    if (!allowedStatuses.includes(payment.status)) {
      throw Errors.BUSINESS_ERROR('当前状态不允许删除')
    }

    await this.db.transaction(async tx => {
      await tx.delete(salaryPaymentAllocations).where(eq(salaryPaymentAllocations.salaryPaymentId, id)).run()
      await tx.delete(salaryPayments).where(eq(salaryPayments.id, id)).run()
    })

    return payment
  }

  async rollbackPayment(id: string, reason: string, userId: string, expectedVersion?: number | null) {
    const payment = await this.get(id)
    if (!payment) {
      throw Errors.NOT_FOUND()
    }

    // 状态检查：只有特定状态可以回退
    const allowedStatuses = [
      'pending_finance_approval',
      'pending_payment',
      'pending_payment_confirmation',
    ]

    if (!allowedStatuses.includes(payment.status)) {
      throw Errors.BUSINESS_ERROR('当前状态不允许回退')
    }

    // 状态机验证
    const rollbackMap: Record<string, string> = {
      pending_finance_approval: 'pending_employee_confirmation',
      pending_payment: 'pending_finance_approval',
      pending_payment_confirmation: 'pending_payment',
    }

    const targetStatus = rollbackMap[payment.status]
    if (!targetStatus) {
      throw Errors.BUSINESS_ERROR('无法确定回退目标状态')
    }

    // 验证状态转换
    salaryPaymentStateMachine.validateTransition(payment.status, targetStatus)

    const beforeData = { status: payment.status }
    const now = Date.now()
    await this.db
      .update(salaryPayments)
      .set({
        status: targetStatus,
        rollbackReason: reason,
        rollbackBy: userId,
        rollbackAt: now,
        updatedAt: now,
      })
      .where(eq(salaryPayments.id, id))
      .run()

    // 记录操作历史
    if (this.operationHistoryService) {
      this.operationHistoryService
        .recordOperation(
          'salary_payment',
          id,
          'rolled_back',
          userId,
          beforeData,
          { status: targetStatus },
          reason
        )
        .catch(err => Logger.error('Failed to record operation history', { error: err }))
    }

    return this.get(id)
  }
}
