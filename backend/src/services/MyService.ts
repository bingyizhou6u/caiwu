import { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import { Errors } from '../utils/errors.js';
import { getAnnualLeaveStats } from './AnnualLeaveService.js';
import { uuid } from '../utils/db.js';

export class MyService {
    constructor(private db: DrizzleD1Database<typeof schema>) { }

    async getMyEmployeeId(userId: string): Promise<string | null> {
        const user = await this.db.select({ email: schema.users.email })
            .from(schema.users)
            .where(eq(schema.users.id, userId))
            .get();

        if (!user?.email) return null;

        const emp = await this.db.select({ id: schema.employees.id })
            .from(schema.employees)
            .where(and(eq(schema.employees.email, user.email), eq(schema.employees.active, 1)))
            .get();

        return emp?.id || null;
    }

    async getMyEmployeeInfo(userId: string) {
        const user = await this.db.select({ email: schema.users.email })
            .from(schema.users)
            .where(eq(schema.users.id, userId))
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
            // Employee Info
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

            // Monthly Salary
            this.db.select({
                totalCents: sql<number>`SUM(${schema.employeeSalaries.amountCents})`,
                currencyId: schema.employeeSalaries.currencyId
            })
                .from(schema.employeeSalaries)
                .where(eq(schema.employeeSalaries.employeeId, employeeId))
                .groupBy(schema.employeeSalaries.currencyId)
                .execute(),

            // Pending Reimbursements
            this.db.select({
                pendingCents: sql<number>`COALESCE(SUM(${schema.expenseReimbursements.amountCents}), 0)`
            })
                .from(schema.expenseReimbursements)
                .where(and(
                    eq(schema.expenseReimbursements.employeeId, employeeId),
                    inArray(schema.expenseReimbursements.status, ['pending', 'approved'])
                ))
                .get(),

            // Borrowing Balance
            this.db.select({
                borrowedCents: sql<number>`COALESCE(SUM(${schema.borrowings.amountCents}), 0)`,
                repaidCents: sql<number>`COALESCE(SUM(${schema.repayments.amountCents}), 0)`
            })
                .from(schema.borrowings)
                .leftJoin(schema.repayments, eq(schema.repayments.borrowingId, schema.borrowings.id))
                .where(eq(schema.borrowings.userId, userId))
                .get(),

            // Recent Applications
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

            // Annual Leave Stats
            (async () => {
                if (!empInfo.joinDate) return null;
                try {
                    return await getAnnualLeaveStats(db, employeeId, empInfo.joinDate);
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
            .leftJoin(schema.users, eq(schema.users.id, schema.employeeLeaves.approvedBy))
            .leftJoin(schema.employees, eq(schema.employees.email, schema.users.email))
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
            leaves: leaves.map(l => ({ ...l.leave, approved_by_name: l.approvedByName })),
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
            leaveType: data.leave_type,
            startDate: data.start_date,
            endDate: data.end_date,
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
            .leftJoin(schema.users, eq(schema.users.id, schema.expenseReimbursements.approvedBy))
            .leftJoin(schema.employees, eq(schema.employees.email, schema.users.email))
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
            reimbursements: reimbursements.map(r => ({ ...r.reimbursement, approved_by_name: r.approvedByName })),
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
            expenseType: data.expense_type,
            amountCents: data.amount_cents,
            currencyId: data.currency_id,
            expenseDate: data.expense_date,
            description: data.description,
            voucherUrl: data.voucher_url || null,
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

        // Calculate total repaid for this user
        // We can't easily join repayments here without grouping, so let's do a separate query for stats if needed.
        // Or just iterate over all borrowings for this user? No, that might be too many.
        // Let's use a subquery for the stats as it returns a single row and might be safer than in select list.
        // Actually, let's just use the same logic: fetch all repayments for user's borrowings?
        // Or just use the subquery which MIGHT work for single result.
        // The previous stats query had a subquery:
        // totalRepaidCents: sql<number>`COALESCE((SELECT SUM(r.amount_cents) FROM repayments r WHERE r.borrowing_id IN (SELECT id FROM borrowings WHERE user_id = ${userId})), 0)`
        // This looks standard SQL.

        const totalRepaidResult = await this.db.run(sql`
            SELECT COALESCE(SUM(r.amount_cents), 0) as total
            FROM repayments r
            WHERE r.borrowing_id IN (SELECT id FROM borrowings WHERE user_id = ${userId})
        `);
        // D1 run returns { results: [], ... } or similar?
        // Drizzle run returns result object.
        // Let's use .get() with sql.
        const totalRepaid = await this.db.get<{ total: number }>(sql`
            SELECT COALESCE(SUM(r.amount_cents), 0) as total
            FROM repayments r
            WHERE r.borrowing_id IN (SELECT id FROM borrowings WHERE user_id = ${userId})
        `);

        return {
            borrowings: borrowingsList.map(b => ({
                ...b.borrowing,
                account_name: b.accountName,
                repaid_cents: repaymentMap.get(b.borrowing.id) || 0
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
            const user = await this.db.select({ email: schema.users.email }).from(schema.users).where(eq(schema.users.id, userId)).get();
            // Wait, users table DOES NOT have name. It has email. Employees has name.
            // Let's check schema.ts again.
            // export const users = sqliteTable('users', { ... email ... });
            // export const employees = sqliteTable('employees', { ... name ... });
            // So we should get name from employees.
            const emp = await this.db.select({ name: schema.employees.name }).from(schema.employees).leftJoin(schema.users, eq(schema.users.email, schema.employees.email)).where(eq(schema.users.id, userId)).get();

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

        const current = assets.filter(a => !a.allocation.returnDate).map(a => ({ ...a.allocation, asset_name: a.assetName, asset_code: a.assetCode, purchase_price_cents: a.purchasePriceCents }));
        const returned = assets.filter(a => a.allocation.returnDate).map(a => ({ ...a.allocation, asset_name: a.assetName, asset_code: a.assetCode, purchase_price_cents: a.purchasePriceCents }));

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

        // workSchedule is not in schema.employees, removing it.
        // Also removing other fields not in schema.employees if they were causing errors.
        // idCard, bankAccount, bankName, contractEndDate, annualLeaveCycleMonths, annualLeaveDays are NOT in schema.employees.
        // I will remove them from the return object.

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
            // workSchedule: workSchedule,
            // annualLeaveCycleMonths: profile.employee.annualLeaveCycleMonths,
            // annualLeaveDays: profile.employee.annualLeaveDays,
            probationSalaryCents: profile.employee.probationSalaryCents,
            regularSalaryCents: profile.employee.regularSalaryCents,
            livingAllowanceCents: profile.employee.livingAllowanceCents,
            housingAllowanceCents: profile.employee.housingAllowanceCents,
            transportationAllowanceCents: profile.employee.transportationAllowanceCents,
            mealAllowanceCents: profile.employee.mealAllowanceCents,
        };
    }

    async updateProfile(userId: string, data: any) {
        const employeeId = await this.getMyEmployeeId(userId);
        if (!employeeId) throw Errors.NOT_FOUND('未找到员工记录');

        const updates: any = {};
        if (data.phone !== undefined) updates.phone = data.phone;
        if (data.emergency_contact !== undefined) updates.emergencyContact = data.emergency_contact;
        if (data.emergency_phone !== undefined) updates.emergencyPhone = data.emergency_phone;

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

        // workSchedule removed as it's not in schema

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
        // workSchedule logic removed

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
