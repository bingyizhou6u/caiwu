import { DrizzleD1Database } from 'drizzle-orm/d1'
import { eq, and, desc, sql } from 'drizzle-orm'
import { employeeLeaves, employees } from '../../db/schema.js'
import * as schema from '../../db/schema.js'
import { nanoid } from 'nanoid'
import { Errors } from '../../utils/errors.js'
import { leaveStateMachine } from '../../utils/state-machine.js'

export class EmployeeLeaveService {
  constructor(private db: DrizzleD1Database<typeof schema>) { }

  async listLeaves(params: { employeeId?: string; status?: string; year?: string }) {
    // D1 兼容性修复：使用顺序查询代替 LEFT JOIN

    // 1. 查询请假记录
    let query = this.db
      .select()
      .from(employeeLeaves)
      .$dynamic()

    const filters = []
    if (params.employeeId) { filters.push(eq(employeeLeaves.employeeId, params.employeeId)) }
    if (params.status) { filters.push(eq(employeeLeaves.status, params.status)) }
    if (params.year) {
      filters.push(sql`strftime('%Y', ${employeeLeaves.startDate}) = ${params.year} `)
    }

    if (filters.length > 0) {
      query = query.where(and(...filters))
    }

    const leaves = await query.orderBy(desc(employeeLeaves.createdAt))

    if (leaves.length === 0) {
      return []
    }

    // 2. 批量获取员工名称
    const employeeIds = [...new Set(leaves.map(l => l.employeeId).filter(Boolean))]
    const employeeMap = new Map<string, string>()

    if (employeeIds.length > 0) {
      const emps = await this.db
        .select({ id: employees.id, name: employees.name })
        .from(employees)
        .where(sql`${employees.id} IN (${sql.join(employeeIds.map(id => sql`${id}`), sql`, `)})`)
        .execute()
      emps.forEach(e => employeeMap.set(e.id, e.name || ''))
    }

    // 3. 组装结果
    return leaves.map(l => ({
      id: l.id,
      employeeId: l.employeeId,
      employeeName: l.employeeId ? employeeMap.get(l.employeeId) || null : null,
      leaveType: l.leaveType,
      startDate: l.startDate,
      endDate: l.endDate,
      days: l.days,
      status: l.status,
      reason: l.reason,
      memo: l.memo,
      approvedBy: l.approvedBy,
      approvedByName: null, // 需要单独查询审批人
      approvedAt: l.approvedAt,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
    }))
  }

  async getLeavesWithApprover(params: { employeeId?: string; status?: string; year?: string }) {
    // D1 兼容性修复：使用顺序查询代替 LEFT JOIN

    // 1. 查询请假记录
    const conditions = []
    if (params.employeeId) { conditions.push(eq(employeeLeaves.employeeId, params.employeeId)) }
    if (params.status) { conditions.push(eq(employeeLeaves.status, params.status)) }
    if (params.year) {
      conditions.push(sql`strftime('%Y', ${employeeLeaves.startDate}) = ${params.year} `)
    }

    const leaves = await this.db
      .select()
      .from(employeeLeaves)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(employeeLeaves.createdAt))
      .execute()

    if (leaves.length === 0) {
      return []
    }

    // 2. 批量获取审批人名称
    const approverIds = [...new Set(leaves.map(l => l.approvedBy).filter(Boolean) as string[])]
    const approverMap = new Map<string, string>()

    if (approverIds.length > 0) {
      const approvers = await this.db
        .select({ id: employees.id, name: employees.name })
        .from(employees)
        .where(sql`${employees.id} IN (${sql.join(approverIds.map(id => sql`${id}`), sql`, `)})`)
        .execute()
      approvers.forEach(a => approverMap.set(a.id, a.name || ''))
    }

    // 3. 组装结果
    return leaves.map(l => ({
      leave: l,
      approvedByName: l.approvedBy ? approverMap.get(l.approvedBy) || null : null,
    }))
  }

  async getLeaveStats(employeeId: string, year: string) {
    return await this.db
      .select({
        leaveType: employeeLeaves.leaveType,
        usedDays: sql<number>`COALESCE(SUM(${employeeLeaves.days}), 0)`,
      })
      .from(employeeLeaves)
      .where(
        and(
          eq(employeeLeaves.employeeId, employeeId),
          eq(employeeLeaves.status, 'approved'),
          // 使用SQLite的strftime函数提取年份（保留原生SQL，因为Drizzle ORM没有直接的日期提取函数）
          sql`strftime('%Y', ${employeeLeaves.startDate}) = ${year} `
        )
      )
      .groupBy(employeeLeaves.leaveType)
      .execute()
  }

  async createLeave(data: {
    employeeId: string
    leaveType: string
    startDate: string
    endDate: string
    days: number
    reason?: string | null
    memo?: string | null
    createdBy?: string
  }) {
    const id = nanoid()
    const now = Date.now()

    const newLeave = {
      id,
      employeeId: data.employeeId,
      leaveType: data.leaveType,
      startDate: data.startDate,
      endDate: data.endDate,
      days: data.days,
      reason: data.reason,
      memo: data.memo,
      status: 'pending',
      createdBy: data.createdBy, // Although schema might not have created_by? MyService had commented it out.
      // Checking schema.ts... MyService said "// createdBy: userId, // Removed as it's not in schema"
      // Let's check schema via file view later or assume MyService was right.
      // routes/employee-leaves.ts does NOT put createdBy.
      createdAt: now,
      updatedAt: now,
    }

    // Filter out undefined keys if schema doesn't match?
    // Safer to just insert known fields.
    await this.db
      .insert(employeeLeaves)
      .values({
        id,
        employeeId: data.employeeId,
        leaveType: data.leaveType,
        startDate: data.startDate,
        endDate: data.endDate,
        days: data.days,
        reason: data.reason,
        memo: data.memo,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      })
      .execute()

    return newLeave
  }

  async updateLeaveStatus(
    id: string,
    status: string,
    options: {
      approvedBy?: string
      memo?: string
    }
  ) {
    // 获取当前请假记录
    const leave = await this.db
      .select()
      .from(employeeLeaves)
      .where(eq(employeeLeaves.id, id))
      .get()

    if (!leave) {
      throw Errors.NOT_FOUND('请假记录')
    }

    // 状态机验证
    leaveStateMachine.validateTransition(leave.status || 'pending', status)

    const updateData: {
      status: string
      updatedAt: number
      approvedBy?: string
      approvedAt?: number
      memo?: string
    } = {
      status,
      updatedAt: Date.now(),
    }

    if (status === 'approved' || status === 'rejected') {
      if (options.approvedBy) {
        updateData.approvedBy = options.approvedBy
        updateData.approvedAt = Date.now()
      }
    }

    if (options.memo) {
      updateData.memo = options.memo
    }

    await this.db.update(employeeLeaves).set(updateData).where(eq(employeeLeaves.id, id)).execute()

    return { success: true }
  }
}
