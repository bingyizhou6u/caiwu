import { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and, desc, inArray } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import { Errors } from '../utils/errors.js';
import { EmployeeService } from './EmployeeService.js';

import { PermissionService } from './PermissionService.js';

export class ApprovalService {
    constructor(
        private db: DrizzleD1Database<typeof schema>,
        private permissionService: PermissionService,
        private employeeService: EmployeeService
    ) { }

    async getPendingApprovals(userId: string) {
        const subordinateIds = await this.employeeService.getSubordinateEmployeeIds(userId);

        if (subordinateIds.length === 0) {
            return {
                leaves: [],
                reimbursements: [],
                borrowings: [],
                counts: { leaves: 0, reimbursements: 0, borrowings: 0 }
            };
        }

        // 待审批请假
        const pendingLeaves = await this.db.select({
            leave: schema.employeeLeaves,
            employeeName: schema.employees.name,
            departmentName: schema.departments.name,
            orgDepartmentName: schema.orgDepartments.name
        })
            .from(schema.employeeLeaves)
            .leftJoin(schema.employees, eq(schema.employees.id, schema.employeeLeaves.employeeId))
            .leftJoin(schema.departments, eq(schema.departments.id, schema.employees.departmentId))
            .leftJoin(schema.orgDepartments, eq(schema.orgDepartments.id, schema.employees.orgDepartmentId))
            .where(and(
                eq(schema.employeeLeaves.status, 'pending'),
                inArray(schema.employeeLeaves.employeeId, subordinateIds)
            ))
            .orderBy(desc(schema.employeeLeaves.createdAt))
            .execute();

        // 待审批报销
        const pendingReimbursements = await this.db.select({
            reimbursement: schema.expenseReimbursements,
            employeeName: schema.employees.name,
            departmentName: schema.departments.name,
            orgDepartmentName: schema.orgDepartments.name,
            currencySymbol: schema.currencies.symbol
        })
            .from(schema.expenseReimbursements)
            .leftJoin(schema.employees, eq(schema.employees.id, schema.expenseReimbursements.employeeId))
            .leftJoin(schema.departments, eq(schema.departments.id, schema.employees.departmentId))
            .leftJoin(schema.orgDepartments, eq(schema.orgDepartments.id, schema.employees.orgDepartmentId))
            .leftJoin(schema.currencies, eq(schema.currencies.code, schema.expenseReimbursements.currencyId))
            .where(and(
                eq(schema.expenseReimbursements.status, 'pending'),
                inArray(schema.expenseReimbursements.employeeId, subordinateIds)
            ))
            .orderBy(desc(schema.expenseReimbursements.createdAt))
            .execute();

        // 待审批借款
        const users = await this.db.select({ id: schema.employees.id })
            .from(schema.employees)
            .where(inArray(schema.employees.id, subordinateIds))
            .execute();

        const userIds = users.map(u => u.id);

        let pendingBorrowings: any[] = [];
        if (userIds.length > 0) {
            pendingBorrowings = await this.db.select({
                borrowing: schema.borrowings,
                employeeName: schema.employees.name,
                currencySymbol: schema.currencies.symbol
            })
                .from(schema.borrowings)
                .leftJoin(schema.employees, eq(schema.employees.id, schema.borrowings.userId))
                .leftJoin(schema.currencies, eq(schema.currencies.code, schema.borrowings.currency))
                .where(and(
                    eq(schema.borrowings.status, 'pending'),
                    inArray(schema.borrowings.userId, userIds)
                ))
                .orderBy(desc(schema.borrowings.createdAt))
                .execute();
        }

        return {
            leaves: pendingLeaves.map(r => ({ ...r.leave, employeeName: r.employeeName, departmentName: r.departmentName, orgDepartmentName: r.orgDepartmentName })),
            reimbursements: pendingReimbursements.map(r => ({ ...r.reimbursement, employeeName: r.employeeName, departmentName: r.departmentName, orgDepartmentName: r.orgDepartmentName, currencySymbol: r.currencySymbol })),
            borrowings: pendingBorrowings.map(r => ({ ...r.borrowing, employeeName: r.employeeName, currencySymbol: r.currencySymbol })),
            counts: {
                leaves: pendingLeaves.length,
                reimbursements: pendingReimbursements.length,
                borrowings: pendingBorrowings.length
            }
        };
    }

