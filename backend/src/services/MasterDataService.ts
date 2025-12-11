import { DrizzleD1Database } from 'drizzle-orm/d1'
import { eq, and, ne, desc, sql, like, or } from 'drizzle-orm'
import * as schema from '../db/schema.js'
import { departments, sites, accounts, vendors, accountTransactions, cashFlows, categories, currencies, headquarters } from '../db/schema.js'
import { Errors } from '../utils/errors.js'
import { v4 as uuid } from 'uuid'

export class MasterDataService {
    constructor(private db: DrizzleD1Database<typeof schema>) { }

    // ========== Departments ==========

    async getDepartments() {
        return this.db.select().from(departments).all()
    }

    async createDepartment(data: { name: string; hqId?: string; code?: string }) {
        const existing = await this.db.query.departments.findFirst({
            where: eq(departments.name, data.name)
        })
        if (existing) throw Errors.DUPLICATE('部门名称')

        const id = uuid()
        // 如果未提供 hqId，尝试查找默认总部或创建一个（原始路由中的逻辑）
        let hqId = data.hqId
        if (!hqId) {
            const defaultHq = await this.db.query.headquarters.findFirst()
            if (defaultHq) {
                hqId = defaultHq.id
            } else {
                // 如果不存在，创建默认总部
                const newHqId = uuid()
                await this.db.insert(headquarters).values({ id: newHqId, name: 'Default HQ', active: 1 }).execute()
                hqId = newHqId
            }
        }

        await this.db.insert(departments).values({
            id,
            name: data.name,
            hqId,
            code: data.code,
            active: 1,
            createdAt: Date.now(),
            updatedAt: Date.now()
        }).execute()

        return { id, hqId, name: data.name }
    }

    async updateDepartment(id: string, data: { name?: string; hqId?: string; active?: number }) {
        if (data.name) {
            const existing = await this.db.query.departments.findFirst({
                where: and(eq(departments.name, data.name), ne(departments.id, id))
            })
            if (existing) throw Errors.DUPLICATE('部门名称')
        }

        const dept = await this.db.query.departments.findFirst({ where: eq(departments.id, id) })
        if (!dept) throw Errors.NOT_FOUND('部门')

        const updates: any = { updatedAt: Date.now() }
        if (data.name !== undefined) updates.name = data.name
        if (data.hqId !== undefined) updates.hqId = data.hqId
        if (data.active !== undefined) updates.active = data.active

        await this.db.update(departments).set(updates).where(eq(departments.id, id)).execute()
        return { ok: true }
    }

    async deleteDepartment(id: string) {
        const dept = await this.db.query.departments.findFirst({ where: eq(departments.id, id) })
        if (!dept) throw Errors.NOT_FOUND('部门')

        // 检查依赖关系
        const siteCount = await this.db.$count(sites, eq(sites.departmentId, id))
        if (siteCount > 0) throw Errors.BUSINESS_ERROR('无法删除，该项目下还有站点')

        // 检查员工（如果存在循环依赖问题，需要导入 employees 表或使用原始查询，但在这里我们可以直接导入）
        // 使用原始查询以避免导入不需要的内容，或者直接导入 schema.employees
        const employeeCount = await this.db.$count(schema.employees, eq(schema.employees.departmentId, id))
        if (employeeCount > 0) throw Errors.BUSINESS_ERROR('无法删除，该项目下还有员工')

        const orgDeptCount = await this.db.$count(schema.orgDepartments, eq(schema.orgDepartments.projectId, id))
        if (orgDeptCount > 0) throw Errors.BUSINESS_ERROR('无法删除，该项目下还有组织部门')

        await this.db.delete(departments).where(eq(departments.id, id)).execute()
        return { ok: true, name: dept.name }
    }

    // ========== Sites ==========

    async getSites() {
        const [sitesList, departmentsList] = await Promise.all([
            this.db.select().from(sites).orderBy(sites.name).all(),
            this.db.select().from(departments).all()
        ])

        const deptMap = new Map(departmentsList.map(d => [d.id, d.name]))

        return sitesList.map(site => ({
            id: site.id,
            departmentId: site.departmentId,
            name: site.name,
            siteCode: site.siteCode,
            active: site.active,
            createdAt: site.createdAt,
            updatedAt: site.updatedAt,
            departmentName: deptMap.get(site.departmentId) || null
        }))
    }

