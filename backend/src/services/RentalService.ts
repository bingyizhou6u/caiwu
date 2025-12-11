import { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from '../db/schema.js'
import { rentalProperties, rentalPayments, rentalChanges, dormitoryAllocations, rentalPayableBills, cashFlows, accountTransactions, accounts } from '../db/schema.js'
import { eq, and, desc, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import { v4 as uuid } from 'uuid'
import { Errors } from '../utils/errors.js'
import { FinanceService } from './FinanceService.js'

export class RentalService {
    constructor(private db: DrizzleD1Database<typeof schema>) { }

    // --- 物业管理 ---

    async listProperties(query: {
        propertyType?: string;
        status?: string;
        departmentId?: string;
    }) {
        const conditions = [];
        if (query.propertyType) conditions.push(eq(rentalProperties.propertyType, query.propertyType));
        if (query.status) conditions.push(eq(rentalProperties.status, query.status));
        if (query.departmentId) conditions.push(eq(rentalProperties.departmentId, query.departmentId));

        return await this.db.select({
            property: rentalProperties,
            departmentName: schema.departments.name,
            paymentAccountName: accounts.name,
            currencyName: schema.currencies.name,
            createdByName: schema.employees.name,
            allocationsCount: sql<number>`(SELECT count(*) FROM ${dormitoryAllocations} WHERE ${dormitoryAllocations.propertyId} = ${rentalProperties.id} AND ${dormitoryAllocations.returnDate} IS NULL)`
        })
            .from(rentalProperties)
            .leftJoin(schema.departments, eq(schema.departments.id, rentalProperties.departmentId))
            .leftJoin(accounts, eq(accounts.id, rentalProperties.paymentAccountId))
            .leftJoin(schema.currencies, eq(schema.currencies.code, rentalProperties.currency))
            .leftJoin(schema.employees, eq(schema.employees.id, rentalProperties.createdBy))
            .where(and(...conditions))
            .orderBy(desc(rentalProperties.createdAt))
            .execute();
    }

    async getProperty(id: string) {
        const property = await this.db.select({
            property: rentalProperties,
            departmentName: schema.departments.name,
            paymentAccountName: accounts.name,
            currencyName: schema.currencies.name,
            createdByName: schema.employees.name
        })
            .from(rentalProperties)
            .leftJoin(schema.departments, eq(schema.departments.id, rentalProperties.departmentId))
            .leftJoin(accounts, eq(accounts.id, rentalProperties.paymentAccountId))
            .leftJoin(schema.currencies, eq(schema.currencies.code, rentalProperties.currency))
            .leftJoin(schema.employees, eq(schema.employees.id, rentalProperties.createdBy))
            .where(eq(rentalProperties.id, id))
            .get();

        if (!property) throw Errors.NOT_FOUND('物业');

        // 并行获取相关数据
        const [payments, changes, allocations] = await Promise.all([
            this.db.select().from(rentalPayments).where(eq(rentalPayments.propertyId, id)).orderBy(desc(rentalPayments.year), desc(rentalPayments.month)).execute(),
            this.db.select().from(rentalChanges).where(eq(rentalChanges.propertyId, id)).orderBy(desc(rentalChanges.changeDate)).execute(),
            property.property.propertyType === 'dormitory'
                ? this.db.select({
                    allocation: dormitoryAllocations,
                    employeeName: schema.employees.name,
                    departmentName: schema.departments.name
                })
                    .from(dormitoryAllocations)
                    .leftJoin(schema.employees, eq(schema.employees.id, dormitoryAllocations.employeeId))
                    .leftJoin(schema.departments, eq(schema.departments.id, schema.employees.departmentId))
                    .where(eq(dormitoryAllocations.propertyId, id))
                    .orderBy(desc(dormitoryAllocations.allocationDate))
                    .execute()
                : Promise.resolve([])
        ]);

        return {
            ...property.property,
            departmentName: property.departmentName,
            paymentAccountName: property.paymentAccountName,
            currencyName: property.currencyName,
            createdByName: property.createdByName,
            payments,
            changes,
            allocations: allocations.map(a => ({
                ...a.allocation,
                employeeName: a.employeeName,
                departmentName: a.departmentName
            }))
        };
    }

    async createProperty(data: {
        propertyCode: string;
        name: string;
        propertyType: string;
        address?: string;
        areaSqm?: number;
        rentType?: string;
        monthlyRentCents?: number;
        yearlyRentCents?: number;
        currency: string;
        paymentPeriodMonths?: number;
        landlordName?: string;
        landlordContact?: string;
        leaseStartDate?: string;
        leaseEndDate?: string;
        depositCents?: number;
        paymentMethod?: string;
        paymentAccountId?: string;
        paymentDay?: number;
        departmentId?: string;
        status?: string;
        memo?: string;
        contractFileUrl?: string;
        createdBy?: string;
    }) {
        const existing = await this.db.select({ id: rentalProperties.id }).from(rentalProperties).where(eq(rentalProperties.propertyCode, data.propertyCode)).get();
        if (existing) throw Errors.DUPLICATE('物业代码');

        const id = uuid();
        const now = Date.now();

        await this.db.insert(rentalProperties).values({
            id,
            propertyCode: data.propertyCode,
            name: data.name,
            propertyType: data.propertyType,
            address: data.address,
            areaSqm: data.areaSqm,
            rentType: data.rentType || 'monthly',
            monthlyRentCents: data.monthlyRentCents,
            yearlyRentCents: data.yearlyRentCents,
            currency: data.currency,
            paymentPeriodMonths: data.paymentPeriodMonths || 1,
            landlordName: data.landlordName,
            landlordContact: data.landlordContact,
            leaseStartDate: data.leaseStartDate,
            leaseEndDate: data.leaseEndDate,
            depositCents: data.depositCents,
            paymentMethod: data.paymentMethod,
            paymentAccountId: data.paymentAccountId,
            paymentDay: data.paymentDay || 1,
            departmentId: data.propertyType === 'office' ? data.departmentId : null,
            status: data.status || 'active',
            memo: data.memo,
            contractFileUrl: data.contractFileUrl,
            createdBy: data.createdBy,
            createdAt: now,
            updatedAt: now
        }).execute();

        return { id };
    }

    async updateProperty(id: string, data: Partial<typeof rentalProperties.$inferInsert> & { createdBy?: string }) {
        const existing = await this.db.select().from(rentalProperties).where(eq(rentalProperties.id, id)).get();
        if (!existing) throw Errors.NOT_FOUND('物业');

        const now = Date.now();
        await this.db.update(rentalProperties).set({ ...data, updatedAt: now }).where(eq(rentalProperties.id, id)).execute();

        // 如果关键字段更新则记录变更
        if (data.status !== undefined || data.monthlyRentCents !== undefined || data.yearlyRentCents !== undefined || data.rentType !== undefined || data.leaseStartDate !== undefined || data.leaseEndDate !== undefined) {
            const changeId = uuid();
            await this.db.insert(rentalChanges).values({
                id: changeId,
                propertyId: id,
                changeType: 'modify',
                changeDate: new Date().toISOString().split('T')[0],
                fromLeaseStart: existing.leaseStartDate,
                toLeaseStart: data.leaseStartDate !== undefined ? data.leaseStartDate : existing.leaseStartDate,
                fromLeaseEnd: existing.leaseEndDate,
                toLeaseEnd: data.leaseEndDate !== undefined ? data.leaseEndDate : existing.leaseEndDate,
                fromMonthlyRentCents: existing.monthlyRentCents,
                toMonthlyRentCents: data.monthlyRentCents !== undefined ? data.monthlyRentCents : existing.monthlyRentCents,
                fromStatus: existing.status,
                toStatus: data.status !== undefined ? data.status : existing.status,
                memo: data.memo,
                createdBy: data.createdBy,
                createdAt: now
            }).execute();
        }
    }

    async deleteProperty(id: string) {
        const property = await this.db.select().from(rentalProperties).where(eq(rentalProperties.id, id)).get();
        if (!property) throw Errors.NOT_FOUND('物业');

        const paymentCount = await this.db.select({ count: sql<number>`count(*)` }).from(rentalPayments).where(eq(rentalPayments.propertyId, id)).get();
        if (paymentCount && paymentCount.count > 0) throw Errors.BUSINESS_ERROR('无法删除，该物业还有付款记录');

        await this.db.transaction(async (tx) => {
            await tx.delete(rentalChanges).where(eq(rentalChanges.propertyId, id)).execute();
            await tx.delete(dormitoryAllocations).where(eq(dormitoryAllocations.propertyId, id)).execute();
            await tx.delete(rentalProperties).where(eq(rentalProperties.id, id)).execute();
        });

        return property;
    }

    // --- 租金支付 ---

    async listPayments(query: {
        propertyId?: string;
        year?: number;
        month?: number;
    }) {
        const conditions = [];
        if (query.propertyId) conditions.push(eq(rentalPayments.propertyId, query.propertyId));
        if (query.year) conditions.push(eq(rentalPayments.year, query.year));
        if (query.month) conditions.push(eq(rentalPayments.month, query.month));

        return await this.db.select({
            payment: rentalPayments,
            propertyCode: rentalProperties.propertyCode,
            propertyName: rentalProperties.name,
            propertyType: rentalProperties.propertyType,
            accountName: accounts.name,
            categoryName: schema.categories.name,
            createdByName: schema.employees.name
        })
            .from(rentalPayments)
            .leftJoin(rentalProperties, eq(rentalProperties.id, rentalPayments.propertyId))
            .leftJoin(accounts, eq(accounts.id, rentalPayments.accountId))
            .leftJoin(schema.categories, eq(schema.categories.id, rentalPayments.categoryId))
            .leftJoin(schema.employees, eq(schema.employees.id, rentalPayments.createdBy))
            .where(and(...conditions))
            .orderBy(desc(rentalPayments.year), desc(rentalPayments.month), desc(rentalPayments.createdAt))
            .execute();
    }

    async createPayment(data: {
        propertyId: string;
        paymentDate: string;
        year: number;
        month: number;
        amountCents: number;
        currency: string;
        accountId: string;
        categoryId?: string;
        paymentMethod?: string;
        voucherUrl?: string;
        memo?: string;
        createdBy?: string;
    }) {
        const property = await this.db.select().from(rentalProperties).where(eq(rentalProperties.id, data.propertyId)).get();
        if (!property) throw Errors.NOT_FOUND('物业');

        const existing = await this.db.select().from(rentalPayments).where(and(
            eq(rentalPayments.propertyId, data.propertyId),
            eq(rentalPayments.year, data.year),
            eq(rentalPayments.month, data.month)
        )).get();
        if (existing) throw Errors.DUPLICATE('该月的付款记录');

        const account = await this.db.select().from(accounts).where(eq(accounts.id, data.accountId)).get();
        if (!account) throw Errors.NOT_FOUND('账户');
        if (account.active === 0) throw Errors.BUSINESS_ERROR('账户已停用');
        if (account.currency !== data.currency) throw Errors.BUSINESS_ERROR('账户币种不匹配');

        const paymentId = uuid();
        const now = Date.now();
        const flowId = uuid();
        const day = data.paymentDate.replace(/-/g, '');

        // 使用 FinanceService 计算余额
        const financeService = new FinanceService(this.db);

        // 这里需要事务处理
        return await this.db.transaction(async (tx) => {
            // 使用事务重新实例化 finance service
            const txFinanceService = new FinanceService(tx as any);

            await tx.insert(rentalPayments).values({
                id: paymentId,
                propertyId: data.propertyId,
                paymentDate: data.paymentDate,
                year: data.year,
                month: data.month,
                amountCents: data.amountCents,
                currency: data.currency,
                accountId: data.accountId,
                categoryId: data.categoryId,
                paymentMethod: data.paymentMethod,
                voucherUrl: data.voucherUrl,
                memo: data.memo,
                createdBy: data.createdBy,
                createdAt: now,
                updatedAt: now
            }).execute();

            const countRes = await tx.select({ count: sql<number>`count(*)` }).from(cashFlows).where(eq(cashFlows.bizDate, data.paymentDate)).get();
            const seq = ((countRes?.count ?? 0) + 1).toString().padStart(3, '0');
            const voucherNo = `JZ${day}-${seq}`;

            const balanceBefore = await txFinanceService.getAccountBalanceBefore(data.accountId, data.paymentDate, now);
            const balanceAfter = balanceBefore - data.amountCents;

            await tx.insert(cashFlows).values({
                id: flowId,
                voucherNo,
                bizDate: data.paymentDate,
                type: 'expense',
                accountId: data.accountId,
                categoryId: data.categoryId,
                method: data.paymentMethod,
                amountCents: data.amountCents,
                siteId: null,
                departmentId: property.departmentId,
                counterparty: property.landlordName,
                memo: `支付租金：${property.name}（${property.propertyCode}）` + (data.memo ? `；${data.memo}` : ''),
                voucherUrl: data.voucherUrl,
                createdBy: data.createdBy,
                createdAt: now
            }).execute();

            const transactionId = uuid();
            await tx.insert(accountTransactions).values({
                id: transactionId,
                accountId: data.accountId,
                flowId,
                transactionDate: data.paymentDate,
                transactionType: 'expense',
                amountCents: data.amountCents,
                balanceBeforeCents: balanceBefore,
                balanceAfterCents: balanceAfter,
                createdAt: now
            }).execute();

            await tx.update(rentalPayableBills).set({
                status: 'paid',
                paidDate: data.paymentDate,
                paidPaymentId: paymentId,
                updatedAt: now
            }).where(and(
                eq(rentalPayableBills.propertyId, data.propertyId),
                eq(rentalPayableBills.year, data.year),
                eq(rentalPayableBills.month, data.month),
                eq(rentalPayableBills.status, 'unpaid')
            )).execute();

            return { id: paymentId, flowId, voucherNo };
        });
    }

    async updatePayment(id: string, data: Partial<typeof rentalPayments.$inferInsert>) {
        const existing = await this.db.select().from(rentalPayments).where(eq(rentalPayments.id, id)).get();
        if (!existing) throw Errors.NOT_FOUND('付款记录');

        await this.db.update(rentalPayments).set({ ...data, updatedAt: Date.now() }).where(eq(rentalPayments.id, id)).execute();
    }

    async deletePayment(id: string) {
        const payment = await this.db.select().from(rentalPayments).where(eq(rentalPayments.id, id)).get();
        if (!payment) throw Errors.NOT_FOUND('付款记录');

        await this.db.delete(rentalPayments).where(eq(rentalPayments.id, id)).execute();
        return payment;
    }

    // --- 宿舍分配 ---

    async listAllocations(query: {
        propertyId?: string;
        employeeId?: string;
        returned?: boolean;
    }) {
        const conditions = [];
        if (query.propertyId) conditions.push(eq(dormitoryAllocations.propertyId, query.propertyId));
        if (query.employeeId) conditions.push(eq(dormitoryAllocations.employeeId, query.employeeId));
        if (query.returned === true) conditions.push(sql`${dormitoryAllocations.returnDate} IS NOT NULL`);
        if (query.returned === false) conditions.push(sql`${dormitoryAllocations.returnDate} IS NULL`);

        const creator = alias(schema.employees, 'creator');

        return await this.db.select({
            allocation: dormitoryAllocations,
            propertyCode: rentalProperties.propertyCode,
            propertyName: rentalProperties.name,
            employeeName: schema.employees.name,
            employeeDepartmentId: schema.employees.departmentId,
            employeeDepartmentName: schema.departments.name,
            createdByName: creator.name
        })
            .from(dormitoryAllocations)
            .leftJoin(rentalProperties, eq(rentalProperties.id, dormitoryAllocations.propertyId))
            .leftJoin(schema.employees, eq(schema.employees.id, dormitoryAllocations.employeeId))
            .leftJoin(schema.departments, eq(schema.departments.id, schema.employees.departmentId))
            .leftJoin(creator, eq(creator.id, dormitoryAllocations.createdBy))
            .where(and(...conditions))
            .orderBy(desc(dormitoryAllocations.allocationDate), desc(dormitoryAllocations.createdAt))
            .execute();
    }

    // 获取分配记录的辅助方法（简化版，暂时不包含创建人姓名以避免别名复杂性）
    async listAllocationsSimple(query: {
        propertyId?: string;
        employeeId?: string;
        returned?: boolean;
    }) {
        const conditions = [];
        if (query.propertyId) conditions.push(eq(dormitoryAllocations.propertyId, query.propertyId));
        if (query.employeeId) conditions.push(eq(dormitoryAllocations.employeeId, query.employeeId));
        if (query.returned === true) conditions.push(sql`${dormitoryAllocations.returnDate} IS NOT NULL`);
        if (query.returned === false) conditions.push(sql`${dormitoryAllocations.returnDate} IS NULL`);

        return await this.db.select({
            allocation: dormitoryAllocations,
            propertyCode: rentalProperties.propertyCode,
            propertyName: rentalProperties.name,
            employeeName: schema.employees.name,
            employeeDepartmentId: schema.employees.departmentId,
            employeeDepartmentName: schema.departments.name,
        })
            .from(dormitoryAllocations)
            .leftJoin(rentalProperties, eq(rentalProperties.id, dormitoryAllocations.propertyId))
            .leftJoin(schema.employees, eq(schema.employees.id, dormitoryAllocations.employeeId))
            .leftJoin(schema.departments, eq(schema.departments.id, schema.employees.departmentId))
            .where(and(...conditions))
            .orderBy(desc(dormitoryAllocations.allocationDate), desc(dormitoryAllocations.createdAt))
            .execute();
    }

    async allocateDormitory(data: {
        propertyId: string;
        employeeId: string;
        roomNumber?: string;
        bedNumber?: string;
        allocationDate: string;
        monthlyRentCents?: number;
        memo?: string;
        createdBy?: string;
    }) {
        const property = await this.db.select().from(rentalProperties).where(eq(rentalProperties.id, data.propertyId)).get();
        if (!property) throw Errors.NOT_FOUND('物业');
        if (property.propertyType !== 'dormitory') throw Errors.BUSINESS_ERROR('该物业不是宿舍');

        const employee = await this.db.select().from(schema.employees).where(eq(schema.employees.id, data.employeeId)).get();
        if (!employee) throw Errors.NOT_FOUND('员工');
        if (employee.active === 0) throw Errors.BUSINESS_ERROR('员工已停用');

        const existing = await this.db.select().from(dormitoryAllocations).where(and(
            eq(dormitoryAllocations.propertyId, data.propertyId),
            eq(dormitoryAllocations.employeeId, data.employeeId),
            sql`${dormitoryAllocations.returnDate} IS NULL`
        )).get();
        if (existing) throw Errors.DUPLICATE('员工已分配到该宿舍');

        const id = uuid();
        const now = Date.now();

        await this.db.insert(dormitoryAllocations).values({
            id,
            propertyId: data.propertyId,
            employeeId: data.employeeId,
            roomNumber: data.roomNumber,
            bedNumber: data.bedNumber,
            allocationDate: data.allocationDate,
            monthlyRentCents: data.monthlyRentCents,
            memo: data.memo,
            createdBy: data.createdBy,
            createdAt: now,
            updatedAt: now
        }).execute();

        return { id };
    }

    async returnDormitory(id: string, data: { returnDate: string; memo?: string }) {
        const allocation = await this.db.select().from(dormitoryAllocations).where(eq(dormitoryAllocations.id, id)).get();
        if (!allocation) throw Errors.NOT_FOUND('分配记录');
        if (allocation.returnDate) throw Errors.BUSINESS_ERROR('已归还');

        await this.db.update(dormitoryAllocations).set({
            returnDate: data.returnDate,
            memo: data.memo || allocation.memo,
            updatedAt: Date.now()
        }).where(eq(dormitoryAllocations.id, id)).execute();
    }

    // --- 应付账单 ---

    async generatePayableBills(userId?: string) {
        const now = Date.now();
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];

        const properties = await this.db.select().from(rentalProperties).where(and(
            eq(rentalProperties.status, 'active'),
            sql`${rentalProperties.leaseStartDate} IS NOT NULL`
        )).execute();

        const generated: any[] = [];

        for (const prop of properties) {
            if (!prop.leaseStartDate || !prop.leaseEndDate) continue;

            const leaseStart = new Date(prop.leaseStartDate);
            const leaseEnd = new Date(prop.leaseEndDate);
            const paymentPeriodMonths = prop.paymentPeriodMonths || 1;
            const paymentDay = prop.paymentDay || 1;

            let nextPaymentDate = new Date(leaseStart);

            while (nextPaymentDate <= today || nextPaymentDate.getDate() !== paymentDay) {
                if (nextPaymentDate <= today) {
                    nextPaymentDate = new Date(nextPaymentDate);
                    nextPaymentDate.setMonth(nextPaymentDate.getMonth() + paymentPeriodMonths);
                    nextPaymentDate.setDate(paymentDay);
                } else {
                    nextPaymentDate.setDate(paymentDay);
                }
            }

            if (nextPaymentDate > leaseEnd) continue;

            const billDate = new Date(nextPaymentDate);
            billDate.setDate(billDate.getDate() - 15);
            const billDateStr = billDate.toISOString().split('T')[0];
            const dueDateStr = nextPaymentDate.toISOString().split('T')[0];

            if (billDateStr > todayStr) continue;

            let amountCents = 0;
            if (prop.rentType === 'yearly') {
                amountCents = Math.round((prop.yearlyRentCents || 0) / (12 / paymentPeriodMonths));
            } else {
                amountCents = Math.round((prop.monthlyRentCents || 0) * paymentPeriodMonths);
            }

            const existingBill = await this.db.select().from(rentalPayableBills).where(and(
                eq(rentalPayableBills.propertyId, prop.id),
                eq(rentalPayableBills.year, nextPaymentDate.getFullYear()),
                eq(rentalPayableBills.month, nextPaymentDate.getMonth() + 1),
                eq(rentalPayableBills.status, 'unpaid')
            )).get();

            if (existingBill) continue;

            const billId = uuid();
            await this.db.insert(rentalPayableBills).values({
                id: billId,
                propertyId: prop.id,
                billDate: billDateStr,
                dueDate: dueDateStr,
                year: nextPaymentDate.getFullYear(),
                month: nextPaymentDate.getMonth() + 1,
                amountCents,
                currency: prop.currency,
                paymentPeriodMonths,
                status: 'unpaid',
                memo: `自动生成：${prop.name}（${prop.propertyCode}）`,
                createdBy: userId,
                createdAt: now,
                updatedAt: now
            }).execute();

            generated.push({
                id: billId,
                propertyCode: prop.propertyCode,
                propertyName: prop.name,
                dueDate: dueDateStr,
                amountCents
            });
        }

        return { generated: generated.length, bills: generated };
    }

    async listPayableBills(query: {
        propertyId?: string;
        status?: string;
        startDate?: string;
        endDate?: string;
    }) {
        const conditions = [];
        if (query.propertyId) conditions.push(eq(rentalPayableBills.propertyId, query.propertyId));
        if (query.status) conditions.push(eq(rentalPayableBills.status, query.status));
        if (query.startDate) conditions.push(sql`${rentalPayableBills.dueDate} >= ${query.startDate}`);
        if (query.endDate) conditions.push(sql`${rentalPayableBills.dueDate} <= ${query.endDate}`);

        return await this.db.select({
            bill: rentalPayableBills,
            propertyCode: rentalProperties.propertyCode,
            propertyName: rentalProperties.name,
            propertyType: rentalProperties.propertyType,
            landlordName: rentalProperties.landlordName
        })
            .from(rentalPayableBills)
            .leftJoin(rentalProperties, eq(rentalProperties.id, rentalPayableBills.propertyId))
            .where(and(...conditions))
            .orderBy(sql`${rentalPayableBills.dueDate} ASC`)
            .execute();
    }

    async markBillPaid(id: string) {
        const bill = await this.db.select().from(rentalPayableBills).where(eq(rentalPayableBills.id, id)).get();
        if (!bill) throw Errors.NOT_FOUND('账单');
        if (bill.status === 'paid') throw Errors.BUSINESS_ERROR('账单已支付');

        await this.db.update(rentalPayableBills).set({
            status: 'paid',
            paidDate: new Date().toISOString().split('T')[0],
            updatedAt: Date.now()
        }).where(eq(rentalPayableBills.id, id)).execute();

        return { ok: true };
    }
}
