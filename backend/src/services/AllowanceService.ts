import { eq, and } from 'drizzle-orm';
import { DrizzleD1Database } from 'drizzle-orm/d1';
import { employees } from '../db/schema.js';
import * as schema from '../db/schema.js';
import { v4 as uuid } from 'uuid';

export class AllowanceService {
    constructor(private db: DrizzleD1Database<typeof schema>) { }

    async list(employeeId: string, allowanceType?: string) {
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

    async create(data: {
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

        return await this.get(id);
    }

    async update(id: string, data: {
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

        return await this.get(id);
    }

    async delete(id: string) {
        const allowance = await this.db.select().from(schema.employeeAllowances).where(eq(schema.employeeAllowances.id, id)).get();
        if (!allowance) return null;

        await this.db.delete(schema.employeeAllowances).where(eq(schema.employeeAllowances.id, id)).execute();
        return allowance;
    }

    async get(id: string) {
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

    async batchUpdate(employeeId: string, allowanceType: string, allowances: Array<{ currencyId: string, amountCents: number }>) {
        try {
            // 删除该类型的现有记录
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

                // 验证币种是否存在
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

            // 返回更新后的列表
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
            console.error('batchUpdate allowances error:', e);
            throw e;
        }
    }
}
