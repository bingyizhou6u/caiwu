import { eq, and, like, or, inArray, desc, sql } from 'drizzle-orm';
import { DrizzleD1Database } from 'drizzle-orm/d1';
import { employees, departments, orgDepartments, positions, users, userDepartments } from '../db/schema.js';
import * as schema from '../db/schema.js';
import { v4 as uuid } from 'uuid';
import { Errors } from '../utils/errors.js';

export class EmployeeService {
    constructor(private db: DrizzleD1Database<typeof schema>) { }

    async getAll(filters: {
        status?: string;
        departmentId?: string;
        orgDepartmentId?: string;
        name?: string;
        email?: string;
        positionId?: string;
        limit?: number;
        offset?: number;
    }) {
        const conditions = [];

        if (filters.status) {
            conditions.push(eq(employees.status, filters.status));
        }
        if (filters.departmentId) {
            conditions.push(eq(employees.departmentId, filters.departmentId));
        }
        if (filters.orgDepartmentId) {
            conditions.push(eq(employees.orgDepartmentId, filters.orgDepartmentId));
        }
        if (filters.name) {
            conditions.push(like(employees.name, `%${filters.name}%`));
        }
        if (filters.email) {
            conditions.push(like(employees.email, `%${filters.email}%`));
        }
        if (filters.positionId) {
            conditions.push(eq(employees.positionId, filters.positionId));
        }

        const query = this.db.select({
            id: employees.id,
            name: employees.name,
            email: employees.email,
            departmentId: employees.departmentId,
            departmentName: departments.name,
            orgDepartmentId: employees.orgDepartmentId,
            orgDepartmentName: orgDepartments.name,
            orgDepartmentCode: orgDepartments.code,
            positionId: employees.positionId,
            positionName: positions.name,
            positionLevel: positions.level,
            joinDate: employees.joinDate,
            status: employees.status,
            active: employees.active,
            phone: employees.phone,
            avatar: sql<string>`''`, // Placeholder as avatar is not in employees table but might be needed by frontend
        })
            .from(employees)
            .leftJoin(departments, eq(employees.departmentId, departments.id))
            .leftJoin(orgDepartments, eq(employees.orgDepartmentId, orgDepartments.id))
            .leftJoin(positions, eq(employees.positionId, positions.id))
            .where(and(...conditions))
            .orderBy(desc(employees.createdAt))
            .limit(filters.limit || 100)
            .offset(filters.offset || 0);

        return await query;
    }
    async migrateFromUser(userId: string, data: {
        orgDepartmentId: string;
        positionId: string;
        joinDate: string;
        probationSalaryCents: number;
        regularSalaryCents: number;
        birthday?: string;
    }) {
        return await this.db.transaction(async (tx) => {
            // 1. Check if user exists
            const user = await tx.select().from(users).where(eq(users.id, userId)).get();
            if (!user) {
                throw new Error('User not found');
            }

            // 2. Check if employee already exists
            const existingEmployee = await tx.select().from(employees).where(eq(employees.email, user.email)).get();
            if (existingEmployee) {
                throw new Error('Employee already exists');
            }

            // 3. Get Org Department
            const orgDept = await tx.select().from(orgDepartments).where(eq(orgDepartments.id, data.orgDepartmentId)).get();
            if (!orgDept) {
                throw new Error('Org Department not found');
            }

            // 4. Determine Department (Project)
            let actualDepartmentId = orgDept.projectId;
            if (!actualDepartmentId) {
                // If no project_id, assume HQ. Find or create '总部' department.
                // For simplicity, let's assume '总部' department exists or we find one with name '总部'
                const hqDept = await tx.select().from(departments).where(eq(departments.name, '总部')).get();
                if (hqDept) {
                    actualDepartmentId = hqDept.id;
                } else {
                    // Fallback or error? The original code had logic to find HQ.
                    throw new Error('Headquarters department not found');
                }
            }

            // 5. Get Position
            const position = await tx.select().from(positions).where(eq(positions.id, data.positionId)).get();
            if (!position) {
                throw new Error('Position not found');
            }

            const newEmployeeId = uuid();
            const now = Date.now();

            // 6. Create Employee
            await tx.insert(employees).values({
                id: newEmployeeId,
                name: user.email.split('@')[0], // Simple name derivation if user.name is missing
                email: user.email,
                departmentId: actualDepartmentId,
                orgDepartmentId: data.orgDepartmentId,
                positionId: data.positionId,
                joinDate: data.joinDate,
                probationSalaryCents: data.probationSalaryCents,
                regularSalaryCents: data.regularSalaryCents,
                livingAllowanceCents: 0,
                housingAllowanceCents: 0,
                transportationAllowanceCents: 0,
                mealAllowanceCents: 0,
                status: 'regular',
                active: 1,
                phone: null,
                usdtAddress: null,
                emergencyContact: null,
                emergencyPhone: null,
                address: null,
                memo: null,
                birthday: data.birthday,
                createdAt: now,
                updatedAt: now,
            }).run();

            // 7. Update User
            await tx.update(users).set({
                positionId: data.positionId,
                departmentId: actualDepartmentId,
                orgDepartmentId: data.orgDepartmentId,
            }).where(eq(users.id, userId)).run();

            return { id: newEmployeeId };
        });
    }

