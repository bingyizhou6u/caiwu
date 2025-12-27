import { DrizzleD1Database } from 'drizzle-orm/d1'
import { eq, and, desc, inArray, sql } from 'drizzle-orm'
import * as schema from '../../db/schema.js'
import { Errors } from '../../utils/errors.js'
import { Logger } from '../../utils/logger.js'
import { EmployeeService } from '../hr/EmployeeService.js'
import { FinanceService } from '../finance/FinanceService.js'
import { PermissionService } from '../hr/PermissionService.js'
import { NotificationService } from './NotificationService.js'
import type { OperationHistoryService } from '../system/OperationHistoryService.js'
import { BatchQuery } from '../../utils/batch-query.js'
import { DBPerformanceTracker } from '../../utils/db-performance.js'
import {
  leaveStateMachine,
  reimbursementStateMachine,
  StateMachine,
} from '../../utils/state-machine.js'
import { QueryBuilder } from '../../utils/query-builder.js'
import { query } from '../../utils/query-helpers.js'
import type { Context } from 'hono'
import type { Env, AppVariables } from '../../types/index.js'

interface ApprovalRecord {
  id: string
  status: string | null
  employeeId?: string
  memo?: string | null
  [key: string]: any
}

export class ApprovalService {
  constructor(
    private db: DrizzleD1Database<typeof schema>,
    private permissionService: PermissionService,
    private employeeService: EmployeeService,
    private financeService: FinanceService,
    private notificationService: NotificationService,
    private operationHistoryService?: OperationHistoryService
  ) { }

  async getPendingApprovals(userId: string) {
    const subordinateIds = await this.employeeService.getSubordinateEmployeeIds(userId)

    if (subordinateIds.length === 0) {
      return {
        leaves: [],
        reimbursements: [],
        counts: { leaves: 0, reimbursements: 0 },
      }
    }

    // 使用顺序查询模式代替复杂 JOIN (D1 兼容性修复)

    // 1. 查询待审批请假
    const pendingLeaves = await this.db
      .select()
      .from(schema.employeeLeaves)
      .where(
        and(
          eq(schema.employeeLeaves.status, 'pending'),
          inArray(schema.employeeLeaves.employeeId, subordinateIds)
        )
      )
      .orderBy(desc(schema.employeeLeaves.createdAt))
      .execute()

    // 2. 查询待审批报销
    const pendingReimbursements = await this.db
      .select()
      .from(schema.expenseReimbursements)
      .where(
        and(
          eq(schema.expenseReimbursements.status, 'pending'),
          inArray(schema.expenseReimbursements.employeeId, subordinateIds)
        )
      )
      .orderBy(desc(schema.expenseReimbursements.createdAt))
      .execute()

    // 3. 收集所有员工ID和货币ID
    const allEmployeeIds = new Set<string>()
    const allCurrencyIds = new Set<string>()

    pendingLeaves.forEach(l => {
      if (l.employeeId) allEmployeeIds.add(l.employeeId)
    })
    pendingReimbursements.forEach(r => {
      if (r.employeeId) allEmployeeIds.add(r.employeeId)
      if (r.currencyId) allCurrencyIds.add(r.currencyId)
    })

    // 4. 批量查询员工信息（包含部门）
    const employeeMap = new Map<string, { name: string | null; departmentId: string | null; orgDepartmentId: string | null }>()
    if (allEmployeeIds.size > 0) {
      const employees = await this.db
        .select({
          id: schema.employees.id,
          name: schema.employees.name,
          departmentId: schema.employees.departmentId,
          orgDepartmentId: schema.employees.orgDepartmentId,
        })
        .from(schema.employees)
        .where(inArray(schema.employees.id, Array.from(allEmployeeIds)))
        .execute()

      employees.forEach(e => employeeMap.set(e.id, { name: e.name, departmentId: e.departmentId, orgDepartmentId: e.orgDepartmentId }))
    }

    // 5. 批量查询部门信息
    const allDeptIds = new Set<string>()
    const allOrgDeptIds = new Set<string>()
    employeeMap.forEach(e => {
      if (e.departmentId) allDeptIds.add(e.departmentId)
      if (e.orgDepartmentId) allOrgDeptIds.add(e.orgDepartmentId)
    })

    const deptMap = new Map<string, string>()
    const orgDeptMap = new Map<string, string>()

    if (allDeptIds.size > 0) {
      const depts = await this.db
        .select({ id: schema.departments.id, name: schema.departments.name })
        .from(schema.departments)
        .where(inArray(schema.departments.id, Array.from(allDeptIds)))
        .execute()
      depts.forEach(d => deptMap.set(d.id, d.name || ''))
    }

    if (allOrgDeptIds.size > 0) {
      const orgDepts = await this.db
        .select({ id: schema.orgDepartments.id, name: schema.orgDepartments.name })
        .from(schema.orgDepartments)
        .where(inArray(schema.orgDepartments.id, Array.from(allOrgDeptIds)))
        .execute()
      orgDepts.forEach(d => orgDeptMap.set(d.id, d.name || ''))
    }

    // 6. 批量查询货币信息
    const currencyMap = new Map<string, string>()
    if (allCurrencyIds.size > 0) {
      const currencies = await this.db
        .select({ code: schema.currencies.code, symbol: schema.currencies.symbol })
        .from(schema.currencies)
        .where(inArray(schema.currencies.code, Array.from(allCurrencyIds)))
        .execute()
      currencies.forEach(c => currencyMap.set(c.code, c.symbol || ''))
    }

    // 7. 组装结果
    const leavesWithInfo = pendingLeaves.map(l => {
      const emp = l.employeeId ? employeeMap.get(l.employeeId) : null
      return {
        ...l,
        employeeName: emp?.name || null,
        departmentName: emp?.departmentId ? deptMap.get(emp.departmentId) || null : null,
        orgDepartmentName: emp?.orgDepartmentId ? orgDeptMap.get(emp.orgDepartmentId) || null : null,
      }
    })

    const reimbursementsWithInfo = pendingReimbursements.map(r => {
      const emp = r.employeeId ? employeeMap.get(r.employeeId) : null
      return {
        ...r,
        employeeName: emp?.name || null,
        departmentName: emp?.departmentId ? deptMap.get(emp.departmentId) || null : null,
        orgDepartmentName: emp?.orgDepartmentId ? orgDeptMap.get(emp.orgDepartmentId) || null : null,
        currencySymbol: r.currencyId ? currencyMap.get(r.currencyId) || null : null,
      }
    })

    return {
      leaves: leavesWithInfo,
      reimbursements: reimbursementsWithInfo,
      counts: {
        leaves: pendingLeaves.length,
        reimbursements: pendingReimbursements.length,
      },
    }
  }