    async createSite(data: { name: string; departmentId: string }) {
        const existing = await this.db.query.sites.findFirst({
            where: and(
                eq(sites.departmentId, data.departmentId),
                eq(sites.name, data.name),
                eq(sites.active, 1)
            )
        })
        if (existing) throw Errors.DUPLICATE('站点名称')

        const id = uuid()
        await this.db.insert(sites).values({
            id,
            departmentId: data.departmentId,
            name: data.name,
            active: 1,
            createdAt: Date.now(),
            updatedAt: Date.now()
        }).execute()

        return { id, ...data }
    }

    async updateSite(id: string, data: { name?: string; departmentId?: string; active?: number }) {
        const site = await this.db.query.sites.findFirst({ where: eq(sites.id, id) })
        if (!site) throw Errors.NOT_FOUND('站点')

        const updates: any = { updatedAt: Date.now() }
        if (data.name !== undefined) updates.name = data.name
        if (data.departmentId !== undefined) updates.departmentId = data.departmentId
        if (data.active !== undefined) updates.active = data.active

        await this.db.update(sites).set(updates).where(eq(sites.id, id)).execute()
        return { ok: true }
    }

    async deleteSite(id: string) {
        const site = await this.db.query.sites.findFirst({ where: eq(sites.id, id) })
        if (!site) throw Errors.NOT_FOUND('站点')

        await this.db.delete(sites).where(eq(sites.id, id)).execute()
        return { ok: true, name: site.name }
    }

    // ========== Accounts ==========

    async getAccounts(search?: string) {
        let query = this.db.select({
            id: accounts.id,
            name: accounts.name,
            type: accounts.type,
            currency: accounts.currency,
            alias: accounts.alias,
            accountNumber: accounts.accountNumber,
            openingCents: accounts.openingCents,
            active: accounts.active,
            currencyName: currencies.name
        })
            .from(accounts)
            .leftJoin(currencies, eq(currencies.code, accounts.currency))
            .orderBy(accounts.name)

        if (search) {
            const likeStr = `%${search.toLowerCase()}%`
            query.where(or(
                like(sql`lower(${accounts.name})`, likeStr),
                like(sql`lower(ifnull(${accounts.alias},''))`, likeStr),
                like(sql`lower(ifnull(${accounts.accountNumber},''))`, likeStr)
            ))
        }

        return query.all()
    }

    async getAccountTransactions(accountId: string, limit: number = 100, offset: number = 0) {
        return this.db.select({
            id: accountTransactions.id,
            transactionDate: accountTransactions.transactionDate,
            transactionType: accountTransactions.transactionType,
            amountCents: accountTransactions.amountCents,
            balanceBeforeCents: accountTransactions.balanceBeforeCents,
            balanceAfterCents: accountTransactions.balanceAfterCents,
            createdAt: accountTransactions.createdAt,
            voucherNo: cashFlows.voucherNo,
            memo: cashFlows.memo,
            counterparty: cashFlows.counterparty,
            voucherUrl: cashFlows.voucherUrl,
            categoryName: categories.name
        })
            .from(accountTransactions)
            .leftJoin(cashFlows, eq(cashFlows.id, accountTransactions.flowId))
            .leftJoin(categories, eq(categories.id, cashFlows.categoryId))
            .where(eq(accountTransactions.accountId, accountId))
            .orderBy(desc(accountTransactions.transactionDate), desc(accountTransactions.createdAt))
            .limit(limit)
            .offset(offset)
            .all()
    }

    async createAccount(data: { name: string; type: string; currency?: string; alias?: string; accountNumber?: string; openingCents?: number }) {
        const currencyCode = (data.currency ?? 'CNY').trim().toUpperCase()
        const cur = await this.db.query.currencies.findFirst({
            where: and(eq(currencies.code, currencyCode), eq(currencies.active, 1))
        })
        if (!cur) throw Errors.NOT_FOUND(`币种 ${currencyCode}`)

        const id = uuid()
        await this.db.insert(accounts).values({
            id,
            name: data.name,
            type: data.type,
            currency: currencyCode,
            alias: data.alias,
            accountNumber: data.accountNumber,
            openingCents: data.openingCents ?? 0,
            active: 1
        }).execute()

        return { id, ...data, currency: currencyCode }
    }