    async update(id: string, data: {
        name?: string;
        departmentId?: string;
        orgDepartmentId?: string;
        positionId?: string;
        joinDate?: string;
        probationSalaryCents?: number;
        regularSalaryCents?: number;
        livingAllowanceCents?: number;
        housingAllowanceCents?: number;
        transportationAllowanceCents?: number;
        mealAllowanceCents?: number;
        active?: number;
        phone?: string;
        email?: string;
        usdtAddress?: string;
        emergencyContact?: string;
        emergencyPhone?: string;
        address?: string;
        memo?: string;
        birthday?: string;
        workSchedule?: any;
        annualLeaveCycleMonths?: number;
        annualLeaveDays?: number;
    }) {
        return await this.db.transaction(async (tx) => {
            const employee = await tx.select().from(employees).where(eq(employees.id, id)).get();
            if (!employee) {
                throw new Error('Employee not found');
            }

            // Update Employee
            await tx.update(employees).set({
                ...data,
                updatedAt: Date.now()
            }).where(eq(employees.id, id)).run();

            // Sync User if needed
            if (data.departmentId || data.orgDepartmentId || data.positionId) {
                if (employee.email) {
                    const userUpdates: any = {};
                    if (data.departmentId) userUpdates.departmentId = data.departmentId;
                    if (data.orgDepartmentId) userUpdates.orgDepartmentId = data.orgDepartmentId;
                    if (data.positionId) userUpdates.positionId = data.positionId;

                    await tx.update(users).set(userUpdates).where(eq(users.email, employee.email)).run();

                    // Update user_departments if department changed
                    if (data.departmentId) {
                        const user = await tx.select().from(users).where(eq(users.email, employee.email)).get();
                        if (user) {
                            const existingUd = await tx.select().from(userDepartments)
                                .where(and(eq(userDepartments.userId, user.id), eq(userDepartments.departmentId, data.departmentId)))
                                .get();

                            if (!existingUd) {
                                await tx.insert(userDepartments).values({
                                    userId: user.id,
                                    departmentId: data.departmentId
                                }).run();
                            }
                        }
                    }
                }
            }

            return { id };
        });
    }



    async regularize(id: string, date: string) {
        const employee = await this.db.select().from(employees).where(eq(employees.id, id)).get();
        if (!employee) throw Errors.NOT_FOUND('员工');

        await this.db.update(employees).set({
            status: 'regular',
            regularDate: date,
            updatedAt: Date.now()
        }).where(eq(employees.id, id)).execute();

        return { id };
    }

    async leave(id: string, date: string, reason?: string) {
        const employee = await this.db.select().from(employees).where(eq(employees.id, id)).get();
        if (!employee) throw Errors.NOT_FOUND('员工');

        await this.db.update(employees).set({
            status: 'resigned',
            active: 0,
            memo: reason ? (employee.memo ? `${employee.memo}\n离职原因：${reason}` : `离职原因：${reason}`) : employee.memo,
            updatedAt: Date.now()
        }).where(eq(employees.id, id)).execute();

        // Disable user login
        if (employee.email) {
            await this.db.update(users).set({ active: 0 }).where(eq(users.email, employee.email)).execute();
        }

        return { id };
    }

