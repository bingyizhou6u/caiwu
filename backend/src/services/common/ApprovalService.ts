import { DrizzleD1Database } from 'drizzle-orm/d1'
import { eq, and, desc, inArray, sql } from 'drizzle-orm'
import * as schema from '../db/schema.js'
import { Errors } from '../utils/errors.js'
import { Logger } from '../utils/logger.js'
import { EmployeeService } from '../hr/EmployeeService.js'
import { FinanceService } from '../finance/FinanceService.js'
import { PermissionService } from '../hr/PermissionService.js'
import { NotificationService } from './NotificationService.js'
import type { OperationHistoryService } from '../system/OperationHistoryService.js'
import { BatchQuery } from '../utils/batch-query.js'
import { DBPerformanceTracker } from '../utils/db-performance.js'
import {
  borrowingStateMachine,
  leaveStateMachine,
  reimbursementStateMachine,
  StateMachine,
} from '../utils/state-machine.js'
import { QueryBuilder } from '../utils/query-builder.js'

interface ApprovalRecord {
  id: string
  status: string | null
  employeeId?: string
  userId?: string // 借款使用 userId 而不是 employeeId
  memo?: string | null
  borrowDate?: string
  accountId?: string
  amountCents?: number
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
  ) {}

  async getPendingApprovals(userId: string) {
    const subordinateIds = await this.employeeService.getSubordinateEmployeeIds(userId)

    if (subordinateIds.length === 0) {
      return {
        leaves: [],
        reimbursements: [],
        borrowings: [],
        counts: { leaves: 0, reimbursements: 0, borrowings: 0 },
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

    // 待审批借款 - 使用批量查询优化
    const users = await DBPerformanceTracker.track(
      'ApprovalService.getPendingApprovals.getEmployees',
      () =>
        BatchQuery.getByIds(
          this.db,
          schema.employees,
          subordinateIds,
          {
            batchSize: 100,
            parallel: true,
            queryName: 'getEmployeesForApproval',
          }
        ).then((employees) => employees.map((e) => ({ id: e.id }))),
      undefined // Context 可选
    )

    const userIds = users.map(u => u.id)

    let pendingBorrowings: any[] = []
    if (userIds.length > 0) {
      pendingBorrowings = await this.db
        .select({
          borrowing: schema.borrowings,
          employeeName: schema.employees.name,
          currencySymbol: schema.currencies.symbol,
        })
        .from(schema.borrowings)
        .leftJoin(schema.employees, eq(schema.employees.id, schema.borrowings.userId))
        .leftJoin(schema.currencies, eq(schema.currencies.code, schema.borrowings.currency))
        .where(
          and(eq(schema.borrowings.status, 'pending'), inArray(schema.borrowings.userId, userIds))
        )
        .orderBy(desc(schema.borrowings.createdAt))
        .execute()
    }

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
      borrowings: pendingBorrowings.map(r => ({
        ...r.borrowing,
        employeeName: r.employeeName,
        currencySymbol: r.currencySymbol,
      })),
      counts: {
        leaves: pendingLeaves.length,
        reimbursements: pendingReimbursements.length,
        borrowings: pendingBorrowings.length,
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
    entityType: 'leave' | 'reimbursement' | 'borrowing'
    entityName: string
    memo?: string
    getEmployeeId?: (record: any, tx: any) => Promise<string>
    afterUpdate?: (record: any, tx: any, newStatus: string) => Promise<void>
  }) {
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
      const record = await tx.select().from(table).where(eq(table.id, id)).get()
      if (!record) {
        throw Errors.NOT_FOUND(entityName)
      }

      const newStatus = action === 'approve' ? 'approved' : 'rejected'
      stateMachine.validateTransition(record.status || 'pending', newStatus)

      // 获取员工ID（支持自定义逻辑，如借款需要特殊处理）
      const employeeId = getEmployeeId
        ? await getEmployeeId(record, tx)
        : (record.employeeId || record.userId)

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

      // 执行额外的更新后逻辑（如借款需要创建现金流）
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
      borrowing: '借支记录',
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

    const approvedBorrowings = await this.db
      .select({
        borrowing: schema.borrowings,
        employeeName: schema.employees.name,
        currencySymbol: schema.currencies.symbol,
      })
      .from(schema.borrowings)
      .leftJoin(schema.employees, eq(schema.employees.id, schema.borrowings.userId))
      .leftJoin(schema.currencies, eq(schema.currencies.code, schema.borrowings.currency))
      .where(
        and(
          eq(schema.borrowings.approvedBy, userId),
          inArray(schema.borrowings.status, ['approved', 'rejected'])
        )
      )
      .orderBy(desc(schema.borrowings.approvedAt))
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
      borrowings: approvedBorrowings.map(r => ({
        ...r.borrowing,
        employeeName: r.employeeName,
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

  async approveBorrowing(id: string, userId: string, memo?: string) {
    return this.processApproval({
      table: schema.borrowings,
      id,
      userId,
      action: 'approve',
      stateMachine: borrowingStateMachine,
      entityType: 'borrowing',
      entityName: '借支记录',
      memo,
      getEmployeeId: async (record, tx) => {
        return this.getBorrowerEmployeeId(record.userId, tx)
      },
      afterUpdate: async (record, tx, newStatus) => {
        // 审批通过后自动创建支出流水
        if (newStatus === 'approved') {
          try {
            const borrowingCategoryId = await this.getBorrowingCategoryId(tx)
            await this.financeService.createCashFlow(
              {
                bizDate: record.borrowDate,
                type: 'expense',
                accountId: record.accountId,
                amountCents: record.amountCents,
                categoryId: borrowingCategoryId,
                memo: `借款放款：${record.memo || ''}`,
                createdBy: userId,
              },
              tx
            )
          } catch (error: any) {
            // 如果创建现金流失败，记录错误但不影响审批流程
            Logger.error('Failed to create cash flow for borrowing', { error })
          }
        }
      },
    })
  }

  async rejectBorrowing(id: string, userId: string, memo?: string) {
    return this.processApproval({
      table: schema.borrowings,
      id,
      userId,
      action: 'reject',
      stateMachine: borrowingStateMachine,
      entityType: 'borrowing',
      entityName: '借支记录',
      memo,
      getEmployeeId: async (record, tx) => {
        return this.getBorrowerEmployeeId(record.userId, tx)
      },
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

  /**
   * 批量审批借款
   */
  async batchApproveBorrowings(
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
        await this.approveBorrowing(id, userId, memo)
        results.success.push(id)
      } catch (error: any) {
        results.failed.push({ id, error: error.message || '审批失败' })
      }
    }

    return results
  }

  /**
   * 批量拒绝借款
   */
  async batchRejectBorrowings(
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
        await this.rejectBorrowing(id, userId, memo)
        results.success.push(id)
      } catch (error: any) {
        results.failed.push({ id, error: error.message || '拒绝失败' })
      }
    }

    return results
  }

  // 辅助方法
  // checkApprovalPermission removed

  private async getBorrowerEmployeeId(borrowerUserId: string, tx?: any): Promise<string> {
    const db = tx || this.db
    const borrowerUser = await db
      .select({ email: schema.employees.email })
      .from(schema.employees)
      .where(eq(schema.employees.id, borrowerUserId))
      .get()
    if (!borrowerUser) {
      throw Errors.FORBIDDEN('无法找到申请人信息')
    }

    const borrowerEmployee = await db
      .select({ id: schema.employees.id })
      .from(schema.employees)
      .where(eq(schema.employees.email, borrowerUser.email))
      .get()
    if (!borrowerEmployee) {
      throw Errors.FORBIDDEN('无法找到申请人员工信息')
    }

    return borrowerEmployee.id
  }

  /**
   * 获取借款类别ID
   * 优先从系统配置获取，否则从categories表查询名为"借款"或"借支"的类别
   */
  private async getBorrowingCategoryId(tx?: any): Promise<string | null> {
    const db = tx || this.db
    
    // 尝试从系统配置获取
    const configRow = await db
      .select({ value: schema.systemConfig.value })
      .from(schema.systemConfig)
      .where(eq(schema.systemConfig.key, 'borrowing_category_id'))
      .get()
    
    if (configRow?.value) {
      return configRow.value
    }
    
    // 从categories表查询借款类别
    const category = await db
      .select({ id: schema.categories.id })
      .from(schema.categories)
      .where(
        and(
          eq(schema.categories.kind, 'expense'),
          eq(schema.categories.active, 1),
          // 查询名称包含"借款"或"借支"的类别
          sql`(${schema.categories.name} LIKE '%借款%' OR ${schema.categories.name} LIKE '%借支%')`
        )
      )
      .limit(1)
      .get()
    
    return category?.id || null
  }
}