    async updateAccount(id: string, data: { name?: string; type?: string; currency?: string; alias?: string; accountNumber?: string; active?: number }) {
        const updates: any = {}
        if (data.name !== undefined) updates.name = data.name
        if (data.type !== undefined) updates.type = data.type
        if (data.currency !== undefined) {
            const code = data.currency.trim().toUpperCase()
            const cur = await this.db.query.currencies.findFirst({
                where: and(eq(currencies.code, code), eq(currencies.active, 1))
            })
            if (!cur) throw Errors.NOT_FOUND(`币种 ${code}`)
            updates.currency = code
        }
        if (data.alias !== undefined) updates.alias = data.alias
        if (data.accountNumber !== undefined) updates.accountNumber = data.accountNumber
        if (data.active !== undefined) updates.active = data.active

        if (Object.keys(updates).length === 0) throw Errors.VALIDATION_ERROR('没有需要更新的字段')

        await this.db.update(accounts).set(updates).where(eq(accounts.id, id)).execute()
        return { ok: true }
    }

    async deleteAccount(id: string) {
        const account = await this.db.query.accounts.findFirst({ where: eq(accounts.id, id) })
        if (!account) throw Errors.NOT_FOUND('账户')

        const flowCount = await this.db.$count(cashFlows, eq(cashFlows.accountId, id))
        if (flowCount > 0) throw Errors.BUSINESS_ERROR('无法删除，该账户还有流水记录')

        await this.db.delete(accounts).where(eq(accounts.id, id)).execute()
        return { ok: true, name: account.name }
    }

    // ========== Vendors ==========

    async getVendors() {
        return this.db.select().from(vendors).where(eq(vendors.active, 1)).orderBy(vendors.name).all()
    }

    async getVendor(id: string) {
        const vendor = await this.db.query.vendors.findFirst({ where: eq(vendors.id, id) })
        if (!vendor) throw Errors.NOT_FOUND('供应商不存在')
        return vendor
    }

    async createVendor(data: { name: string; contact?: string; phone?: string; email?: string; address?: string; memo?: string }) {
        const id = uuid()
        const now = Date.now()
        const vendor = {
            id,
            name: data.name,
            contact: data.contact,
            phone: data.phone,
            email: data.email,
            address: data.address,
            memo: data.memo,
            active: 1,
            createdAt: now,
            updatedAt: now
        }
        await this.db.insert(vendors).values(vendor).execute()
        return vendor
    }

    async updateVendor(id: string, data: { name?: string; contact?: string; phone?: string; email?: string; address?: string; memo?: string; active?: number }) {
        const updates: any = { updatedAt: Date.now() }
        if (data.name !== undefined) updates.name = data.name
        if (data.contact !== undefined) updates.contact = data.contact
        if (data.phone !== undefined) updates.phone = data.phone
        if (data.email !== undefined) updates.email = data.email
        if (data.address !== undefined) updates.address = data.address
        if (data.memo !== undefined) updates.memo = data.memo
        if (data.active !== undefined) updates.active = data.active

        if (Object.keys(updates).length === 1) return { ok: true } // 仅更新了 updatedAt

        await this.db.update(vendors).set(updates).where(eq(vendors.id, id)).execute()
        return { ok: true }
    }

    async deleteVendor(id: string) {
        const vendor = await this.db.query.vendors.findFirst({ where: eq(vendors.id, id) })
        await this.db.update(vendors).set({
            active: 0,
            updatedAt: Date.now()
        }).where(eq(vendors.id, id)).execute()
        return { ok: true, name: vendor?.name }
    }

    // ========== Headquarters ==========

    async getHeadquarters() {
        return this.db.select().from(headquarters).all()
    }

    async updateHeadquarters(id: string, data: { name?: string; active?: number }) {
        const hq = await this.db.query.headquarters.findFirst({ where: eq(headquarters.id, id) })
        if (!hq) throw Errors.NOT_FOUND('总部')

        const updates: any = {}
        if (data.name !== undefined) updates.name = data.name
        if (data.active !== undefined) updates.active = data.active

        if (Object.keys(updates).length === 0) return { ok: true }

        await this.db.update(headquarters).set(updates).where(eq(headquarters.id, id)).execute()
        return { ok: true }
    }

    async deleteHeadquarters(id: string) {
        const hq = await this.db.query.headquarters.findFirst({ where: eq(headquarters.id, id) })
        if (!hq) throw Errors.NOT_FOUND('总部')

        await this.db.update(headquarters).set({ active: 0 }).where(eq(headquarters.id, id)).execute()
        return { ok: true, name: hq.name }
    }

    // ========== Currencies ==========

