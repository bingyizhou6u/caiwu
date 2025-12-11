import { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from '../db/schema.js'
import {
    fixedAssets, fixedAssetDepreciations, fixedAssetChanges, fixedAssetAllocations,
    departments, sites, vendors, currencies, employees, accounts, cashFlows, accountTransactions
} from '../db/schema.js'
import { eq, and, like, or, desc, sql, inArray } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import { Errors } from '../utils/errors.js'
import { FinanceService } from './FinanceService.js'

export class FixedAssetService {
    constructor(private db: DrizzleD1Database<typeof schema>) { }

    async list(query: {
        search?: string;
        status?: string;
        departmentId?: string;
        category?: string;
        createdBy?: string;
        limit?: number;
        offset?: number;
    }) {
        const conditions = [];
        if (query.search) {
            const search = `%${query.search}%`;
            conditions.push(or(
                like(fixedAssets.name, search),
                like(fixedAssets.assetCode, search),
                like(fixedAssets.custodian, search)
            ));
        }
        if (query.status) conditions.push(eq(fixedAssets.status, query.status));
        if (query.departmentId) conditions.push(eq(fixedAssets.departmentId, query.departmentId));
        if (query.category) conditions.push(eq(fixedAssets.category, query.category));
        if (query.createdBy) conditions.push(eq(fixedAssets.createdBy, query.createdBy));

        const assets = await this.db.select()
            .from(fixedAssets)
            .where(and(...conditions))
            .orderBy(desc(fixedAssets.createdAt))
            .limit(query.limit || 100)
            .offset(query.offset || 0)
            .execute();

        const deptIds = new Set<string>()
        const siteIds = new Set<string>()
        const vendorIds = new Set<string>()
        const userIds = new Set<string>()

        assets.forEach(a => {
            if (a.departmentId) deptIds.add(a.departmentId)
            if (a.siteId) siteIds.add(a.siteId)
            if (a.vendorId) vendorIds.add(a.vendorId)
            if (a.createdBy) userIds.add(a.createdBy)
        })

        const [depts, sitesList, vendorsList, usersList] = await Promise.all([
            deptIds.size > 0 ? this.db.select().from(departments).where(inArray(departments.id, Array.from(deptIds))).execute() : [],
            siteIds.size > 0 ? this.db.select().from(sites).where(inArray(sites.id, Array.from(siteIds))).execute() : [],
            vendorIds.size > 0 ? this.db.select().from(vendors).where(inArray(vendors.id, Array.from(vendorIds))).execute() : [],
            userIds.size > 0 ? this.db.select().from(employees).where(inArray(employees.id, Array.from(userIds))).execute() : []
        ])

        const deptMap = new Map(depts.map(d => [d.id, d]))
        const siteMap = new Map(sitesList.map(s => [s.id, s]))
        const vendorMap = new Map(vendorsList.map(v => [v.id, v]))
        const userMap = new Map(usersList.map(u => [u.id, u]))

        // 货币通常是静态的，但根据需要获取。
        // 原始查询关联了货币表。我们也获取一下。
        const currencyCodes = new Set(assets.map(a => a.currency).filter(Boolean))
        const currenciesList = currencyCodes.size > 0 ? await this.db.select().from(currencies).where(inArray(currencies.code, Array.from(currencyCodes))).execute() : []
        const currencyMap = new Map(currenciesList.map(c => [c.code, c]))

        return assets.map(asset => ({
            asset,
            departmentName: asset.departmentId ? deptMap.get(asset.departmentId)?.name || null : null,
            siteName: asset.siteId ? siteMap.get(asset.siteId)?.name || null : null,
            vendorName: asset.vendorId ? vendorMap.get(asset.vendorId)?.name || null : null,
            currencyName: asset.currency ? currencyMap.get(asset.currency)?.name || null : null,
            createdByName: asset.createdBy ? userMap.get(asset.createdBy)?.email || null : null
        }))
    }

    async getCategories() {
        return await this.db.selectDistinct({ name: fixedAssets.category })
            .from(fixedAssets)
            .where(sql`${fixedAssets.category} is not null and ${fixedAssets.category} != ''`)
            .orderBy(fixedAssets.category)
            .execute();
    }

    async listAllocations(query: {
        assetId?: string;
        employeeId?: string;
        returned?: boolean;
    }) {
        const conditions = [];
        if (query.assetId) conditions.push(eq(fixedAssetAllocations.assetId, query.assetId));
        if (query.employeeId) conditions.push(eq(fixedAssetAllocations.employeeId, query.employeeId));
        if (query.returned === true) conditions.push(sql`${fixedAssetAllocations.returnDate} is not null`);
        if (query.returned === false) conditions.push(sql`${fixedAssetAllocations.returnDate} is null`);

        const allocations = await this.db.select()
            .from(fixedAssetAllocations)
            .where(and(...conditions))
            .orderBy(desc(fixedAssetAllocations.allocationDate), desc(fixedAssetAllocations.createdAt))
            .execute();

        const assetIds = new Set<string>()
        const empIds = new Set<string>()
        const userIds = new Set<string>()

        allocations.forEach(a => {
            assetIds.add(a.assetId)
            empIds.add(a.employeeId)
            if (a.createdBy) userIds.add(a.createdBy)
        })

        const [assetsList, employeesList, usersList] = await Promise.all([
            assetIds.size > 0 ? this.db.select().from(fixedAssets).where(inArray(fixedAssets.id, Array.from(assetIds))).execute() : [],
            empIds.size > 0 ? this.db.select().from(employees).where(inArray(employees.id, Array.from(empIds))).execute() : [],
            userIds.size > 0 ? this.db.select().from(employees).where(inArray(employees.id, Array.from(userIds))).execute() : []
        ])

        const assetMap = new Map(assetsList.map(a => [a.id, a]))
        const empMap = new Map(employeesList.map(e => [e.id, e]))
        const userMap = new Map(usersList.map(u => [u.id, u]))

        // 需要员工的部门名称
        const deptIds = new Set(employeesList.map(e => e.departmentId).filter(Boolean) as string[])
        const depts = deptIds.size > 0 ? await this.db.select().from(departments).where(inArray(departments.id, Array.from(deptIds))).execute() : []
        const deptMap = new Map(depts.map(d => [d.id, d]))

        return allocations.map(allocation => {
            const asset = assetMap.get(allocation.assetId)
            const employee = empMap.get(allocation.employeeId)
            const dept = employee?.departmentId ? deptMap.get(employee.departmentId) : null
            return {
                allocation,
                assetCode: asset?.assetCode || null,
                assetName: asset?.name || null,
                employeeName: employee?.name || null,
                employeeDepartmentId: employee?.departmentId || null,
                employeeDepartmentName: dept?.name || null,
                createdByName: allocation.createdBy ? userMap.get(allocation.createdBy)?.email || null : null
            }
        })
    }

    async get(id: string) {
        const asset = await this.db.select().from(fixedAssets).where(eq(fixedAssets.id, id)).get();
        if (!asset) return null;

        const [dept, site, vendor, currency, user] = await Promise.all([
            asset.departmentId ? this.db.select().from(departments).where(eq(departments.id, asset.departmentId)).get() : null,
            asset.siteId ? this.db.select().from(sites).where(eq(sites.id, asset.siteId)).get() : null,
            asset.vendorId ? this.db.select().from(vendors).where(eq(vendors.id, asset.vendorId)).get() : null,
            asset.currency ? this.db.select().from(currencies).where(eq(currencies.code, asset.currency)).get() : null,
            asset.createdBy ? this.db.select().from(employees).where(eq(employees.id, asset.createdBy)).get() : null
        ])

        const depreciations = await this.db.select().from(fixedAssetDepreciations)
            .where(eq(fixedAssetDepreciations.assetId, id))
            .orderBy(desc(fixedAssetDepreciations.depreciationDate))
            .execute()

        const changes = await this.db.select().from(fixedAssetChanges)
            .where(eq(fixedAssetChanges.assetId, id))
            .orderBy(desc(fixedAssetChanges.changeDate), desc(fixedAssetChanges.createdAt))
            .execute()

        // 需要映射变更记录中的名称...这有点复杂。
        //目前，我们只返回变更记录本身，如果关键则获取相关名称。
        // 原始查询关联了部门/站点的 from/to。
        // 这太重了。让我们获取变更记录中引用的所有部门/站点。

        const changeDeptIds = new Set<string>()
        const changeSiteIds = new Set<string>()
        const changeUserIds = new Set<string>()

        changes.forEach(c => {
            if (c.fromDeptId) changeDeptIds.add(c.fromDeptId)
            if (c.toDeptId) changeDeptIds.add(c.toDeptId)
            if (c.fromSiteId) changeSiteIds.add(c.fromSiteId)
            if (c.toSiteId) changeSiteIds.add(c.toSiteId)
            if (c.createdBy) changeUserIds.add(c.createdBy)
        })

        const [changeDepts, changeSites, changeUsers] = await Promise.all([
            changeDeptIds.size > 0 ? this.db.select().from(departments).where(inArray(departments.id, Array.from(changeDeptIds))).execute() : [],
            changeSiteIds.size > 0 ? this.db.select().from(sites).where(inArray(sites.id, Array.from(changeSiteIds))).execute() : [],
            changeUserIds.size > 0 ? this.db.select().from(employees).where(inArray(employees.id, Array.from(changeUserIds))).execute() : []
        ])

        const changeDeptMap = new Map(changeDepts.map(d => [d.id, d]))
        const changeSiteMap = new Map(changeSites.map(s => [s.id, s]))
        const changeUserMap = new Map(changeUsers.map(u => [u.id, u]))

        return {
            ...asset,
            departmentName: dept?.name || null,
            siteName: site?.name || null,
            vendorName: vendor?.name || null,
            currencyName: currency?.name || null,
            createdByName: user?.email || null,
            depreciations,
            changes: changes.map(c => ({
                ...c,
                fromDeptName: c.fromDeptId ? changeDeptMap.get(c.fromDeptId)?.name || null : null,
                toDeptName: c.toDeptId ? changeDeptMap.get(c.toDeptId)?.name || null : null,
                fromSiteName: c.fromSiteId ? changeSiteMap.get(c.fromSiteId)?.name || null : null,
                toSiteName: c.toSiteId ? changeSiteMap.get(c.toSiteId)?.name || null : null,
                createdByName: c.createdBy ? changeUserMap.get(c.createdBy)?.email || null : null
            }))
        };
    }

    async create(data: {
        assetCode: string;
        name: string;
        category?: string;
        purchaseDate?: string;
        purchasePriceCents: number;
        currency: string;
        vendorId?: string;
        departmentId?: string;
        siteId?: string;
        custodian?: string;
        status?: string;
        depreciationMethod?: string;
        usefulLifeYears?: number;
        currentValueCents?: number;
        memo?: string;
        createdBy?: string;
    }) {
        const existing = await this.db.select().from(fixedAssets).where(eq(fixedAssets.assetCode, data.assetCode)).get();
        if (existing) throw Errors.DUPLICATE('资产代码');

        const id = uuid();
        const now = Date.now();
        await this.db.insert(fixedAssets).values({
            id,
            ...data,
            status: data.status || 'in_use',
            currentValueCents: data.currentValueCents !== undefined ? data.currentValueCents : data.purchasePriceCents,
            createdAt: now,
            updatedAt: now
        }).execute();

        return { id, assetCode: data.assetCode };
    }

    async update(id: string, data: {
        name?: string;
        category?: string;
        purchaseDate?: string;
        purchasePriceCents?: number;
        currency?: string;
        vendorId?: string;
        departmentId?: string;
        siteId?: string;
        custodian?: string;
        status?: string;
        memo?: string;
        createdBy?: string; // 用于变更日志
    }) {
        const existing = await this.db.select().from(fixedAssets).where(eq(fixedAssets.id, id)).get();
        if (!existing) throw Errors.NOT_FOUND();

        const now = Date.now();
        await this.db.update(fixedAssets)
            .set({
                ...data,
                updatedAt: now
            })
            .where(eq(fixedAssets.id, id))
            .execute();

        // 如果状态、部门、站点或保管人发生变化，记录变更日志
        if (data.status || data.departmentId || data.siteId || data.custodian) {
            const changeId = uuid();
            await this.db.insert(fixedAssetChanges).values({
                id: changeId,
                assetId: id,
                changeType: 'status_change',
                changeDate: new Date().toISOString().split('T')[0],
                fromDeptId: existing.departmentId,
                toDeptId: data.departmentId !== undefined ? data.departmentId : existing.departmentId,
                fromSiteId: existing.siteId,
                toSiteId: data.siteId !== undefined ? data.siteId : existing.siteId,
                fromCustodian: existing.custodian,
                toCustodian: data.custodian !== undefined ? data.custodian : existing.custodian,
                fromStatus: existing.status,
                toStatus: data.status || existing.status,
                memo: data.memo,
                createdBy: data.createdBy,
                createdAt: now
            }).execute();
        }

        return { ok: true };
    }

    async delete(id: string) {
        const asset = await this.db.select().from(fixedAssets).where(eq(fixedAssets.id, id)).get();
        if (!asset) throw Errors.NOT_FOUND();

        const depCount = await this.db.select({ count: sql<number>`count(*)` })
            .from(fixedAssetDepreciations)
            .where(eq(fixedAssetDepreciations.assetId, id))
            .get();

        if (depCount && depCount.count > 0) {
            throw Errors.BUSINESS_ERROR('无法删除，该资产还有折旧记录');
        }

        await this.db.transaction(async (tx) => {
            await tx.delete(fixedAssetChanges).where(eq(fixedAssetChanges.assetId, id)).run();
            await tx.delete(fixedAssets).where(eq(fixedAssets.id, id)).run();
        });

        return asset;
    }

    async createDepreciation(id: string, data: {
        amountCents: number;
        depreciationDate: string;
        memo?: string;
        createdBy?: string;
    }) {
        const asset = await this.db.select().from(fixedAssets).where(eq(fixedAssets.id, id)).get();
        if (!asset) throw Errors.NOT_FOUND('asset');

        const existingDep = await this.db.select({ total: sql<number>`coalesce(sum(${fixedAssetDepreciations.depreciationAmountCents}), 0)` })
            .from(fixedAssetDepreciations)
            .where(eq(fixedAssetDepreciations.assetId, id))
            .get();

        const accumulatedDepreciation = (existingDep?.total || 0) + data.amountCents;
        const remainingValue = Number(asset.purchasePriceCents) - accumulatedDepreciation;

        if (remainingValue < 0) {
            throw Errors.BUSINESS_ERROR('折旧金额超过购买价格');
        }

        const depId = uuid();
        const now = Date.now();

        await this.db.transaction(async (tx) => {
            await tx.insert(fixedAssetDepreciations).values({
                id: depId,
                assetId: id,
                depreciationDate: data.depreciationDate,
                depreciationAmountCents: data.amountCents,
                accumulatedDepreciationCents: accumulatedDepreciation,
                remainingValueCents: remainingValue,
                memo: data.memo,
                createdBy: data.createdBy,
                createdAt: now
            }).run();

            await tx.update(fixedAssets)
                .set({ currentValueCents: remainingValue, updatedAt: now })
                .where(eq(fixedAssets.id, id))
                .run();
        });

        return { id: depId };
    }

    async transfer(id: string, data: {
        transferDate: string;
        toDepartmentId?: string;
        toSiteId?: string;
        toCustodian?: string;
        memo?: string;
        createdBy?: string;
    }) {
        if (!data.toDepartmentId && !data.toSiteId && !data.toCustodian) {
            throw Errors.VALIDATION_ERROR('transfer_date and at least one of to_department_id, to_site_id, to_custodian参数必填');
        }

        const asset = await this.db.select().from(fixedAssets).where(eq(fixedAssets.id, id)).get();
        if (!asset) throw Errors.NOT_FOUND('asset');

        const changeId = uuid();
        const now = Date.now();

        await this.db.transaction(async (tx) => {
            await tx.insert(fixedAssetChanges).values({
                id: changeId,
                assetId: id,
                changeType: 'transfer',
                changeDate: data.transferDate,
                fromDeptId: asset.departmentId,
                toDeptId: data.toDepartmentId,
                fromSiteId: asset.siteId,
                toSiteId: data.toSiteId,
                fromCustodian: asset.custodian,
                toCustodian: data.toCustodian,
                memo: data.memo,
                createdBy: data.createdBy,
                createdAt: now
            }).run();

            const updates: any = { updatedAt: now };
            if (data.toDepartmentId !== undefined) updates.departmentId = data.toDepartmentId;
            if (data.toSiteId !== undefined) updates.siteId = data.toSiteId;
            if (data.toCustodian !== undefined) updates.custodian = data.toCustodian;

            await tx.update(fixedAssets).set(updates).where(eq(fixedAssets.id, id)).run();
        });

        return { ok: true };
    }

    async purchase(data: {
        assetCode: string;
        name: string;
        category?: string;
        purchaseDate?: string;
        purchasePriceCents: number;
        currency: string;
        vendorId?: string;
        departmentId?: string;
        siteId?: string;
        custodian?: string;
        depreciationMethod?: string;
        usefulLifeYears?: number;
        memo?: string;
        accountId: string;
        categoryId: string;
        voucherUrl?: string;
        createdBy?: string;
    }) {
        const existing = await this.db.select().from(fixedAssets).where(eq(fixedAssets.assetCode, data.assetCode)).get();
        if (existing) throw Errors.DUPLICATE('资产代码');

        const account = await this.db.select().from(accounts).where(eq(accounts.id, data.accountId)).get();
        if (!account) throw Errors.NOT_FOUND('账户');
        if (account.active === 0) throw Errors.BUSINESS_ERROR('账户已停用');
        if (account.currency !== data.currency) throw Errors.BUSINESS_ERROR('账户币种不匹配');

        const assetId = uuid();
        const flowId = uuid();
        const transactionId = uuid();
        const changeId = uuid();
        const now = Date.now();
        const purchaseDate = data.purchaseDate || new Date().toISOString().split('T')[0];
        const day = purchaseDate.replace(/-/g, '');

        // 生成凭证号
        const count = await this.db.select({ count: sql<number>`count(*)` })
            .from(cashFlows)
            .where(eq(cashFlows.bizDate, purchaseDate))
            .get();
        const seq = ((count?.count ?? 0) + 1).toString().padStart(3, '0');
        const voucherNo = `JZ${day}-${seq}`;

        const financeService = new FinanceService(this.db);
        const balanceBefore = await financeService.getAccountBalanceBefore(data.accountId, purchaseDate, now);
        const balanceAfter = balanceBefore - data.purchasePriceCents;

        let vendorName: string | null = null;
        if (data.vendorId) {
            const vendor = await this.db.select().from(vendors).where(eq(vendors.id, data.vendorId)).get();
            vendorName = vendor?.name || null;
        }

        await this.db.transaction(async (tx) => {
            // 1. 创建资产
            await tx.insert(fixedAssets).values({
                id: assetId,
                assetCode: data.assetCode,
                name: data.name,
                category: data.category,
                purchaseDate,
                purchasePriceCents: data.purchasePriceCents,
                currency: data.currency,
                vendorId: data.vendorId,
                departmentId: data.departmentId,
                siteId: data.siteId,
                custodian: data.custodian,
                status: 'in_use',
                depreciationMethod: data.depreciationMethod,
                usefulLifeYears: data.usefulLifeYears,
                currentValueCents: data.purchasePriceCents,
                memo: data.memo,
                createdBy: data.createdBy,
                createdAt: now,
                updatedAt: now
            }).run();

            // 2. 创建现金流水
            await tx.insert(cashFlows).values({
                id: flowId,
                voucherNo,
                bizDate: purchaseDate,
                type: 'expense',
                accountId: data.accountId,
                categoryId: data.categoryId,
                amountCents: data.purchasePriceCents,
                siteId: data.siteId,
                departmentId: data.departmentId,
                counterparty: vendorName,
                memo: `购买资产：${data.name}（${data.assetCode}）` + (data.memo ? `；${data.memo}` : ''),
                voucherUrl: data.voucherUrl,
                createdBy: data.createdBy,
                createdAt: now
            }).run();

            // 3. 创建交易记录
            await tx.insert(accountTransactions).values({
                id: transactionId,
                accountId: data.accountId,
                flowId,
                transactionDate: purchaseDate,
                transactionType: 'expense',
                amountCents: data.purchasePriceCents,
                balanceBeforeCents: balanceBefore,
                balanceAfterCents: balanceAfter,
                createdAt: now
            }).run();

            // 4. 创建资产变更日志
            await tx.insert(fixedAssetChanges).values({
                id: changeId,
                assetId,
                changeType: 'purchase',
                changeDate: purchaseDate,
                toStatus: 'in_use',
                memo: `购买资产：${data.name}`,
                createdBy: data.createdBy,
                createdAt: now
            }).run();
        });

        return { id: assetId, assetCode: data.assetCode, flowId, voucherNo };
    }

    async sell(id: string, data: {
        saleDate: string;
        salePriceCents: number;
        saleBuyer?: string;
        saleMemo?: string;
        accountId: string;
        categoryId: string;
        currency: string;
        voucherUrl?: string;
        memo?: string;
        createdBy?: string;
    }) {
        const asset = await this.db.select().from(fixedAssets).where(eq(fixedAssets.id, id)).get();
        if (!asset) throw Errors.NOT_FOUND('asset');

        if (asset.status === 'sold') {
            throw Errors.BUSINESS_ERROR('资产已出售');
        }

        const account = await this.db.select().from(accounts).where(eq(accounts.id, data.accountId)).get();
        if (!account) throw Errors.NOT_FOUND('账户');
        if (account.active === 0) throw Errors.BUSINESS_ERROR('账户已停用');
        if (account.currency !== data.currency) throw Errors.BUSINESS_ERROR('账户币种不匹配');

        const flowId = uuid();
        const transactionId = uuid();
        const changeId = uuid();
        const now = Date.now();
        const day = data.saleDate.replace(/-/g, '');

        const count = await this.db.select({ count: sql<number>`count(*)` })
            .from(cashFlows)
            .where(eq(cashFlows.bizDate, data.saleDate))
            .get();
        const seq = ((count?.count ?? 0) + 1).toString().padStart(3, '0');
        const voucherNo = `JZ${day}-${seq}`;

        const financeService = new FinanceService(this.db);
        const balanceBefore = await financeService.getAccountBalanceBefore(data.accountId, data.saleDate, now);
        const balanceAfter = balanceBefore + data.salePriceCents;

        await this.db.transaction(async (tx) => {
            // 1. 更新资产
            await tx.update(fixedAssets)
                .set({
                    status: 'sold',
                    saleDate: data.saleDate,
                    salePriceCents: data.salePriceCents,
                    saleBuyer: data.saleBuyer,
                    saleMemo: data.saleMemo,
                    updatedAt: now
                })
                .where(eq(fixedAssets.id, id))
                .run();

            // 2. 创建现金流水
            await tx.insert(cashFlows).values({
                id: flowId,
                voucherNo,
                bizDate: data.saleDate,
                type: 'income',
                accountId: data.accountId,
                categoryId: data.categoryId,
                amountCents: data.salePriceCents,
                siteId: asset.siteId,
                departmentId: asset.departmentId,
                counterparty: data.saleBuyer,
                memo: `卖出资产：${asset.name}（${asset.assetCode}）` + (data.saleMemo ? `；${data.saleMemo}` : ''),
                voucherUrl: data.voucherUrl,
                createdBy: data.createdBy,
                createdAt: now
            }).run();

            // 3. 创建交易记录
            await tx.insert(accountTransactions).values({
                id: transactionId,
                accountId: data.accountId,
                flowId,
                transactionDate: data.saleDate,
                transactionType: 'income',
                amountCents: data.salePriceCents,
                balanceBeforeCents: balanceBefore,
                balanceAfterCents: balanceAfter,
                createdAt: now
            }).run();

            // 4. 创建资产变更日志
            await tx.insert(fixedAssetChanges).values({
                id: changeId,
                assetId: id,
                changeType: 'sale',
                changeDate: data.saleDate,
                fromStatus: asset.status,
                toStatus: 'sold',
                memo: `卖出资产：${asset.name}，卖出价格：${(data.salePriceCents / 100).toFixed(2)} ${asset.currency}` + (data.memo ? `；${data.memo}` : ''),
                createdBy: data.createdBy,
                createdAt: now
            }).run();
        });

        return { ok: true, flowId, voucherNo };
    }

    async allocate(id: string, data: {
        employeeId: string;
        allocationDate: string;
        allocationType?: string;
        expectedReturnDate?: string;
        memo?: string;
        createdBy?: string;
    }) {
        const asset = await this.db.select().from(fixedAssets).where(eq(fixedAssets.id, id)).get();
        if (!asset) throw Errors.NOT_FOUND('asset');

        if (asset.status !== 'in_use' && asset.status !== 'idle') {
            throw Errors.BUSINESS_ERROR('只能分配使用中或闲置的资产');
        }

        const employee = await this.db.select().from(employees).where(eq(employees.id, data.employeeId)).get();
        if (!employee) throw Errors.NOT_FOUND('员工');
        if (employee.active === 0) throw Errors.BUSINESS_ERROR('员工已停用');

        const existingAllocation = await this.db.select().from(fixedAssetAllocations)
            .where(and(
                eq(fixedAssetAllocations.assetId, id),
                sql`${fixedAssetAllocations.returnDate} is null`
            )).get();

        if (existingAllocation) {
            throw Errors.BUSINESS_ERROR('资产已分配且未归还');
        }

        const allocationId = uuid();
        const changeId = uuid();
        const now = Date.now();
        const memo = data.memo ? data.memo + (data.expectedReturnDate ? ` (预计归还：${data.expectedReturnDate})` : '') : (data.expectedReturnDate ? `预计归还：${data.expectedReturnDate}` : undefined);

        await this.db.transaction(async (tx) => {
            await tx.insert(fixedAssetAllocations).values({
                id: allocationId,
                assetId: id,
                employeeId: data.employeeId,
                allocationDate: data.allocationDate,
                allocationType: data.allocationType || 'employee_onboarding',
                memo: memo,
                createdBy: data.createdBy,
                createdAt: now,
                updatedAt: now
            }).run();

            await tx.update(fixedAssets)
                .set({
                    status: 'in_use',
                    custodian: employee.name,
                    departmentId: employee.departmentId || asset.departmentId,
                    updatedAt: now
                })
                .where(eq(fixedAssets.id, id))
                .run();

            await tx.insert(fixedAssetChanges).values({
                id: changeId,
                assetId: id,
                changeType: 'allocation',
                changeDate: data.allocationDate,
                fromCustodian: asset.custodian,
                toCustodian: employee.name,
                fromStatus: asset.status,
                toStatus: 'in_use',
                memo: `分配给员工：${employee.name}（${data.allocationType === 'employee_onboarding' ? '员工入职' : data.allocationType === 'transfer' ? '调拨' : '临时借用'}）`,
                createdBy: data.createdBy,
                createdAt: now
            }).run();
        });

        return { id: allocationId };
    }

    async return(id: string, data: {
        returnDate: string;
        returnType?: string;
        memo?: string;
        createdBy?: string;
    }) {
        const asset = await this.db.select().from(fixedAssets).where(eq(fixedAssets.id, id)).get();
        if (!asset) throw Errors.NOT_FOUND('asset');

        const allocation = await this.db.select().from(fixedAssetAllocations)
            .where(and(
                eq(fixedAssetAllocations.assetId, id),
                sql`${fixedAssetAllocations.returnDate} is null`
            )).get();

        if (!allocation) {
            throw Errors.BUSINESS_ERROR('资产未分配或已归还');
        }

        const changeId = uuid();
        const now = Date.now();

        await this.db.transaction(async (tx) => {
            await tx.update(fixedAssetAllocations)
                .set({
                    returnDate: data.returnDate,
                    returnType: data.returnType || 'employee_resignation',
                    memo: data.memo ? (allocation.memo ? allocation.memo + '; ' + data.memo : data.memo) : allocation.memo,
                    updatedAt: now
                })
                .where(eq(fixedAssetAllocations.id, allocation.id))
                .run();

            await tx.update(fixedAssets)
                .set({
                    status: 'idle',
                    custodian: null,
                    updatedAt: now
                })
                .where(eq(fixedAssets.id, id))
                .run();

            await tx.insert(fixedAssetChanges).values({
                id: changeId,
                assetId: id,
                changeType: 'return',
                changeDate: data.returnDate,
                fromCustodian: asset.custodian,
                toCustodian: null,
                fromStatus: asset.status,
                toStatus: 'idle',
                memo: `员工归还（${data.returnType === 'employee_resignation' ? '员工离职' : '其他'}）`,
                createdBy: data.createdBy,
                createdAt: now
            }).run();
        });

        return { ok: true };
    }
}
