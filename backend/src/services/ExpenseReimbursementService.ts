import { DrizzleD1Database } from 'drizzle-orm/d1'
import { eq, and, desc, sql } from 'drizzle-orm'
import { expenseReimbursements, employees } from '../db/schema.js'
import * as schema from '../db/schema.js'
import { nanoid } from 'nanoid'
import { Errors } from '../utils/errors.js'

export class ExpenseReimbursementService {
    constructor(private db: DrizzleD1Database<typeof schema>) { }

    async listReimbursements(params: {
        employeeId?: string
        status?: string
    }) {
        let query = this.db.select({
            id: expenseReimbursements.id,
            employeeId: expenseReimbursements.employeeId,
            employeeName: employees.name,
            expenseType: expenseReimbursements.expenseType,
            amountCents: expenseReimbursements.amountCents,
            currencyId: expenseReimbursements.currencyId,
            expenseDate: expenseReimbursements.expenseDate,
            description: expenseReimbursements.description,
            voucherUrl: expenseReimbursements.voucherUrl,
            status: expenseReimbursements.status,
            approvedBy: expenseReimbursements.approvedBy,
            approvedAt: expenseReimbursements.approvedAt,
            memo: expenseReimbursements.memo,
            createdBy: expenseReimbursements.createdBy,
            createdAt: expenseReimbursements.createdAt,
            updatedAt: expenseReimbursements.updatedAt,
        })
            .from(expenseReimbursements)
            .leftJoin(employees, eq(expenseReimbursements.employeeId, employees.id))
            .$dynamic()

        const filters = []
        if (params.employeeId) filters.push(eq(expenseReimbursements.employeeId, params.employeeId))
        if (params.status) filters.push(eq(expenseReimbursements.status, params.status))

        if (filters.length > 0) {
            query = query.where(and(...filters))
        }

        return await query.orderBy(desc(expenseReimbursements.createdAt))
    }

    async getReimbursementsWithApprover(params: {
        employeeId?: string
        status?: string
    }) {
        const conditions = []
        if (params.employeeId) conditions.push(eq(expenseReimbursements.employeeId, params.employeeId))
        if (params.status) conditions.push(eq(expenseReimbursements.status, params.status))

        return await this.db.select({
            reimbursement: expenseReimbursements,
            approvedByName: employees.name
        })
            .from(expenseReimbursements)
            .leftJoin(employees, eq(employees.id, expenseReimbursements.approvedBy))
            .where(and(...conditions))
            .orderBy(desc(expenseReimbursements.createdAt))
            .execute()
    }

    async getReimbursementStats(employeeId: string) {
        return await this.db.select({
            status: expenseReimbursements.status,
            count: sql<number>`COUNT(*)`,
            totalCents: sql<number>`COALESCE(SUM(${expenseReimbursements.amountCents}), 0)`
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

    async updateStatus(id: string, status: string, options: {
        approvedBy?: string
        memo?: string
    }) {
        const updateData: any = {
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

        await this.db.update(expenseReimbursements)
            .set(updateData)
            .where(eq(expenseReimbursements.id, id))
            .execute()

        return { success: true }
    }

    async payReimbursement(id: string) {
        const reimbursement = await this.db.select().from(expenseReimbursements).where(eq(expenseReimbursements.id, id)).get()
        if (!reimbursement) throw Errors.NOT_FOUND('报销单')

        if (reimbursement.status !== 'approved') throw Errors.BUSINESS_ERROR('报销单未审批通过或已支付')

        await this.db.update(expenseReimbursements)
            .set({
                status: 'paid',
                updatedAt: Date.now(),
            })
            .where(eq(expenseReimbursements.id, id))
            .execute()

        return { success: true }
    }
}