    async getApprovalHistory(userId: string, limit: number = 50) {
        const approvedLeaves = await this.db.select({
            leave: schema.employeeLeaves,
            employeeName: schema.employees.name,
            departmentName: schema.departments.name
        })
            .from(schema.employeeLeaves)
            .leftJoin(schema.employees, eq(schema.employees.id, schema.employeeLeaves.employeeId))
            .leftJoin(schema.departments, eq(schema.departments.id, schema.employees.departmentId))
            .where(and(
                eq(schema.employeeLeaves.approvedBy, userId),
                inArray(schema.employeeLeaves.status, ['approved', 'rejected'])
            ))
            .orderBy(desc(schema.employeeLeaves.approvedAt))
            .limit(limit)
            .execute();

        const approvedReimbursements = await this.db.select({
            reimbursement: schema.expenseReimbursements,
            employeeName: schema.employees.name,
            departmentName: schema.departments.name,
            currencySymbol: schema.currencies.symbol
        })
            .from(schema.expenseReimbursements)
            .leftJoin(schema.employees, eq(schema.employees.id, schema.expenseReimbursements.employeeId))
            .leftJoin(schema.departments, eq(schema.departments.id, schema.employees.departmentId))
            .leftJoin(schema.currencies, eq(schema.currencies.code, schema.expenseReimbursements.currencyId))
            .where(and(
                eq(schema.expenseReimbursements.approvedBy, userId),
                inArray(schema.expenseReimbursements.status, ['approved', 'rejected'])
            ))
            .orderBy(desc(schema.expenseReimbursements.approvedAt))
            .limit(limit)
            .execute();

        const approvedBorrowings = await this.db.select({
            borrowing: schema.borrowings,
            employeeName: schema.employees.name,
            currencySymbol: schema.currencies.symbol
        })
            .from(schema.borrowings)
            .leftJoin(schema.employees, eq(schema.employees.id, schema.borrowings.userId))
            .leftJoin(schema.currencies, eq(schema.currencies.code, schema.borrowings.currency))
            .where(and(
                eq(schema.borrowings.approvedBy, userId),
                inArray(schema.borrowings.status, ['approved', 'rejected'])
            ))
            .orderBy(desc(schema.borrowings.approvedAt))
            .limit(limit)
            .execute();

        return {
            leaves: approvedLeaves.map(r => ({ ...r.leave, employeeName: r.employeeName, departmentName: r.departmentName })),
            reimbursements: approvedReimbursements.map(r => ({ ...r.reimbursement, employeeName: r.employeeName, departmentName: r.departmentName, currencySymbol: r.currencySymbol })),
            borrowings: approvedBorrowings.map(r => ({ ...r.borrowing, employeeName: r.employeeName, currencySymbol: r.currencySymbol }))
        };
    }

    async approveLeave(id: string, userId: string, memo?: string) {
        await this.db.transaction(async (tx) => {
            const leave = await tx.select().from(schema.employeeLeaves).where(eq(schema.employeeLeaves.id, id)).get();
            if (!leave) throw Errors.NOT_FOUND('请假记录');
            if (leave.status !== 'pending') throw Errors.BUSINESS_ERROR('该记录已处理');

            const canApprove = await this.permissionService.canApprove(userId, leave.employeeId);
            if (!canApprove) throw Errors.FORBIDDEN('无权审批');

            const now = Date.now();
            await tx.update(schema.employeeLeaves).set({
                status: 'approved',
                approvedBy: userId,
                approvedAt: now,
                memo: memo || leave.memo,
                updatedAt: now
            }).where(eq(schema.employeeLeaves.id, id)).execute();
        })
    }

    async rejectLeave(id: string, userId: string, memo?: string) {
        await this.db.transaction(async (tx) => {
            const leave = await tx.select().from(schema.employeeLeaves).where(eq(schema.employeeLeaves.id, id)).get();
            if (!leave) throw Errors.NOT_FOUND('请假记录');
            if (leave.status !== 'pending') throw Errors.BUSINESS_ERROR('该记录已处理');

            const canApprove = await this.permissionService.canApprove(userId, leave.employeeId);
            if (!canApprove) throw Errors.FORBIDDEN('无权审批');

            const now = Date.now();
            await tx.update(schema.employeeLeaves).set({
                status: 'rejected',
                approvedBy: userId,
                approvedAt: now,
                memo: memo || leave.memo,
                updatedAt: now
            }).where(eq(schema.employeeLeaves.id, id)).execute();
        })
    }