    async getCurrencies(search?: string) {
        let query = this.db.select().from(currencies).orderBy(currencies.code)
        if (search) {
            const likeStr = `%${search.toUpperCase()}%`
            query.where(or(
                like(sql`upper(${currencies.code})`, likeStr),
                like(sql`upper(${currencies.name})`, likeStr)
            ))
        }
        return query.all()
    }

    async createCurrency(data: { code: string; name: string }) {
        const code = data.code.toUpperCase()
        const existing = await this.db.query.currencies.findFirst({ where: eq(currencies.code, code) })
        if (existing) throw Errors.DUPLICATE('币种代码')

        await this.db.insert(currencies).values({
            code,
            name: data.name,
            active: 1
        }).execute()

        return { code, name: data.name }
    }

    async updateCurrency(code: string, data: { name?: string; active?: number }) {
        const codeUpper = code.toUpperCase()
        const updates: any = {}
        if (data.name !== undefined) updates.name = data.name
        if (data.active !== undefined) updates.active = data.active

        if (Object.keys(updates).length === 0) return { ok: true }

        await this.db.update(currencies).set(updates).where(eq(currencies.code, codeUpper)).execute()
        return { ok: true }
    }

    async deleteCurrency(code: string) {
        const codeUpper = code.toUpperCase()
        const currency = await this.db.query.currencies.findFirst({ where: eq(currencies.code, codeUpper) })
        if (!currency) throw Errors.NOT_FOUND('币种')

        const accountCount = await this.db.$count(accounts, eq(accounts.currency, codeUpper))
        if (accountCount > 0) throw Errors.BUSINESS_ERROR('无法删除，该币种还有账户使用')

        await this.db.delete(currencies).where(eq(currencies.code, codeUpper)).execute()
        return { ok: true, name: currency.name }
    }

    // ========== Categories ==========

    async getCategories() {
        return this.db.select().from(categories).orderBy(categories.kind, categories.name).all()
    }

    async createCategory(data: { name: string; kind: string; parentId?: string }) {
        const existing = await this.db.query.categories.findFirst({ where: eq(categories.name, data.name) })
        if (existing) throw Errors.DUPLICATE('类别名称')

        const id = uuid()
        await this.db.insert(categories).values({
            id,
            name: data.name,
            kind: data.kind as any,
            parentId: data.parentId,
            active: 1
        }).execute()

        return { id, ...data }
    }

    async updateCategory(id: string, data: { name?: string; kind?: string }) {
        if (data.name) {
            const existing = await this.db.query.categories.findFirst({
                where: and(eq(categories.name, data.name), ne(categories.id, id))
            })
            if (existing) throw Errors.DUPLICATE('类别名称')
        }

        const updates: any = {}
        if (data.name !== undefined) updates.name = data.name
        if (data.kind !== undefined) updates.kind = data.kind

        if (Object.keys(updates).length === 0) return { ok: true }

        await this.db.update(categories).set(updates).where(eq(categories.id, id)).execute()
        return { ok: true }
    }

    async deleteCategory(id: string) {
        const category = await this.db.query.categories.findFirst({ where: eq(categories.id, id) })
        if (!category) throw Errors.NOT_FOUND('类别')

        const flowCount = await this.db.$count(cashFlows, eq(cashFlows.categoryId, id))
        if (flowCount > 0) throw Errors.BUSINESS_ERROR('无法删除，该类别还有流水记录')

        await this.db.delete(categories).where(eq(categories.id, id)).execute()
        return { ok: true, name: category.name }
    }

    // ========== Positions ==========

    async getPositions() {
        return this.db.select().from(schema.positions).where(eq(schema.positions.active, 1)).orderBy(schema.positions.sortOrder, schema.positions.name).all()
    }

