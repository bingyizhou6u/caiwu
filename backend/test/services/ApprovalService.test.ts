import { env } from 'cloudflare:test'
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { drizzle } from 'drizzle-orm/d1'
import { ApprovalService } from '../../src/services/common/ApprovalService.js'
import { PermissionService } from '../../src/services/hr/PermissionService.js'
import { EmployeeService } from '../../src/services/hr/EmployeeService.js'
import { FinanceService } from '../../src/services/finance/FinanceService.js'
import { NotificationService } from '../../src/services/common/NotificationService.js'
import { OperationHistoryService } from '../../src/services/system/OperationHistoryService.js'
import {
  employees,
  departments,
  orgDepartments,
  positions,
  employeeLeaves,
  expenseReimbursements,
  currencies,
} from '../../src/db/schema.js'
import { eq } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import * as schema from '../../src/db/schema.js'
import schemaSql from '../../src/db/schema.sql?raw'

describe('ApprovalService', () => {
  let service: ApprovalService
  let db: ReturnType<typeof drizzle<typeof schema>>
  let operationHistoryService: OperationHistoryService


  // Data IDs
  let managerUserId: string
  let subordinateUserId: string
  let otherUserId: string
  let subordinateEmployeeId: string
  let otherEmployeeId: string

  // Position/Dept IDs

  let managerPosId: string
  let engineerPosId: string
  let deptId: string
  let otherDeptId: string
  let orgDeptId: string
  let otherOrgDeptId: string

  beforeAll(async () => {
    // Apply schema
    const statements = schemaSql.split(';').filter(s => s.trim().length > 0)
    for (const statement of statements) {
      await env.DB.prepare(statement).run()
    }
    db = drizzle(env.DB, { schema })
    // @ts-ignore
    db.transaction = async cb => cb(db)
    const permissionService = new PermissionService(db)
    // Use real EmployeeService with mock EmailService
    const mockEmailService = {
      sendActivationEmail: vi.fn(),
      sendLoginNotificationEmail: vi.fn(),
      sendApprovalNotificationEmail: vi.fn().mockResolvedValue({ success: true }),
    } as any
    const employeeService = new EmployeeService(db, mockEmailService)
    const financeService = new FinanceService(db)
    const mockSystemConfigService = { get: async () => ({ value: 'false' }) } as any
    const notificationService = new NotificationService(db, mockEmailService, mockSystemConfigService)
    operationHistoryService = new OperationHistoryService(db)
    service = new ApprovalService(
      db,
      permissionService,
      employeeService,
      financeService,
      notificationService,
      operationHistoryService
    )

    // Seed Currencies
    await db.insert(currencies).values({ code: 'CNY', name: 'RMB', active: 1 }).execute()

    // Seed Positions
    managerPosId = uuid()
    await db
      .insert(positions)
      .values({
        id: managerPosId,
        level: 3,
        code: 'team_leader', // Added to satisfy EmployeeService.getSubordinateEmployeeIds
        functionRole: 'manager',
        name: 'Manager',
        canManageSubordinates: 1,
        active: 1,
      })
      .execute()

    engineerPosId = uuid()
    await db
      .insert(positions)
      .values({
        id: engineerPosId,
        code: 'team_engineer',
        name: 'Engineer',
        level: 3,
        functionRole: 'developer',
        canManageSubordinates: 0,
        active: 1,
      })
      .execute()

    // Seed Departments
    deptId = uuid()
    await db.insert(departments).values({ id: deptId, name: 'Dept A', active: 1 }).execute()
    orgDeptId = uuid()
    await db
      .insert(orgDepartments)
      .values({ id: orgDeptId, name: 'Org Dept A', projectId: deptId, active: 1 })
      .execute()

    otherDeptId = uuid()
    await db.insert(departments).values({ id: otherDeptId, name: 'Dept B', active: 1 }).execute()
    otherOrgDeptId = uuid()
    await db
      .insert(orgDepartments)
      .values({ id: otherOrgDeptId, name: 'Org Dept B', projectId: otherDeptId, active: 1 })
      .execute()
  })

  beforeEach(async () => {
    // Clean Transactional Tables
    await db.delete(employeeLeaves).execute()
    await db.delete(expenseReimbursements).execute()
    await db.delete(employees).execute()

    // Seed Users & Employees

    // 1. Manager (Dept A, Org Dept A)
    managerUserId = uuid()
    const managerEmail = 'manager@example.com'
    await db
      .insert(employees)
      .values({
        id: managerUserId,
        email: managerEmail,
        name: 'Manager',
        positionId: managerPosId,
        departmentId: deptId,
        orgDepartmentId: orgDeptId,
        active: 1,
      })
      .execute()

    // 2. Subordinate (Dept A, Org Dept A)
    subordinateUserId = uuid()
    subordinateEmployeeId = subordinateUserId // Fix: Use same ID
    const subEmail = 'sub@example.com'
    await db
      .insert(employees)
      .values({
        id: subordinateUserId,
        email: subEmail,
        name: 'Subordinate',
        positionId: engineerPosId,
        departmentId: deptId,
        orgDepartmentId: orgDeptId,
        active: 1,
      })
      .execute()

    // 3. Other (Dept B, Org Dept B)
    otherUserId = uuid()
    otherEmployeeId = otherUserId // Fix: Use same ID
    const otherEmail = 'other@example.com'
    await db
      .insert(employees)
      .values({
        id: otherUserId,
        email: otherEmail,
        name: 'Other',
        positionId: engineerPosId,
        departmentId: otherDeptId,
        orgDepartmentId: otherOrgDeptId,
        active: 1,
      })
      .execute()
  })

  describe('getPendingApprovals', () => {
    it('should return pending items for subordinates', async () => {
      // Create pending items for subordinate
      await db
        .insert(employeeLeaves)
        .values({
          id: uuid(),
          employeeId: subordinateEmployeeId,
          leaveType: 'sick',
          startDate: '2023-01-01',
          endDate: '2023-01-02',
          days: 2,
          status: 'pending',
          createdAt: Date.now(),
        })
        .execute()

      await db
        .insert(expenseReimbursements)
        .values({
          id: uuid(),
          employeeId: subordinateEmployeeId,
          expenseType: 'meal',
          amountCents: 1000,
          currencyId: 'CNY',
          expenseDate: '2023-01-01',
          description: 'Lunch',
          status: 'pending',
          createdAt: Date.now(),
        })
        .execute()

      const result = await service.getPendingApprovals(managerUserId)

      expect(result.counts.leaves).toBe(1)
      expect(result.counts.reimbursements).toBe(1)
      expect(result.leaves[0].employeeName).toBe('Subordinate')
    })

    it('should NOT return items for non-subordinates', async () => {
      // Create pending items for other employee (Dept B)
      await db
        .insert(employeeLeaves)
        .values({
          id: uuid(),
          employeeId: otherEmployeeId,
          leaveType: 'sick',
          startDate: '2023-01-01',
          endDate: '2023-01-02',
          days: 2,
          status: 'pending',
          createdAt: Date.now(),
        })
        .execute()

      const result = await service.getPendingApprovals(managerUserId)
      expect(result.counts.leaves).toBe(0)
    })
  })

  describe('approveLeave', () => {
    it('should approve leave for subordinate', async () => {
      const leaveId = uuid()
      await db
        .insert(employeeLeaves)
        .values({
          id: leaveId,
          employeeId: subordinateEmployeeId,
          leaveType: 'sick',
          startDate: '2023-01-01',
          endDate: '2023-01-02',
          days: 2,
          status: 'pending',
          createdAt: Date.now(),
        })
        .execute()

      await service.approveLeave(leaveId, managerUserId, 'Approved')

      const updated = await db
        .select()
        .from(employeeLeaves)
        .where(eq(employeeLeaves.id, leaveId))
        .get()
      expect(updated?.status).toBe('approved')
      expect(updated?.approvedBy).toBe(managerUserId)
      expect(updated?.memo).toBe('Approved')
    })

    it('should throw FORBIDDEN for non-subordinate', async () => {
      const leaveId = uuid()
      await db
        .insert(employeeLeaves)
        .values({
          id: leaveId,
          employeeId: otherEmployeeId,
          leaveType: 'sick',
          startDate: '2023-01-01',
          endDate: '2023-01-02',
          days: 2,
          status: 'pending',
          createdAt: Date.now(),
        })
        .execute()

      await expect(service.approveLeave(leaveId, managerUserId)).rejects.toThrow('无权审批')
    })
  })

  describe('rejectLeave', () => {
    it('should reject leave', async () => {
      const leaveId = uuid()
      await db
        .insert(employeeLeaves)
        .values({
          id: leaveId,
          employeeId: subordinateEmployeeId,
          leaveType: 'sick',
          startDate: '2023-01-01',
          endDate: '2023-01-02',
          days: 2,
          status: 'pending',
          createdAt: Date.now(),
        })
        .execute()

      await service.rejectLeave(leaveId, managerUserId, 'Rejected')

      const updated = await db
        .select()
        .from(employeeLeaves)
        .where(eq(employeeLeaves.id, leaveId))
        .get()
      expect(updated?.status).toBe('rejected')
    })
  })

  describe('approveReimbursement', () => {
    it('should approve reimbursement', async () => {
      const id = uuid()
      await db
        .insert(expenseReimbursements)
        .values({
          id,
          employeeId: subordinateEmployeeId,
          expenseType: 'meal',
          amountCents: 1000,
          currencyId: 'CNY',
          expenseDate: '2023-01-01',
          description: 'Lunch',
          status: 'pending',
          createdAt: Date.now(),
        })
        .execute()

      // Note: approveReimbursement in service currently DOES NOT check permission explicitly inside the method
      // It relies on route handler or caller to check permission or it assumes anyone calling it has permission?
      // Let's check the code:
      // `approveReimbursement` implementation:
      // It fetches record, checks pending. Then updates.
      // IT DOES NOT CALL `getSubordinateEmployeeIds` unlike `approveLeave`.
      // This might be a BUG or intended design (controller handles it).
      // But `approveLeave` checks it. `approveReimbursement` logic is inconsistent.
      // Let's verify this behavior in test.

      // If I call it as manager for subordinate, it should work.
      await service.approveReimbursement(id, managerUserId)
      const updated = await db
        .select()
        .from(expenseReimbursements)
        .where(eq(expenseReimbursements.id, id))
        .get()
      expect(updated?.status).toBe('approved')
    })

    it('should throw FORBIDDEN for non-subordinate reimbursement', async () => {
      const id = uuid()
      await db
        .insert(expenseReimbursements)
        .values({
          id,
          employeeId: otherEmployeeId, // Dept B
          expenseType: 'meal',
          amountCents: 1000,
          currencyId: 'CNY',
          expenseDate: '2023-01-01',
          description: 'Lunch',
          status: 'pending',
          createdAt: Date.now(),
        })
        .execute()

      await expect(service.approveReimbursement(id, managerUserId)).rejects.toThrow('无权审批')
    })
  })

  describe('操作历史记录', () => {
    it('应该在审批请假时记录操作历史', async () => {
      const leaveId = uuid()
      await db
        .insert(employeeLeaves)
        .values({
          id: leaveId,
          employeeId: subordinateEmployeeId,
          leaveType: 'sick',
          startDate: '2023-01-01',
          endDate: '2023-01-03',
          days: 3,
          status: 'pending',
          createdAt: Date.now(),
        })
        .execute()

      await service.approveLeave(leaveId, managerUserId, 'Approved')

      const history = await operationHistoryService.getEntityHistory('leave', leaveId)
      expect(history.length).toBe(1)
      expect(history[0].action).toBe('approved')
      expect(history[0].operatorId).toBe(managerUserId)
    })

    it('应该在拒绝报销时记录操作历史', async () => {
      const id = uuid()
      await db
        .insert(expenseReimbursements)
        .values({
          id,
          employeeId: subordinateEmployeeId,
          expenseType: 'travel',
          amountCents: 5000,
          currencyId: 'CNY',
          expenseDate: '2023-01-01',
          description: 'Travel',
          status: 'pending',
          createdAt: Date.now(),
        })
        .execute()

      await service.rejectReimbursement(id, managerUserId, 'Rejected')

      const history = await operationHistoryService.getEntityHistory('reimbursement', id)
      expect(history.length).toBe(1)
      expect(history[0].action).toBe('rejected')
      expect(history[0].operatorId).toBe(managerUserId)
    })
  })

  describe('状态机验证', () => {
    it('应该拒绝无效的状态转换', async () => {
      const leaveId = uuid()
      await db
        .insert(employeeLeaves)
        .values({
          id: leaveId,
          employeeId: subordinateEmployeeId,
          leaveType: 'sick',
          startDate: '2023-01-01',
          endDate: '2023-01-03',
          days: 3,
          status: 'approved', // 已经是 approved 状态
          createdAt: Date.now(),
        })
        .execute()

      // 尝试再次审批应该失败（状态机验证）
      await expect(service.approveLeave(leaveId, managerUserId)).rejects.toThrow()
    })
  })

  describe('批量操作', () => {
    it('应该支持批量审批请假', async () => {
      const leaveId1 = uuid()
      const leaveId2 = uuid()

      await db
        .insert(employeeLeaves)
        .values([
          {
            id: leaveId1,
            employeeId: subordinateEmployeeId,
            leaveType: 'sick',
            startDate: '2023-01-01',
            endDate: '2023-01-03',
            days: 3,
            status: 'pending',
            createdAt: Date.now(),
          },
          {
            id: leaveId2,
            employeeId: subordinateEmployeeId,
            leaveType: 'annual',
            startDate: '2023-01-05',
            endDate: '2023-01-07',
            days: 3,
            status: 'pending',
            createdAt: Date.now(),
          },
        ])
        .execute()

      const result = await service.batchApproveLeaves(
        [leaveId1, leaveId2],
        managerUserId,
        'Batch approved'
      )

      expect(result.success.length).toBe(2)
      expect(result.failed.length).toBe(0)

      const leave1 = await db
        .select()
        .from(employeeLeaves)
        .where(eq(employeeLeaves.id, leaveId1))
        .get()
      const leave2 = await db
        .select()
        .from(employeeLeaves)
        .where(eq(employeeLeaves.id, leaveId2))
        .get()

      expect(leave1?.status).toBe('approved')
      expect(leave2?.status).toBe('approved')
    })

    it('应该处理批量操作中的部分失败', async () => {
      const leaveId1 = uuid()
      const leaveId2 = uuid()
      const invalidId = uuid()

      await db
        .insert(employeeLeaves)
        .values([
          {
            id: leaveId1,
            employeeId: subordinateEmployeeId,
            leaveType: 'sick',
            startDate: '2023-01-01',
            endDate: '2023-01-03',
            days: 3,
            status: 'pending',
            createdAt: Date.now(),
          },
        ])
        .execute()

      const result = await service.batchApproveLeaves(
        [leaveId1, invalidId],
        managerUserId
      )

      expect(result.success.length).toBe(1)
      expect(result.success[0]).toBe(leaveId1)
      expect(result.failed.length).toBe(1)
      expect(result.failed[0].id).toBe(invalidId)
    })
  })
})