    async rejoin(id: string, date: string) {
        const employee = await this.db.select().from(employees).where(eq(employees.id, id)).get();
        if (!employee) throw Errors.NOT_FOUND('员工');

        await this.db.update(employees).set({
            status: 'probation',
            active: 1,
            joinDate: date,
            updatedAt: Date.now()
        }).where(eq(employees.id, id)).execute();

        // Enable user login
        if (employee.email) {
            await this.db.update(users).set({ active: 1 }).where(eq(users.email, employee.email)).execute();
        }

        return { id };
    }

    // --- Employee Salaries ---

    async listSalaries(employeeId: string, salaryType?: string) {
        const conditions = [eq(schema.employeeSalaries.employeeId, employeeId)];
        if (salaryType) {
            conditions.push(eq(schema.employeeSalaries.salaryType, salaryType));
        }

        return await this.db.select({
            salary: schema.employeeSalaries,
            currencyName: schema.currencies.name,
            employeeName: employees.name
        })
            .from(schema.employeeSalaries)
            .leftJoin(schema.currencies, eq(schema.currencies.code, schema.employeeSalaries.currencyId))
            .leftJoin(employees, eq(employees.id, schema.employeeSalaries.employeeId))
            .where(and(...conditions))
            .orderBy(schema.employeeSalaries.salaryType, schema.currencies.code)
            .execute();
    }

    async createSalary(data: {
        employeeId: string;
        salaryType: string;
        currencyId: string;
        amountCents: number;
    }) {
        const id = uuid();
        const now = Date.now();
        await this.db.insert(schema.employeeSalaries).values({
            id,
            employeeId: data.employeeId,
            salaryType: data.salaryType,
            currencyId: data.currencyId,
            amountCents: data.amountCents,
            createdAt: now,
            updatedAt: now
        }).execute();

        return await this.getSalary(id);
    }

    async updateSalary(id: string, data: {
        amountCents: number;
    }) {
        const now = Date.now();
        await this.db.update(schema.employeeSalaries)
            .set({
                amountCents: data.amountCents,
                updatedAt: now
            })
            .where(eq(schema.employeeSalaries.id, id))
            .execute();

        return await this.getSalary(id);
    }

    async deleteSalary(id: string) {
        const salary = await this.db.select().from(schema.employeeSalaries).where(eq(schema.employeeSalaries.id, id)).get();
        if (!salary) return null;

        await this.db.delete(schema.employeeSalaries).where(eq(schema.employeeSalaries.id, id)).execute();
        return salary;
    }

    async getSalary(id: string) {
        return await this.db.select({
            salary: schema.employeeSalaries,
            currencyName: schema.currencies.name,
            employeeName: employees.name
        })
            .from(schema.employeeSalaries)
            .leftJoin(schema.currencies, eq(schema.currencies.code, schema.employeeSalaries.currencyId))
            .leftJoin(employees, eq(employees.id, schema.employeeSalaries.employeeId))
            .where(eq(schema.employeeSalaries.id, id))
            .get();
    }

    async batchUpdateSalaries(employeeId: string, salaryType: string, salaries: Array<{ currencyId: string, amountCents: number }>) {
        try {
            // Delete existing for this type
            await this.db.delete(schema.employeeSalaries)
                .where(and(
                    eq(schema.employeeSalaries.employeeId, employeeId),
                    eq(schema.employeeSalaries.salaryType, salaryType)
                ))
                .execute();

            const now = Date.now();
            const createdIds: string[] = [];

            for (const salary of salaries) {
                if (!salary.currencyId || salary.amountCents === undefined) continue;

                // Verify currency exists
                const currency = await this.db.select().from(schema.currencies).where(eq(schema.currencies.code, salary.currencyId)).get();
                if (!currency) continue;

                const id = uuid();
                await this.db.insert(schema.employeeSalaries).values({
                    id,
                    employeeId,
                    salaryType,
                    currencyId: salary.currencyId,
                    amountCents: salary.amountCents,
                    createdAt: now,
                    updatedAt: now
                }).execute();
                createdIds.push(id);
            }

            // Return updated list
            return await this.db.select({
                salary: schema.employeeSalaries,
                currencyName: schema.currencies.name,
                employeeName: employees.name
            })
                .from(schema.employeeSalaries)
                .leftJoin(schema.currencies, eq(schema.currencies.code, schema.employeeSalaries.currencyId))
                .leftJoin(employees, eq(employees.id, schema.employeeSalaries.employeeId))
                .where(and(
                    eq(schema.employeeSalaries.employeeId, employeeId),
                    eq(schema.employeeSalaries.salaryType, salaryType)
                ))
                .orderBy(schema.currencies.code)
                .execute();
        } catch (e) {
            console.error('batchUpdateSalaries error:', e);
            throw e;
        }
    }