  /**
   * 通用审批处理方法
   * 统一处理审批和拒绝的逻辑
   */
  private async processApproval(params: {
    table: any
    id: string
    userId: string
    action: 'approve' | 'reject'
    stateMachine: StateMachine
    entityType: 'leave' | 'reimbursement'
    entityName: string
    memo?: string
    getEmployeeId?: (record: any, tx: any) => Promise<string>
    afterUpdate?: (record: any, tx: any, newStatus: string) => Promise<void>
  }, c?: Context<{ Bindings: Env; Variables: AppVariables }>) {
    const {
      table,
      id,
      userId,
      action,
      stateMachine,
      entityType,
      entityName,
      memo,
      getEmployeeId,
      afterUpdate,
    } = params

    await this.db.transaction(async tx => {
      const record = await query(
        tx as any,
        'ApprovalService.getApprovalRecord',
        () => tx.select().from(table).where(eq(table.id, id)).get(),
        c
      )
      if (!record) {
        throw Errors.NOT_FOUND(entityName)
      }

      const newStatus = action === 'approve' ? 'approved' : 'rejected'
      stateMachine.validateTransition(record.status || 'pending', newStatus)

      // 获取员工ID
      const employeeId = getEmployeeId
        ? await getEmployeeId(record, tx)
        : record.employeeId

      const canApprove = await this.permissionService.canApprove(userId, employeeId)
      if (!canApprove) {
        throw Errors.FORBIDDEN('无权审批')
      }

      const beforeData = { status: record.status }
      const now = Date.now()

      // 更新记录
      await tx
        .update(table)
        .set({
          status: newStatus,
          approvedBy: userId,
          approvedAt: now,
          memo: memo || record.memo,
          updatedAt: now,
        })
        .where(eq(table.id, id))
        .execute()

      // 执行额外的更新后逻辑
      if (afterUpdate) {
        await afterUpdate(record, tx, newStatus)
      }

      // 记录操作历史
      if (this.operationHistoryService) {
        this.operationHistoryService
          .recordOperation(entityType, id, newStatus, userId, beforeData, { status: newStatus }, memo)
          .catch(err => Logger.error('Failed to record operation history', { error: err }))
      }

      // 发送审批通知（异步，不阻塞审批流程）
      this.notificationService
        .notifyApprovalResult(entityType, id, newStatus, userId)
        .catch(err => Logger.error(`Failed to send ${entityType} ${newStatus} notification`, { error: err }))
    })
  }

