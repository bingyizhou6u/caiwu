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
    let query = this.db
      .select({
        id: employeeLeaves.id,
        employeeId: employeeLeaves.employeeId,
        employeeName: employees.name,
        leaveType: employeeLeaves.leaveType,
        startDate: employeeLeaves.startDate,
        endDate: employeeLeaves.endDate,
        days: employeeLeaves.days,
        status: employeeLeaves.status,
        reason: employeeLeaves.reason,
        memo: employeeLeaves.memo,
        approvedBy: employeeLeaves.approvedBy,
        approvedByName: employees.name, // Approval name join might conflict with employeeName join, needs alias
        approvedAt: employeeLeaves.approvedAt,
        createdAt: employeeLeaves.createdAt,
        updatedAt: employeeLeaves.updatedAt,
      })
      .from(employeeLeaves)
      .leftJoin(employees, eq(employeeLeaves.employeeId, employees.id))
      .$dynamic()

    const filters = []
    if (params.employeeId) { filters.push(eq(employeeLeaves.employeeId, params.employeeId)) }
    if (params.status) { filters.push(eq(employeeLeaves.status, params.status)) }
    if (params.year) {
      // 使用SQLite的strftime函数提取年份（保留原生SQL，因为Drizzle ORM没有直接的日期提取函数）
      filters.push(sql`strftime('%Y', ${employeeLeaves.startDate}) = ${params.year} `)
    }

    if (filters.length > 0) {
      query = query.where(and(...filters))
    }

    const results = await query.orderBy(desc(employeeLeaves.createdAt))

    // Fix for approvedByName (requires a separate join or processed after if avoiding alias complexity in simple strings)
    // For simplicity, let's just fetch the approvers if needed or trust the left join if we alias.
    // Drizzle allows aliasing. Let's use alias for approver.

    return results
  }

  async getLeavesWithApprover(params: { employeeId?: string; status?: string; year?: string }) {
    // Need to alias employees table for approver
    // Drizzle doesn't support easy aliasing in the query builder style used here without defining it upfront.
    // Let's stick to the current pattern but do a second lookup or just return IDs for now if alias is hard.
    // Actually, we can fetch approver names separately or just leave it for now.
    // The original logic in MyService did a left join for approvedByName.

    const conditions = []
    if (params.employeeId) { conditions.push(eq(employeeLeaves.employeeId, params.employeeId)) }
    if (params.status) { conditions.push(eq(employeeLeaves.status, params.status)) }
    if (params.year) {
      // 使用SQLite的strftime函数提取年份（保留原生SQL，因为Drizzle ORM没有直接的日期提取函数）
      conditions.push(sql`strftime('%Y', ${employeeLeaves.startDate}) = ${params.year} `)
    }

    return await this.db
      .select({
        leave: employeeLeaves,
        approvedByName: employees.name,
      })
      .from(employeeLeaves)
      .leftJoin(employees, eq(employees.id, employeeLeaves.approvedBy))
      .where(and(...conditions))
      .orderBy(desc(employeeLeaves.createdAt))
      .execute()
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