    async getAvailablePositions(orgDepartmentId: string) {
        // 1. 获取组织部门信息
        const dept = await this.db.select({
            id: schema.orgDepartments.id,
            projectId: schema.orgDepartments.projectId,
            name: schema.orgDepartments.name,
            code: schema.orgDepartments.code,
            allowedPositions: schema.orgDepartments.allowedPositions,
            projectName: departments.name
        })
            .from(schema.orgDepartments)
            .leftJoin(departments, eq(departments.id, schema.orgDepartments.projectId))
            .where(and(eq(schema.orgDepartments.id, orgDepartmentId), eq(schema.orgDepartments.active, 1)))
            .get()

        if (!dept) throw Errors.NOT_FOUND('部门')

        const isHQ = dept.projectId === null
        const projectIdValue = isHQ ? 'hq' : dept.projectId
        const projectName = isHQ ? '总部' : dept.projectName

        // 2. 按级别筛选职位
        let levelCondition
        if (isHQ) {
            levelCondition = eq(schema.positions.level, 1)
        } else {
            levelCondition = or(eq(schema.positions.level, 2), eq(schema.positions.level, 3))
        }

        let positionsList = await this.db.select().from(schema.positions)
            .where(and(eq(schema.positions.active, 1), levelCondition))
            .orderBy(schema.positions.level, schema.positions.sortOrder, schema.positions.name)
            .all()

        // 3. 如果配置了 allowed_positions，则按其筛选
        if (dept.allowedPositions) {
            try {
                const allowedIds = JSON.parse(dept.allowedPositions) as string[]
                if (Array.isArray(allowedIds) && allowedIds.length > 0) {
                    positionsList = positionsList.filter(p => allowedIds.includes(p.id))
                }
            } catch {
                // 忽略解析错误
            }
        }

        // 4. 按级别分组
        const LEVEL_LABELS: Record<number, string> = {
            1: '总部职位',
            2: '项目职位',
            3: '组级职位'
        }
        const groupedPositions: Record<string, typeof positionsList> = {}
        for (const pos of positionsList) {
            const groupKey = LEVEL_LABELS[pos.level] || `其他(level=${pos.level})`
            if (!groupedPositions[groupKey]) {
                groupedPositions[groupKey] = []
            }
            groupedPositions[groupKey].push(pos)
        }

        return {
            results: positionsList,
            grouped: groupedPositions,
            department_info: {
                project_id: projectIdValue,
                project_name: projectName,
                department_id: orgDepartmentId,
                department_name: dept.name,
                is_hq: isHQ
            }
        }
    }

    // ========== Org Departments ==========

    async getOrgDepartments(projectId?: string) {
        const chunks = [
            sql`select od.id, od.project_id, od.parent_id, od.name, od.code, od.description, 
                   od.allowed_modules, od.allowed_positions, od.default_position_id,
                   od.active, od.sort_order, od.created_at, od.updated_at,
                   p.name as default_position_name,
                   parent.name as parent_name,
                   d.name as project_name
            from org_departments od
            left join positions p on p.id = od.default_position_id
            left join org_departments parent on parent.id = od.parent_id
            left join departments d on d.id = od.project_id
            where od.active = 1`
        ]

        if (projectId) {
            if (projectId === 'hq') {
                chunks.push(sql`and od.project_id is null`)
            } else {
                chunks.push(sql`and od.project_id = ${projectId}`)
            }
        }

        chunks.push(sql`order by od.project_id is null desc, od.sort_order asc, od.name asc`)

        const finalSql = sql.join(chunks, sql` `)

        // Drizzle run 返回 D1Result，其中包含 results 属性
        const { results } = await this.db.run(finalSql)

        return (results || []).map((row: any) => ({
            id: row.id,
            projectId: row.project_id,
            parentId: row.parent_id,
            name: row.name,
            code: row.code,
            description: row.description,
            allowedModules: row.allowed_modules ? JSON.parse(row.allowed_modules) : ['*'],
            allowedPositions: row.allowed_positions ? JSON.parse(row.allowed_positions) : null,
            defaultPositionId: row.default_position_id,
            active: row.active,
            sortOrder: row.sort_order,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            defaultPositionName: row.default_position_name,
            parentName: row.parent_name,
            projectName: row.project_name
        }))
    }

    async getOrgDepartment(id: string) {
        const query = sql`
            select od.id, od.project_id, od.parent_id, od.name, od.code, od.description, 
                   od.allowed_modules, od.allowed_positions, od.default_position_id,
                   od.active, od.sort_order, od.created_at, od.updated_at,
                   p.name as default_position_name
            from org_departments od
            left join positions p on p.id = od.default_position_id
            where od.id = ${id}
        `

        const { results } = await this.db.run(query)
        const row: any = results?.[0]

        if (!row) throw Errors.NOT_FOUND('部门不存在')

        return {
            id: row.id,
            projectId: row.project_id,
            parentId: row.parent_id,
            name: row.name,
            code: row.code,
            description: row.description,
            allowedModules: row.allowed_modules ? JSON.parse(row.allowed_modules) : ['*'],
            allowedPositions: row.allowed_positions ? JSON.parse(row.allowed_positions) : null,
            defaultPositionId: row.default_position_id,
            active: row.active,
            sortOrder: row.sort_order,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            defaultPositionName: row.default_position_name
        }
    }
}