    // --- Employee Allowances ---

    async listAllowances(employeeId: string, allowanceType?: string) {
        const conditions = [eq(schema.employeeAllowances.employeeId, employeeId)];
        if (allowanceType) {
            conditions.push(eq(schema.employeeAllowances.allowanceType, allowanceType));
        }

        return await this.db.select({
            allowance: schema.employeeAllowances,
            currencyName: schema.currencies.name,
            employeeName: employees.name
        })
            .from(schema.employeeAllowances)
            .leftJoin(schema.currencies, eq(schema.currencies.code, schema.employeeAllowances.currencyId))
            .leftJoin(employees, eq(employees.id, schema.employeeAllowances.employeeId))
            .where(and(...conditions))
            .orderBy(schema.employeeAllowances.allowanceType, schema.currencies.code)
            .execute();
    }

    async createAllowance(data: {
        employeeId: string;
        allowanceType: string;
        currencyId: string;
        amountCents: number;
    }) {
        const id = uuid();
        const now = Date.now();
        await this.db.insert(schema.employeeAllowances).values({
            id,
            employeeId: data.employeeId,
            allowanceType: data.allowanceType,
            currencyId: data.currencyId,
            amountCents: data.amountCents,
            createdAt: now,
            updatedAt: now
        }).execute();

        return await this.getAllowance(id);
    }

    async updateAllowance(id: string, data: {
        amountCents: number;
    }) {
        const now = Date.now();
        await this.db.update(schema.employeeAllowances)
            .set({
                amountCents: data.amountCents,
                updatedAt: now
            })
            .where(eq(schema.employeeAllowances.id, id))
            .execute();

        return await this.getAllowance(id);
    }

    async deleteAllowance(id: string) {
        const allowance = await this.db.select().from(schema.employeeAllowances).where(eq(schema.employeeAllowances.id, id)).get();
        if (!allowance) return null;

        await this.db.delete(schema.employeeAllowances).where(eq(schema.employeeAllowances.id, id)).execute();
        return allowance;
    }

    async getAllowance(id: string) {
        return await this.db.select({
            allowance: schema.employeeAllowances,
            currencyName: schema.currencies.name,
            employeeName: employees.name
        })
            .from(schema.employeeAllowances)
            .leftJoin(schema.currencies, eq(schema.currencies.code, schema.employeeAllowances.currencyId))
            .leftJoin(employees, eq(employees.id, schema.employeeAllowances.employeeId))
            .where(eq(schema.employeeAllowances.id, id))
            .get();
    }

    async batchUpdateAllowances(employeeId: string, allowanceType: string, allowances: Array<{ currencyId: string, amountCents: number }>) {
        try {
            // Delete existing for this type
            await this.db.delete(schema.employeeAllowances)
                .where(and(
                    eq(schema.employeeAllowances.employeeId, employeeId),
                    eq(schema.employeeAllowances.allowanceType, allowanceType)
                ))
                .execute();

            const now = Date.now();
            const createdIds: string[] = [];

            for (const allowance of allowances) {
                if (!allowance.currencyId || allowance.amountCents === undefined) continue;

                // Verify currency exists
                const currency = await this.db.select().from(schema.currencies).where(eq(schema.currencies.code, allowance.currencyId)).get();
                if (!currency) continue;

                const id = uuid();
                await this.db.insert(schema.employeeAllowances).values({
                    id,
                    employeeId,
                    allowanceType,
                    currencyId: allowance.currencyId,
                    amountCents: allowance.amountCents,
                    createdAt: now,
                    updatedAt: now
                }).execute();
                createdIds.push(id);
            }

            // Return updated list
            return await this.db.select({
                allowance: schema.employeeAllowances,
                currencyName: schema.currencies.name,
                employeeName: employees.name
            })
                .from(schema.employeeAllowances)
                .leftJoin(schema.currencies, eq(schema.currencies.code, schema.employeeAllowances.currencyId))
                .leftJoin(employees, eq(employees.id, schema.employeeAllowances.employeeId))
                .where(and(
                    eq(schema.employeeAllowances.employeeId, employeeId),
                    eq(schema.employeeAllowances.allowanceType, allowanceType)
                ))
                .orderBy(schema.currencies.code)
                .execute();
        } catch (e) {
            console.error('batchUpdateAllowances error:', e);
            throw e;
        }
    }