  /**
   * 获取实体类型名称（用于错误消息）
   */
  private getEntityName(entityType: string): string {
    const names: Record<string, string> = {
      leave: '请假记录',
      reimbursement: '报销记录',
    }
    return names[entityType] || '记录'
  }

  async getApprovalHistory(userId: string, limit: number = 50) {
    // D1 兼容性修复：使用顺序查询代替复杂 JOIN
    // 1. 查询已审批的请假记录
    const approvedLeaves = await query(
      this.db,
      'ApprovalService.getApprovalHistory.getLeaves',
      () => this.db
        .select()
        .from(schema.employeeLeaves)
        .where(
          and(
            eq(schema.employeeLeaves.approvedBy, userId),
            inArray(schema.employeeLeaves.status, ['approved', 'rejected'])
          )
        )
        .orderBy(desc(schema.employeeLeaves.approvedAt))
        .limit(limit)
        .execute(),
      undefined
    )

    // 2. 查询已审批的报销记录
    const approvedReimbursements = await query(
      this.db,
      'ApprovalService.getApprovalHistory.getReimbursements',
      () => this.db
        .select()
        .from(schema.expenseReimbursements)
        .where(
          and(
            eq(schema.expenseReimbursements.approvedBy, userId),
            inArray(schema.expenseReimbursements.status, ['approved', 'rejected'])
          )
        )
        .orderBy(desc(schema.expenseReimbursements.approvedAt))
        .limit(limit)
        .execute(),
      undefined
    )

    if (approvedLeaves.length === 0 && approvedReimbursements.length === 0) {
      return { leaves: [], reimbursements: [] }
    }

    // 3. 批量查询员工信息
    const leaveEmployeeIds = [...new Set(approvedLeaves.map(l => l.employeeId).filter(Boolean) as string[])]
    const reimbursementEmployeeIds = [...new Set(approvedReimbursements.map(r => r.employeeId).filter(Boolean) as string[])]
    const allEmployeeIds = [...new Set([...leaveEmployeeIds, ...reimbursementEmployeeIds])]

    const employeesList = allEmployeeIds.length > 0
      ? await query(
          this.db,
          'ApprovalService.getApprovalHistory.getEmployees',
          () => this.db
            .select({
              id: schema.employees.id,
              name: schema.employees.name,
              departmentId: schema.employees.departmentId,
            })
            .from(schema.employees)
            .where(inArray(schema.employees.id, allEmployeeIds))
            .execute(),
          undefined
        )
      : []

    // 4. 批量查询部门信息
    const deptIds = [...new Set(employeesList.map(e => e.departmentId).filter(Boolean) as string[])]
    const departmentsList = deptIds.length > 0
      ? await query(
          this.db,
          'ApprovalService.getApprovalHistory.getDepartments',
          () => this.db
            .select({ id: schema.departments.id, name: schema.departments.name })
            .from(schema.departments)
            .where(inArray(schema.departments.id, deptIds))
            .execute(),
          undefined
        )
      : []

    // 5. 批量查询币种信息（用于报销）
    const currencyIds = [...new Set(approvedReimbursements.map(r => r.currencyId).filter(Boolean) as string[])]
    const currenciesList = currencyIds.length > 0
      ? await query(
          this.db,
          'ApprovalService.getApprovalHistory.getCurrencies',
          () => this.db
            .select({ code: schema.currencies.code, symbol: schema.currencies.symbol })
            .from(schema.currencies)
            .where(inArray(schema.currencies.code, currencyIds))
            .execute(),
          undefined
        )
      : []

    // 6. 创建映射表
    const employeeMap = new Map(employeesList.map(e => [e.id, e]))
    const deptMap = new Map(departmentsList.map(d => [d.id, d]))
    const currencyMap = new Map(currenciesList.map(c => [c.code, c]))

    // 7. 组装结果
    return {
      leaves: approvedLeaves.map(leave => {
        const employee = leave.employeeId ? employeeMap.get(leave.employeeId) : null
        const department = employee?.departmentId ? deptMap.get(employee.departmentId) : null
        return {
          ...leave,
          employeeName: employee?.name || null,
          departmentName: department?.name || null,
        }
      }),
      reimbursements: approvedReimbursements.map(reimbursement => {
        const employee = reimbursement.employeeId ? employeeMap.get(reimbursement.employeeId) : null
        const department = employee?.departmentId ? deptMap.get(employee.departmentId) : null
        const currency = reimbursement.currencyId ? currencyMap.get(reimbursement.currencyId) : null
        return {
          ...reimbursement,
          employeeName: employee?.name || null,
          departmentName: department?.name || null,
          currencySymbol: currency?.symbol || null,
        }
      }),
    }
  }

