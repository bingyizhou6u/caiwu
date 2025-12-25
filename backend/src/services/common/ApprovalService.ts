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

    // 待审批请假 - 使用QueryBuilder优化关联查询
    const pendingLeavesQuery = QueryBuilder.buildEmployeeJoinQuery(
      this.db,
      schema.employeeLeaves,
      schema.employeeLeaves.employeeId,
      { leave: schema.employeeLeaves }
    )
    const pendingLeaves = await pendingLeavesQuery
      .where(
        and(
          eq(schema.employeeLeaves.status, 'pending'),
          inArray(schema.employeeLeaves.employeeId, subordinateIds)
        )
      )
      .orderBy(desc(schema.employeeLeaves.createdAt))
      .execute()

    // 待审批报销 - 使用QueryBuilder优化员工关联查询
    const pendingReimbursementsQuery = QueryBuilder.buildEmployeeJoinQuery(
      this.db,
      schema.expenseReimbursements,
      schema.expenseReimbursements.employeeId,
      {
        reimbursement: schema.expenseReimbursements,
        currencySymbol: schema.currencies.symbol,
      }
    )
    const pendingReimbursements = await pendingReimbursementsQuery
      .leftJoin(
        schema.currencies,
        eq(schema.currencies.code, schema.expenseReimbursements.currencyId)
      )
      .where(
        and(
          eq(schema.expenseReimbursements.status, 'pending'),
          inArray(schema.expenseReimbursements.employeeId, subordinateIds)
        )
      )
      .orderBy(desc(schema.expenseReimbursements.createdAt))
      .execute()

    return {
      leaves: pendingLeaves.map(r => ({
        ...r.leave,
        employeeName: r.employeeName,
        departmentName: r.departmentName,
        orgDepartmentName: r.orgDepartmentName,
      })),
      reimbursements: pendingReimbursements.map(r => ({
        ...r.reimbursement,
        employeeName: r.employeeName,
        departmentName: r.departmentName,
        orgDepartmentName: r.orgDepartmentName,
        currencySymbol: r.currencySymbol,
      })),
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
    const approvedLeaves = await this.db
      .select({
        leave: schema.employeeLeaves,
        employeeName: schema.employees.name,
        departmentName: schema.departments.name,
      })
      .from(schema.employeeLeaves)
      .leftJoin(schema.employees, eq(schema.employees.id, schema.employeeLeaves.employeeId))
      .leftJoin(schema.departments, eq(schema.departments.id, schema.employees.departmentId))
      .where(
        and(
          eq(schema.employeeLeaves.approvedBy, userId),
          inArray(schema.employeeLeaves.status, ['approved', 'rejected'])
        )
      )
      .orderBy(desc(schema.employeeLeaves.approvedAt))
      .limit(limit)
      .execute()

    const approvedReimbursements = await this.db
      .select({
        reimbursement: schema.expenseReimbursements,
        employeeName: schema.employees.name,
        departmentName: schema.departments.name,
        currencySymbol: schema.currencies.symbol,
      })
      .from(schema.expenseReimbursements)
      .leftJoin(schema.employees, eq(schema.employees.id, schema.expenseReimbursements.employeeId))
      .leftJoin(schema.departments, eq(schema.departments.id, schema.employees.departmentId))
      .leftJoin(
        schema.currencies,
        eq(schema.currencies.code, schema.expenseReimbursements.currencyId)
      )
      .where(
        and(
          eq(schema.expenseReimbursements.approvedBy, userId),
          inArray(schema.expenseReimbursements.status, ['approved', 'rejected'])
        )
      )
      .orderBy(desc(schema.expenseReimbursements.approvedAt))
      .limit(limit)
      .execute()

    return {
      leaves: approvedLeaves.map(r => ({
        ...r.leave,
        employeeName: r.employeeName,
        departmentName: r.departmentName,
      })),
      reimbursements: approvedReimbursements.map(r => ({
        ...r.reimbursement,
        employeeName: r.employeeName,
        departmentName: r.departmentName,
        currencySymbol: r.currencySymbol,
      })),
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