    // --- Allowance Payments ---

    async listAllowancePayments(query: {
        year?: number;
        month?: number;
        employeeId?: string;
        allowanceType?: string;
    }) {
        const conditions = [];
        if (query.year) conditions.push(eq(schema.allowancePayments.year, query.year));
        if (query.month) conditions.push(eq(schema.allowancePayments.month, query.month));
        if (query.employeeId) conditions.push(eq(schema.allowancePayments.employeeId, query.employeeId));
        if (query.allowanceType) conditions.push(eq(schema.allowancePayments.allowanceType, query.allowanceType));

        return await this.db.select({
            payment: schema.allowancePayments,
            employeeName: employees.name,
            departmentName: schema.departments.name,
            currencyName: schema.currencies.name,
            createdByName: schema.users.email // Simplified, ideally join with employees for name
        })
            .from(schema.allowancePayments)
            .leftJoin(employees, eq(employees.id, schema.allowancePayments.employeeId))
            .leftJoin(schema.departments, eq(schema.departments.id, employees.departmentId))
            .leftJoin(schema.currencies, eq(schema.currencies.code, schema.allowancePayments.currencyId))
            .leftJoin(schema.users, eq(schema.users.id, schema.allowancePayments.createdBy))
            .where(and(...conditions))
            .orderBy(desc(schema.allowancePayments.year), desc(schema.allowancePayments.month), employees.name)
            .execute();
    }

    async createAllowancePayment(data: {
        employeeId: string;
        year: number;
        month: number;
        allowanceType: string;
        currencyId: string;
        amountCents: number;
        paymentDate: string;
        paymentMethod?: string;
        voucherUrl?: string;
        memo?: string;
        createdBy?: string;
    }) {
        // Check duplicate
        const existing = await this.db.select().from(schema.allowancePayments)
            .where(and(
                eq(schema.allowancePayments.employeeId, data.employeeId),
                eq(schema.allowancePayments.year, data.year),
                eq(schema.allowancePayments.month, data.month),
                eq(schema.allowancePayments.allowanceType, data.allowanceType),
                eq(schema.allowancePayments.currencyId, data.currencyId)
            )).get();

        if (existing) throw Errors.DUPLICATE('津贴支付记录');

        const id = uuid();
        const now = Date.now();
        await this.db.insert(schema.allowancePayments).values({
            id,
            ...data,
            paymentMethod: data.paymentMethod || 'cash',
            createdAt: now,
            updatedAt: now
        }).execute();

        return await this.getAllowancePayment(id);
    }

    async updateAllowancePayment(id: string, data: {
        amountCents?: number;
        paymentDate?: string;
        paymentMethod?: string;
        voucherUrl?: string;
        memo?: string;
    }) {
        const now = Date.now();
        await this.db.update(schema.allowancePayments)
            .set({
                ...data,
                updatedAt: now
            })
            .where(eq(schema.allowancePayments.id, id))
            .execute();

        return await this.getAllowancePayment(id);
    }

    async deleteAllowancePayment(id: string) {
        const payment = await this.db.select().from(schema.allowancePayments).where(eq(schema.allowancePayments.id, id)).get();
        if (!payment) return null;

        await this.db.delete(schema.allowancePayments).where(eq(schema.allowancePayments.id, id)).execute();
        return payment;
    }

    async getAllowancePayment(id: string) {
        return await this.db.select({
            payment: schema.allowancePayments,
            employeeName: employees.name,
            departmentName: schema.departments.name,
            currencyName: schema.currencies.name,
            createdByName: schema.users.email
        })
            .from(schema.allowancePayments)
            .leftJoin(employees, eq(employees.id, schema.allowancePayments.employeeId))
            .leftJoin(schema.departments, eq(schema.departments.id, employees.departmentId))
            .leftJoin(schema.currencies, eq(schema.currencies.code, schema.allowancePayments.currencyId))
            .leftJoin(schema.users, eq(schema.users.id, schema.allowancePayments.createdBy))
            .where(eq(schema.allowancePayments.id, id))
            .get();
    }

