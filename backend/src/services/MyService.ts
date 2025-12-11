import { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import { Errors } from '../utils/errors.js';
import { getAnnualLeaveStats } from './AnnualLeaveService.js';
import { uuid } from '../utils/db.js';

export class MyService {
    constructor(private db: DrizzleD1Database<typeof schema>) { }

    async getMyEmployeeId(userId: string): Promise<string | null> {
        const user = await this.db.select({ email: schema.employees.email })
            .from(schema.employees)
            .where(eq(schema.employees.id, userId))
            .get();

        if (!user?.email) return null;

        const emp = await this.db.select({ id: schema.employees.id })
            .from(schema.employees)
            .where(and(eq(schema.employees.email, user.email), eq(schema.employees.active, 1)))
            .get();

        return emp?.id || null;
    }

    async getMyEmployeeInfo(userId: string) {
        const user = await this.db.select({ email: schema.employees.email })
            .from(schema.employees)
            .where(eq(schema.employees.id, userId))
            .get();

        if (!user?.email) return null;

        return await this.db.select({
            id: schema.employees.id,
            joinDate: schema.employees.joinDate
        })
            .from(schema.employees)
            .where(and(eq(schema.employees.email, user.email), eq(schema.employees.active, 1)))
            .get();
    }

    async getDashboardData(userId: string, db: D1Database) {
        const empInfo = await this.getMyEmployeeInfo(userId);
        if (!empInfo) throw Errors.NOT_FOUND('未找到员工记录');
        const employeeId = empInfo.id;

        const [
            employee,
            salary,
            pending,
            borrowing,
            recent,
            annualLeaveStats
        ] = await Promise.all([
            // 员工信息
            this.db.select({
                id: schema.employees.id,
                name: schema.employees.name,
                email: schema.employees.email,
                positionName: schema.positions.name,
                departmentName: schema.departments.name,
                orgDepartmentName: schema.orgDepartments.name
            })
                .from(schema.employees)
                .leftJoin(schema.positions, eq(schema.positions.id, schema.employees.positionId))
                .leftJoin(schema.departments, eq(schema.departments.id, schema.employees.departmentId))
                .leftJoin(schema.orgDepartments, eq(schema.orgDepartments.id, schema.employees.orgDepartmentId))
                .where(eq(schema.employees.id, employeeId))
                .get(),

            // 月薪
            this.db.select({
                totalCents: sql<number>`SUM(${schema.employeeSalaries.amountCents})`,
                currencyId: schema.employeeSalaries.currencyId
            })
                .from(schema.employeeSalaries)
                .where(eq(schema.employeeSalaries.employeeId, employeeId))
                .groupBy(schema.employeeSalaries.currencyId)
                .execute(),

            // 待报销
            this.db.select({
                pendingCents: sql<number>`COALESCE(SUM(${schema.expenseReimbursements.amountCents}), 0)`
            })
                .from(schema.expenseReimbursements)
                .where(and(
                    eq(schema.expenseReimbursements.employeeId, employeeId),
                    inArray(schema.expenseReimbursements.status, ['pending', 'approved'])
                ))
                .get(),

            // 借款余额
            this.db.select({
                borrowedCents: sql<number>`COALESCE(SUM(${schema.borrowings.amountCents}), 0)`,
                repaidCents: sql<number>`COALESCE(SUM(${schema.repayments.amountCents}), 0)`
            })
                .from(schema.borrowings)
                .leftJoin(schema.repayments, eq(schema.repayments.borrowingId, schema.borrowings.id))
                .where(eq(schema.borrowings.userId, userId))
                .get(),

            // 最近申请
            (async () => {
                const leaves = await this.db.select({
                    id: schema.employeeLeaves.id,
                    type: sql<string>`'leave'`,
                    subType: schema.employeeLeaves.leaveType,
                    status: schema.employeeLeaves.status,
                    amount: sql<string>`${schema.employeeLeaves.days} || '天'`,
                    createdAt: schema.employeeLeaves.createdAt
                })
                    .from(schema.employeeLeaves)
                    .where(eq(schema.employeeLeaves.employeeId, employeeId))
                    .orderBy(desc(schema.employeeLeaves.createdAt))
                    .limit(5)
                    .execute();

                const reimbursements = await this.db.select({
                    id: schema.expenseReimbursements.id,
                    type: sql<string>`'reimbursement'`,
                    subType: schema.expenseReimbursements.expenseType,
                    status: schema.expenseReimbursements.status,
                    amount: sql<string>`${schema.expenseReimbursements.amountCents}`,
                    createdAt: schema.expenseReimbursements.createdAt
                })
                    .from(schema.expenseReimbursements)
                    .where(eq(schema.expenseReimbursements.employeeId, employeeId))
                    .orderBy(desc(schema.expenseReimbursements.createdAt))
                    .limit(5)
                    .execute();

                return [...leaves, ...reimbursements]
                    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
                    .slice(0, 5);
            })(),

            // 年假统计
            (async () => {
                if (!empInfo.joinDate) return null;
                try {
                    return await getAnnualLeaveStats(this.db, employeeId, empInfo.joinDate);
                } catch (e) {
                    console.error('Failed to get annual leave stats:', e);
                    return null;
                }
            })()
        ]);

        const balanceCents = (borrowing?.borrowedCents || 0) - (borrowing?.repaidCents || 0);

        return {
            employee: {
                id: employee?.id,
                name: employee?.name,
                email: employee?.email,
                position: employee?.positionName,
                department: employee?.departmentName,
                orgDepartment: employee?.orgDepartmentName,
            },
            stats: {
                salary: salary || [],
                annualLeave: annualLeaveStats ? {
                    cycleMonths: annualLeaveStats.config.cycleMonths,
                    cycleNumber: annualLeaveStats.cycle.cycleNumber,
                    cycleStart: annualLeaveStats.cycle.cycleStart,
                    cycleEnd: annualLeaveStats.cycle.cycleEnd,
                    isFirstCycle: annualLeaveStats.cycle.isFirstCycle,
                    total: annualLeaveStats.entitledDays,
                    used: annualLeaveStats.usedDays,
                    remaining: annualLeaveStats.remainingDays,
                } : { cycleMonths: 6, cycleNumber: 1, cycleStart: null, cycleEnd: null, isFirstCycle: true, total: 0, used: 0, remaining: 0 },
                pendingReimbursementCents: pending?.pendingCents || 0,
                borrowingBalanceCents: balanceCents,
            },
            recentApplications: recent || [],
        };
    }

    async getLeaves(userId: string, year: string, status?: string) {
        const employeeId = await this.getMyEmployeeId(userId);
        if (!employeeId) throw Errors.NOT_FOUND('未找到员工记录');

        const conditions = [
            eq(schema.employeeLeaves.employeeId, employeeId),
            sql`strftime('%Y', ${schema.employeeLeaves.startDate}) = ${year}`
        ];
        if (status) conditions.push(eq(schema.employeeLeaves.status, status));

        const leaves = await this.db.select({
            leave: schema.employeeLeaves,
            approvedByName: schema.employees.name
        })
            .from(schema.employeeLeaves)
            .leftJoin(schema.employees, eq(schema.employees.id, schema.employeeLeaves.approvedBy))
            .where(and(...conditions))
            .orderBy(desc(schema.employeeLeaves.createdAt))
            .execute();

        const leaveStats = await this.db.select({
            leaveType: schema.employeeLeaves.leaveType,
            usedDays: sql<number>`COALESCE(SUM(${schema.employeeLeaves.days}), 0)`
        })
            .from(schema.employeeLeaves)
            .where(and(
                eq(schema.employeeLeaves.employeeId, employeeId),
                eq(schema.employeeLeaves.status, 'approved'),
                sql`strftime('%Y', ${schema.employeeLeaves.startDate}) = ${year}`
            ))
            .groupBy(schema.employeeLeaves.leaveType)
            .execute();

        return {
            leaves: leaves.map(l => ({ ...l.leave, approvedByName: l.approvedByName })),
            stats: leaveStats
        };
    }

    async createLeave(userId: string, data: any) {
        const employeeId = await this.getMyEmployeeId(userId);
        if (!employeeId) throw Errors.NOT_FOUND('未找到员工记录');

        const id = uuid();
        const now = Date.now();

        await this.db.insert(schema.employeeLeaves).values({
            id,
            employeeId,
            leaveType: data.leaveType,
            startDate: data.startDate,
            endDate: data.endDate,
            days: data.days,
            reason: data.reason || null,
            status: 'pending',
            // createdBy: userId, // Removed as it's not in schema
            createdAt: now,
            updatedAt: now
        }).execute();

        return { ok: true, id };
    }

    async getReimbursements(userId: string, status?: string) {
        const employeeId = await this.getMyEmployeeId(userId);
        if (!employeeId) throw Errors.NOT_FOUND('未找到员工记录');

        const conditions = [eq(schema.expenseReimbursements.employeeId, employeeId)];
        if (status) conditions.push(eq(schema.expenseReimbursements.status, status));

        const reimbursements = await this.db.select({
            reimbursement: schema.expenseReimbursements,
            approvedByName: schema.employees.name
        })
            .from(schema.expenseReimbursements)
            .leftJoin(schema.employees, eq(schema.employees.id, schema.expenseReimbursements.approvedBy))
            .where(and(...conditions))
            .orderBy(desc(schema.expenseReimbursements.createdAt))
            .execute();

        const stats = await this.db.select({
            status: schema.expenseReimbursements.status,
            count: sql<number>`COUNT(*)`,
            totalCents: sql<number>`COALESCE(SUM(${schema.expenseReimbursements.amountCents}), 0)`
        })
            .from(schema.expenseReimbursements)
            .where(eq(schema.expenseReimbursements.employeeId, employeeId))
            .groupBy(schema.expenseReimbursements.status)
            .execute();

        return {
            reimbursements: reimbursements.map(r => ({ ...r.reimbursement, approvedByName: r.approvedByName })),
            stats
        };
    }

    async createReimbursement(userId: string, data: any) {
        const employeeId = await this.getMyEmployeeId(userId);
        if (!employeeId) throw Errors.NOT_FOUND('未找到员工记录');

        const id = uuid();
        const now = Date.now();

        await this.db.insert(schema.expenseReimbursements).values({
            id,
            employeeId,
            expenseType: data.expenseType,
            amountCents: data.amountCents,
            currencyId: data.currencyId,
            expenseDate: data.expenseDate,
            description: data.description,
            voucherUrl: data.voucherUrl || null,
            status: 'pending',
            createdBy: userId,
            createdAt: now,
            updatedAt: now
        }).execute();

        return { ok: true, id };
    }

    async getBorrowings(userId: string) {
        const borrowingsList = await this.db.select({
            borrowing: schema.borrowings,
            accountName: schema.accounts.name,
        })
            .from(schema.borrowings)
            .leftJoin(schema.accounts, eq(schema.accounts.id, schema.borrowings.accountId))
            .where(eq(schema.borrowings.userId, userId))
            .orderBy(desc(schema.borrowings.createdAt))
            .execute();

        const borrowingIds = borrowingsList.map(b => b.borrowing.id);
        let repaymentMap = new Map<string, number>();

        if (borrowingIds.length > 0) {
            const repayments = await this.db.select({
                borrowingId: schema.repayments.borrowingId,
                amountCents: schema.repayments.amountCents
            })
                .from(schema.repayments)
                .where(inArray(schema.repayments.borrowingId, borrowingIds))
                .execute();

            for (const r of repayments) {
                const current = repaymentMap.get(r.borrowingId) || 0;
                repaymentMap.set(r.borrowingId, current + r.amountCents);
            }
        }

        const stats = await this.db.select({
            totalBorrowedCents: sql<number>`COALESCE(SUM(${schema.borrowings.amountCents}), 0)`,
        })
            .from(schema.borrowings)
            .where(eq(schema.borrowings.userId, userId))
            .get();

        // 计算该用户的总还款额
        // 这里不能简单地关联还款表，因为没有分组。
        // 或者使用子查询，这可能比在选择列表中更安全。
        // 之前的统计查询使用了子查询：
        // totalRepaidCents: sql<number>`COALESCE((SELECT SUM(r.amount_cents) FROM repayments r WHERE r.borrowing_id IN (SELECT id FROM borrowings WHERE user_id = ${userId})), 0)`
        // 这看起来是标准 SQL。

        const totalRepaidResult = await this.db.run(sql`
            SELECT COALESCE(SUM(r.amount_cents), 0) as total
            FROM repayments r
            WHERE r.borrowing_id IN (SELECT id FROM borrowings WHERE user_id = ${userId})
        `);
        // D1 run 返回 { results: [], ... } 或类似结构？
        // Drizzle run 返回结果对象。
        // 让我们对 sql 使用 .get()。
        const totalRepaid = await this.db.get<{ total: number }>(sql`
            SELECT COALESCE(SUM(r.amount_cents), 0) as total
            FROM repayments r
            WHERE r.borrowing_id IN (SELECT id FROM borrowings WHERE user_id = ${userId})
        `);

        return {
            borrowings: borrowingsList.map(b => ({
                ...b.borrowing,
                accountName: b.accountName,
                repaidCents: repaymentMap.get(b.borrowing.id) || 0
            })),
            stats: {
                totalBorrowedCents: stats?.totalBorrowedCents || 0,
                totalRepaidCents: totalRepaid?.total || 0,
                balanceCents: (stats?.totalBorrowedCents || 0) - (totalRepaid?.total || 0),
            },
        };
    }

    async createBorrowing(userId: string, data: any) {
        const id = uuid();
        const now = Date.now();
        const today = new Date().toISOString().split('T')[0];

        let borrower = await this.db.select().from(schema.borrowers).where(eq(schema.borrowers.userId, userId)).get();
        if (!borrower) {
            const user = await this.db.select({ email: schema.employees.email }).from(schema.employees).where(eq(schema.employees.id, userId)).get();
            // 注意：users 表没有 name 字段，只有 email。employees 表有 name。
            // 让我们再次检查 schema.ts。
            // export const users = sqliteTable('users', { ... email ... });
            // export const employees = sqliteTable('employees', { ... name ... });
            // 所以我们应该从 employees 表获取 name。
            const emp = await this.db.select({ name: schema.employees.name }).from(schema.employees).where(eq(schema.employees.id, userId)).get();

            const borrowerId = uuid();
            await this.db.insert(schema.borrowers).values({
                id: borrowerId,
                name: emp?.name || '未知',
                userId,
                active: 1,
                createdAt: now
            }).execute();
            borrower = { id: borrowerId } as any;
        }

        await this.db.insert(schema.borrowings).values({
            id,
            borrowerId: borrower!.id,
            userId,
            amountCents: data.amount_cents,
            currency: data.currency,
            borrowDate: today,
            memo: data.memo || null,
            status: 'pending',
            accountId: 'default', // Placeholder
            createdAt: now,
            updatedAt: now
        }).execute();

        return { ok: true, id };
    }

    async getAllowances(userId: string, year: string) {
        const employeeId = await this.getMyEmployeeId(userId);
        if (!employeeId) throw Errors.NOT_FOUND('未找到员工记录');

        const allowances = await this.db.select()
            .from(schema.allowancePayments)
            .where(and(
                eq(schema.allowancePayments.employeeId, employeeId),
                eq(schema.allowancePayments.year, parseInt(year))
            ))
            .orderBy(desc(schema.allowancePayments.year), desc(schema.allowancePayments.month), desc(schema.allowancePayments.allowanceType))
            .execute();

        const monthlyStats = await this.db.select({
            year: schema.allowancePayments.year,
            month: schema.allowancePayments.month,
            totalCents: sql<number>`COALESCE(SUM(${schema.allowancePayments.amountCents}), 0)`
        })
            .from(schema.allowancePayments)
            .where(and(
                eq(schema.allowancePayments.employeeId, employeeId),
                eq(schema.allowancePayments.year, parseInt(year))
            ))
            .groupBy(schema.allowancePayments.year, schema.allowancePayments.month)
            .orderBy(desc(schema.allowancePayments.month))
            .execute();

        return { allowances, monthlyStats };
    }

    async getAssets(userId: string) {
        const employeeId = await this.getMyEmployeeId(userId);
        if (!employeeId) throw Errors.NOT_FOUND('未找到员工记录');

        const assets = await this.db.select({
            allocation: schema.fixedAssetAllocations,
            assetName: schema.fixedAssets.name,
            assetCode: schema.fixedAssets.assetCode,
            purchasePriceCents: schema.fixedAssets.purchasePriceCents
        })
            .from(schema.fixedAssetAllocations)
            .leftJoin(schema.fixedAssets, eq(schema.fixedAssets.id, schema.fixedAssetAllocations.assetId))
            .where(eq(schema.fixedAssetAllocations.employeeId, employeeId))
            .orderBy(desc(schema.fixedAssetAllocations.allocationDate))
            .execute();

        const current = assets.filter(a => !a.allocation.returnDate).map(a => ({ ...a.allocation, assetName: a.assetName, assetCode: a.assetCode, purchasePriceCents: a.purchasePriceCents }));
        const returned = assets.filter(a => a.allocation.returnDate).map(a => ({ ...a.allocation, assetName: a.assetName, assetCode: a.assetCode, purchasePriceCents: a.purchasePriceCents }));

        return { current, returned };
    }

    async getProfile(userId: string) {
        const employeeId = await this.getMyEmployeeId(userId);
        if (!employeeId) throw Errors.NOT_FOUND('未找到员工记录');

        const profile = await this.db.select({
            employee: schema.employees,
            email: schema.employees.email,
            positionName: schema.positions.name,
            positionCode: schema.positions.code,
            departmentName: schema.departments.name,
            orgDepartmentName: schema.orgDepartments.name
        })
            .from(schema.employees)
            .leftJoin(schema.positions, eq(schema.positions.id, schema.employees.positionId))
            .leftJoin(schema.departments, eq(schema.departments.id, schema.employees.departmentId))
            .leftJoin(schema.orgDepartments, eq(schema.orgDepartments.id, schema.employees.orgDepartmentId))
            .where(eq(schema.employees.id, employeeId))
            .get();

        if (!profile) return null;

        // workSchedule 不在 schema.employees 中，将其移除。
        // 同时移除其他导致错误的非 schema.employees 字段。
        // idCard, bankAccount, bankName, contractEndDate, annualLeaveCycleMonths, annualLeaveDays 不在 schema.employees 中。
        // 我将从返回对象中移除它们。

        return {
            id: profile.employee.id,
            // userId: profile.employee.userId, // Not in schema
            name: profile.employee.name,
            email: profile.email,
            phone: profile.employee.phone,
            // idCard: profile.employee.idCard ? '****' + profile.employee.idCard.slice(-4) : null,
            // bankAccount: profile.employee.bankAccount ? '****' + profile.employee.bankAccount.slice(-4) : null,
            // bankName: profile.employee.bankName,
            position: profile.positionName,
            positionCode: profile.positionCode,
            department: profile.departmentName,
            orgDepartment: profile.orgDepartmentName,
            entryDate: profile.employee.joinDate,
            // contractEndDate: profile.employee.contractEndDate,
            emergencyContact: profile.employee.emergencyContact,
            emergencyPhone: profile.employee.emergencyPhone,
            status: profile.employee.status,
            // 薪资/津贴数据现在来自 employee_salaries 和 employee_allowances 表
        };
    }

    async updateProfile(userId: string, data: any) {
        const employeeId = await this.getMyEmployeeId(userId);
        if (!employeeId) throw Errors.NOT_FOUND('未找到员工记录');

        const updates: any = {};
        if (data.phone !== undefined) updates.phone = data.phone;
        if (data.emergencyContact !== undefined) updates.emergencyContact = data.emergencyContact;
        if (data.emergencyPhone !== undefined) updates.emergencyPhone = data.emergencyPhone;

        if (Object.keys(updates).length === 0) return { ok: true, message: '无更新' };

        updates.updatedAt = Date.now();

        await this.db.update(schema.employees)
            .set(updates)
            .where(eq(schema.employees.id, employeeId))
            .execute();

        return { ok: true };
    }

    async getAttendanceToday(userId: string) {
        const employeeId = await this.getMyEmployeeId(userId);
        if (!employeeId) throw Errors.NOT_FOUND('未找到员工记录');

        const today = new Date().toISOString().split('T')[0];

        const record = await this.db.select().from(schema.attendanceRecords)
            .where(and(
                eq(schema.attendanceRecords.employeeId, employeeId),
                eq(schema.attendanceRecords.date, today)
            ))
            .get();

        // workSchedule 已移除，因为它不在 schema 中

        return {
            today,
            record: record ? {
                id: record.id,
                date: record.date,
                clockInTime: record.clockInTime,
                clockOutTime: record.clockOutTime,
                clockInLocation: record.clockInLocation,
                clockOutLocation: record.clockOutLocation,
                status: record.status,
                memo: record.memo,
            } : null,
            // workSchedule,
        };
    }

    async getAttendanceList(userId: string, year: string, month: string) {
        const employeeId = await this.getMyEmployeeId(userId);
        if (!employeeId) throw Errors.NOT_FOUND('未找到员工记录');

        const startDate = `${year}-${month}-01`;
        const endDate = `${year}-${month}-31`;

        const records = await this.db.select().from(schema.attendanceRecords)
            .where(and(
                eq(schema.attendanceRecords.employeeId, employeeId),
                sql`${schema.attendanceRecords.date} >= ${startDate}`,
                sql`${schema.attendanceRecords.date} <= ${endDate}`
            ))
            .orderBy(desc(schema.attendanceRecords.date))
            .execute();

        return { records };
    }

    async clockIn(userId: string) {
        const employeeId = await this.getMyEmployeeId(userId);
        if (!employeeId) throw Errors.NOT_FOUND('未找到员工记录');

        const today = new Date().toISOString().split('T')[0];
        const now = Date.now();

        const existing = await this.db.select().from(schema.attendanceRecords)
            .where(and(
                eq(schema.attendanceRecords.employeeId, employeeId),
                eq(schema.attendanceRecords.date, today)
            ))
            .get();

        if (existing?.clockInTime) {
            return { error: '今日已签到', clockInTime: existing.clockInTime };
        }

        let status = 'normal';
        // workSchedule 逻辑已移除

        if (existing) {
            await this.db.update(schema.attendanceRecords)
                .set({ clockInTime: now, status, updatedAt: now })
                .where(eq(schema.attendanceRecords.id, existing.id))
                .execute();
        } else {
            const id = uuid();
            await this.db.insert(schema.attendanceRecords).values({
                id,
                employeeId,
                date: today,
                clockInTime: now,
                status,
                createdAt: now,
                updatedAt: now
            }).execute();
        }

        return { ok: true, clockInTime: now, status };
    }

    async clockOut(userId: string) {
        const employeeId = await this.getMyEmployeeId(userId);
        if (!employeeId) throw Errors.NOT_FOUND('未找到员工记录');

        const today = new Date().toISOString().split('T')[0];
        const now = Date.now();

        const existing = await this.db.select().from(schema.attendanceRecords)
            .where(and(
                eq(schema.attendanceRecords.employeeId, employeeId),
                eq(schema.attendanceRecords.date, today)
            ))
            .get();

        if (!existing?.clockInTime) {
            return { error: '请先签到' };
        }

        if (existing.clockOutTime) {
            return { error: '今日已签退', clockOutTime: existing.clockOutTime };
        }

        let status = existing.status || 'normal';
        // workSchedule logic removed

        await this.db.update(schema.attendanceRecords)
            .set({ clockOutTime: now, status, updatedAt: now })
            .where(eq(schema.attendanceRecords.id, existing.id))
            .execute();

        return { ok: true, clockOutTime: now, status };
    }
}