  async approveLeave(id: string, userId: string, memo?: string) {
    return this.processApproval({
      table: schema.employeeLeaves,
      id,
      userId,
      action: 'approve',
      stateMachine: leaveStateMachine,
      entityType: 'leave',
      entityName: '请假记录',
      memo,
    })
  }

  async rejectLeave(id: string, userId: string, memo?: string) {
    return this.processApproval({
      table: schema.employeeLeaves,
      id,
      userId,
      action: 'reject',
      stateMachine: leaveStateMachine,
      entityType: 'leave',
      entityName: '请假记录',
      memo,
    })
  }

  async approveReimbursement(id: string, userId: string, memo?: string) {
    return this.processApproval({
      table: schema.expenseReimbursements,
      id,
      userId,
      action: 'approve',
      stateMachine: reimbursementStateMachine,
      entityType: 'reimbursement',
      entityName: '报销记录',
      memo,
    })
  }

  async rejectReimbursement(id: string, userId: string, memo?: string) {
    return this.processApproval({
      table: schema.expenseReimbursements,
      id,
      userId,
      action: 'reject',
      stateMachine: reimbursementStateMachine,
      entityType: 'reimbursement',
      entityName: '报销记录',
      memo,
    })
  }

  /**
   * 批量审批请假
   */
  async batchApproveLeaves(
    ids: string[],
    userId: string,
    memo?: string
  ): Promise<{ success: string[]; failed: Array<{ id: string; error: string }> }> {
    const results = {
      success: [] as string[],
      failed: [] as Array<{ id: string; error: string }>,
    }

    for (const id of ids) {
      try {
        await this.approveLeave(id, userId, memo)
        results.success.push(id)
      } catch (error: any) {
        results.failed.push({ id, error: error.message || '审批失败' })
      }
    }

    return results
  }

  /**
   * 批量拒绝请假
   */
  async batchRejectLeaves(
    ids: string[],
    userId: string,
    memo?: string
  ): Promise<{ success: string[]; failed: Array<{ id: string; error: string }> }> {
    const results = {
      success: [] as string[],
      failed: [] as Array<{ id: string; error: string }>,
    }

    for (const id of ids) {
      try {
        await this.rejectLeave(id, userId, memo)
        results.success.push(id)
      } catch (error: any) {
        results.failed.push({ id, error: error.message || '拒绝失败' })
      }
    }

    return results
  }

  /**
   * 批量审批报销
   */
  async batchApproveReimbursements(
    ids: string[],
    userId: string,
    memo?: string
  ): Promise<{ success: string[]; failed: Array<{ id: string; error: string }> }> {
    const results = {
      success: [] as string[],
      failed: [] as Array<{ id: string; error: string }>,
    }

    for (const id of ids) {
      try {
        await this.approveReimbursement(id, userId, memo)
        results.success.push(id)
      } catch (error: any) {
        results.failed.push({ id, error: error.message || '审批失败' })
      }
    }

    return results
  }

  /**
   * 批量拒绝报销
   */
  async batchRejectReimbursements(
    ids: string[],
    userId: string,
    memo?: string
  ): Promise<{ success: string[]; failed: Array<{ id: string; error: string }> }> {
    const results = {
      success: [] as string[],
      failed: [] as Array<{ id: string; error: string }>,
    }

    for (const id of ids) {
      try {
        await this.rejectReimbursement(id, userId, memo)
        results.success.push(id)
      } catch (error: any) {
        results.failed.push({ id, error: error.message || '拒绝失败' })
      }
    }

    return results
  }
}