    async generateAllowancePayments(year: number, month: number, paymentDate: string, userId: string) {
        // 1. Get active employees
        const activeEmployees = await this.db.select().from(employees).where(eq(employees.active, 1)).execute();

        // 2. Get all allowances
        const allAllowances = await this.db.select().from(schema.employeeAllowances).execute();
        const allowancesMap = new Map<string, typeof allAllowances>();
        allAllowances.forEach(a => {
            if (!allowancesMap.has(a.employeeId)) allowancesMap.set(a.employeeId, []);
            allowancesMap.get(a.employeeId)!.push(a);
        });

        // 3. Get existing payments
        const existingPayments = await this.db.select().from(schema.allowancePayments)
            .where(and(
                eq(schema.allowancePayments.year, year),
                eq(schema.allowancePayments.month, month)
            )).execute();

        const existingSet = new Set(existingPayments.map(p =>
            `${p.employeeId}:${p.year}:${p.month}:${p.allowanceType}:${p.currencyId}`
        ));

        const createdIds: string[] = [];
        const now = Date.now();

        for (const emp of activeEmployees) {
            const joinDate = new Date(emp.joinDate + 'T00:00:00Z');
            const joinYear = joinDate.getFullYear();
            const joinMonth = joinDate.getMonth() + 1;

            if (joinYear > year || (joinYear === year && joinMonth > month)) continue;

            const empAllowances = allowancesMap.get(emp.id) || [];

            for (const allowance of empAllowances) {
                if (allowance.allowanceType === 'birthday') {
                    if (!emp.birthday) continue;
                    const birthday = new Date(emp.birthday + 'T00:00:00Z');
                    if (birthday.getMonth() + 1 !== month) continue;
                }

                const key = `${emp.id}:${year}:${month}:${allowance.allowanceType}:${allowance.currencyId}`;
                if (existingSet.has(key)) continue;

                const id = uuid();
                await this.db.insert(schema.allowancePayments).values({
                    id,
                    employeeId: emp.id,
                    year,
                    month,
                    allowanceType: allowance.allowanceType,
                    currencyId: allowance.currencyId,
                    amountCents: allowance.amountCents,
                    paymentDate,
                    paymentMethod: 'cash',
                    createdBy: userId,
                    createdAt: now,
                    updatedAt: now
                }).execute();
                createdIds.push(id);
            }
        }

        return { created: createdIds.length, ids: createdIds };
    }
    async getSubordinateEmployeeIds(userId: string): Promise<string[]> {
        const user = await this.db.select({
            id: schema.users.id,
            email: schema.users.email,
            positionId: schema.users.positionId
        }).from(schema.users).where(eq(schema.users.id, userId)).get();

        if (!user || !user.positionId) return [];

        const position = await this.db.select().from(schema.positions).where(eq(schema.positions.id, user.positionId)).get();
        if (!position || !position.canManageSubordinates) return [];

        const employee = await this.db.select().from(employees).where(eq(employees.email, user.email)).get();

        // Level 1: HQ (All employees)
        if (position.level === 1) {
            const all = await this.db.select({ id: employees.id }).from(employees).where(eq(employees.active, 1)).execute();
            return all.map(e => e.id);
        }

        // Level 2: Project Manager (Employees in same department)
        if (position.level === 2 && employee?.departmentId) {
            const deptEmployees = await this.db.select({ id: employees.id })
                .from(employees)
                .where(and(
                    eq(employees.departmentId, employee.departmentId),
                    eq(employees.active, 1)
                )).execute();
            return deptEmployees.map(e => e.id);
        }

        // Team Leader (Employees in same org department)
        if (position.code === 'team_leader' && employee?.orgDepartmentId) {
            const teamEmployees = await this.db.select({ id: employees.id })
                .from(employees)
                .where(and(
                    eq(employees.orgDepartmentId, employee.orgDepartmentId),
                    eq(employees.active, 1)
                )).execute();
            return teamEmployees.map(e => e.id);
        }

        return [];
    }
}