    async approveReimbursement(id: string, userId: string, memo?: string) {
        await this.db.transaction(async (tx) => {
            const reimbursement = await tx.select().from(schema.expenseReimbursements).where(eq(schema.expenseReimbursements.id, id)).get();
            if (!reimbursement) throw Errors.NOT_FOUND('报销记录');
            if (reimbursement.status !== 'pending') throw Errors.BUSINESS_ERROR('该记录已处理');

            const canApprove = await this.permissionService.canApprove(userId, reimbursement.employeeId);
            if (!canApprove) throw Errors.FORBIDDEN('无权审批');

            const now = Date.now();
            await tx.update(schema.expenseReimbursements).set({
                status: 'approved',
                approvedBy: userId,
                approvedAt: now,
                memo: memo || reimbursement.memo,
                updatedAt: now
            }).where(eq(schema.expenseReimbursements.id, id)).execute();
        })
    }

    async rejectReimbursement(id: string, userId: string, memo?: string) {
        await this.db.transaction(async (tx) => {
            const reimbursement = await tx.select().from(schema.expenseReimbursements).where(eq(schema.expenseReimbursements.id, id)).get();
            if (!reimbursement) throw Errors.NOT_FOUND('报销记录');
            if (reimbursement.status !== 'pending') throw Errors.BUSINESS_ERROR('该记录已处理');

            const canApprove = await this.permissionService.canApprove(userId, reimbursement.employeeId);
            if (!canApprove) throw Errors.FORBIDDEN('无权审批');

            const now = Date.now();
            await tx.update(schema.expenseReimbursements).set({
                status: 'rejected',
                approvedBy: userId,
                approvedAt: now,
                memo: memo || reimbursement.memo,
                updatedAt: now
            }).where(eq(schema.expenseReimbursements.id, id)).execute();
        })
    }

    async approveBorrowing(id: string, userId: string, memo?: string) {
        await this.db.transaction(async (tx) => {
            const borrowing = await tx.select().from(schema.borrowings).where(eq(schema.borrowings.id, id)).get();
            if (!borrowing) throw Errors.NOT_FOUND('借支记录');
            if (borrowing.status !== 'pending') throw Errors.BUSINESS_ERROR('该记录已处理');

            const borrowerEmployeeId = await this.getBorrowerEmployeeId(borrowing.userId, tx);
            const canApprove = await this.permissionService.canApprove(userId, borrowerEmployeeId);
            if (!canApprove) throw Errors.FORBIDDEN('无权审批');

            const now = Date.now();
            await tx.update(schema.borrowings).set({
                status: 'approved',
                approvedBy: userId,
                approvedAt: now,
                updatedAt: now
            }).where(eq(schema.borrowings.id, id)).execute();
        })
    }

    async rejectBorrowing(id: string, userId: string, memo?: string) {
        await this.db.transaction(async (tx) => {
            const borrowing = await tx.select().from(schema.borrowings).where(eq(schema.borrowings.id, id)).get();
            if (!borrowing) throw Errors.NOT_FOUND('借支记录');
            if (borrowing.status !== 'pending') throw Errors.BUSINESS_ERROR('该记录已处理');

            const borrowerEmployeeId = await this.getBorrowerEmployeeId(borrowing.userId, tx);
            const canApprove = await this.permissionService.canApprove(userId, borrowerEmployeeId);
            if (!canApprove) throw Errors.FORBIDDEN('无权审批');

            const now = Date.now();
            await tx.update(schema.borrowings).set({
                status: 'rejected',
                approvedBy: userId,
                approvedAt: now,
                updatedAt: now
            }).where(eq(schema.borrowings.id, id)).execute();
        })
    }

    // 辅助方法
    // checkApprovalPermission removed

    private async getBorrowerEmployeeId(borrowerUserId: string, tx?: any): Promise<string> {
        const db = tx || this.db
        const borrowerUser = await db.select({ email: schema.employees.email }).from(schema.employees).where(eq(schema.employees.id, borrowerUserId)).get();
        if (!borrowerUser) throw Errors.FORBIDDEN('无法找到申请人信息');

        const borrowerEmployee = await db.select({ id: schema.employees.id }).from(schema.employees).where(eq(schema.employees.email, borrowerUser.email)).get();
        if (!borrowerEmployee) throw Errors.FORBIDDEN('无法找到申请人员工信息');

        return borrowerEmployee.id;
    }
}
