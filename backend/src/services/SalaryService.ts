import { eq, and } from 'drizzle-orm';
import { DrizzleD1Database } from 'drizzle-orm/d1';
import { employees } from '../db/schema.js';
import * as schema from '../db/schema.js';
import { v4 as uuid } from 'uuid';

export class SalaryService {
    constructor(private db: DrizzleD1Database<typeof schema>) { }

    async list(employeeId: string, salaryType?: string) {
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

    async create(data: {
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

        return await this.get(id);
    }

    async update(id: string, data: {
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

        return await this.get(id);
    }

    async delete(id: string) {
        const salary = await this.db.select().from(schema.employeeSalaries).where(eq(schema.employeeSalaries.id, id)).get();
        if (!salary) return null;

        await this.db.delete(schema.employeeSalaries).where(eq(schema.employeeSalaries.id, id)).execute();
        return salary;
    }

    async get(id: string) {
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

    async batchUpdate(employeeId: string, salaryType: string, salaries: Array<{ currencyId: string, amountCents: number }>) {
        try {
            // 删除该类型的现有记录
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

                // 验证币种是否存在
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

            // 返回更新后的列表
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
            console.error('batchUpdate salaries error:', e);
            throw e;
        }
    }
}
