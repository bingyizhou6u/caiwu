import { DrizzleD1Database } from 'drizzle-orm/d1'
import { eq, and, desc, sql } from 'drizzle-orm'
import { expenseReimbursements, employees } from '../../db/schema.js'
import * as schema from '../../db/schema.js'
import { nanoid } from 'nanoid'
import { Errors } from '../../utils/errors.js'
import { reimbursementStateMachine } from '../../utils/state-machine.js'

export class ExpenseReimbursementService {
  constructor(private db: DrizzleD1Database<typeof schema>) { }

  async listReimbursements(params: { employeeId?: string; status?: string }) {
    // D1 兼容性修复：使用顺序查询代替 LEFT JOIN

    // 1. 查询报销记录
    let query = this.db
      .select()
      .from(expenseReimbursements)
      .$dynamic()

    const filters = []
    if (params.employeeId) { filters.push(eq(expenseReimbursements.employeeId, params.employeeId)) }
    if (params.status) { filters.push(eq(expenseReimbursements.status, params.status)) }

    if (filters.length > 0) {
      query = query.where(and(...filters))
    }

    const reimbursements = await query.orderBy(desc(expenseReimbursements.createdAt))

    if (reimbursements.length === 0) {
      return []
    }

    // 2. 批量获取员工名称
    const employeeIds = [...new Set(reimbursements.map(r => r.employeeId).filter(Boolean))]
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
    return reimbursements.map(r => ({
      id: r.id,
      employeeId: r.employeeId,
      employeeName: r.employeeId ? employeeMap.get(r.employeeId) || null : null,
      expenseType: r.expenseType,
      amountCents: r.amountCents,
      currencyId: r.currencyId,
      expenseDate: r.expenseDate,
      description: r.description,
      voucherUrl: r.voucherUrl,
      status: r.status,
      approvedBy: r.approvedBy,
      approvedAt: r.approvedAt,
      memo: r.memo,
      createdBy: r.createdBy,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }))
  }

  async getReimbursementsWithApprover(params: { employeeId?: string; status?: string }) {
    // D1 兼容性修复：使用顺序查询代替 LEFT JOIN

    // 1. 查询报销记录
    const conditions = []
    if (params.employeeId) { conditions.push(eq(expenseReimbursements.employeeId, params.employeeId)) }
    if (params.status) { conditions.push(eq(expenseReimbursements.status, params.status)) }

    const reimbursements = await this.db
      .select()
      .from(expenseReimbursements)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(expenseReimbursements.createdAt))
      .execute()

    if (reimbursements.length === 0) {
      return []
    }

    // 2. 批量获取审批人名称
    const approverIds = [...new Set(reimbursements.map(r => r.approvedBy).filter(Boolean) as string[])]
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
    return reimbursements.map(r => ({
      reimbursement: r,
      approvedByName: r.approvedBy ? approverMap.get(r.approvedBy) || null : null,
    }))
  }

  async getReimbursementStats(employeeId: string) {
    return await this.db
      .select({
        status: expenseReimbursements.status,
        count: sql<number>`COUNT(*)`,
        totalCents: sql<number>`COALESCE(SUM(${expenseReimbursements.amountCents}), 0)`,
      })
      .from(expenseReimbursements)
      .where(eq(expenseReimbursements.employeeId, employeeId))
      .groupBy(expenseReimbursements.status)
      .execute()
  }

  async createReimbursement(data: {
    employeeId: string
    expenseType: string
    amountCents: number
    currencyId?: string
    expenseDate: string
    description: string
    voucherUrl?: string | null
    memo?: string
    createdBy?: string
  }) {
    const id = nanoid()
    const now = Date.now()

    const newReimbursement = {
      id,
      employeeId: data.employeeId,
      expenseType: data.expenseType,
      amountCents: data.amountCents,
      currencyId: data.currencyId,
      expenseDate: data.expenseDate,
      description: data.description,
      voucherUrl: data.voucherUrl,
      memo: data.memo,
      status: 'pending',
      createdBy: data.createdBy,
      createdAt: now,
      updatedAt: now,
    }

    await this.db.insert(expenseReimbursements).values(newReimbursement).execute()

    return newReimbursement
  }

  async updateStatus(
    id: string,
    status: string,
    options: {
      approvedBy?: string
      memo?: string
    }
  ) {
    // 获取当前报销记录
    const reimbursement = await this.db
      .select()
      .from(expenseReimbursements)
      .where(eq(expenseReimbursements.id, id))
      .get()

    if (!reimbursement) {
      throw Errors.NOT_FOUND('报销单')
    }

    // 状态机验证
    reimbursementStateMachine.validateTransition(reimbursement.status || 'pending', status)

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

    await this.db
      .update(expenseReimbursements)
      .set(updateData)
      .where(eq(expenseReimbursements.id, id))
      .execute()

    return { success: true }
  }

  async payReimbursement(id: string) {
    const reimbursement = await this.db
      .select()
      .from(expenseReimbursements)
      .where(eq(expenseReimbursements.id, id))
      .get()
    if (!reimbursement) {
      throw Errors.NOT_FOUND('报销单')
    }

    // 状态机验证 - 只有 approved 状态可以转换到 paid
    reimbursementStateMachine.validateTransition(reimbursement.status || 'pending', 'paid')

    await this.db
      .update(expenseReimbursements)
      .set({
        status: 'paid',
        updatedAt: Date.now(),
      })
      .where(eq(expenseReimbursements.id, id))
      .execute()

    return { success: true }
  }
}
