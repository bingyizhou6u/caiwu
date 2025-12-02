import { env } from 'cloudflare:test'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createDb } from '../../src/db/index.js'
import { ReportService } from '../../src/services/ReportService.js'
import { applySchema } from '../setup.js'
import {
    cashFlows, accounts, categories, departments, sites,
    arApDocs, borrowings, repayments, employees, users, employeeLeaves
} from '../../src/db/schema.js'
import { uuid } from '../../src/utils/db.js'

describe('ReportService', () => {
    const db = createDb(env.DB)
    const service = new ReportService(db)

    beforeEach(async () => {
        await applySchema(env.DB)
        // Mock transaction if needed, but here we mostly read.
        // However, we need to seed data.
        // Since we don't have a seeder, we insert manually.
    })

    it('getDashboardStats should return correct stats', async () => {
        const today = new Date().toISOString().slice(0, 10)
        const deptId = uuid()
        await db.insert(departments).values({ id: deptId, name: 'Test Dept', active: 1 }).run()

        await db.insert(cashFlows).values([
            { id: uuid(), bizDate: today, type: 'income', amountCents: 1000, departmentId: deptId, accountId: uuid() },
            { id: uuid(), bizDate: today, type: 'expense', amountCents: 500, departmentId: deptId, accountId: uuid() }
        ]).run()

        const stats = await service.getDashboardStats(deptId)
        expect(stats.today.income_cents).toBe(1000)
        expect(stats.today.expense_cents).toBe(500)
        expect(stats.today.count).toBe(2)
    })

    it('getDepartmentCashFlow should return correct flow', async () => {
        const deptId = uuid()
        await db.insert(departments).values({ id: deptId, name: 'Test Dept', active: 1 }).run()

        const today = new Date().toISOString().slice(0, 10)
        await db.insert(cashFlows).values([
            { id: uuid(), bizDate: today, type: 'income', amountCents: 2000, departmentId: deptId, accountId: uuid() }
        ]).run()

        const res = await service.getDepartmentCashFlow(today, today, [deptId])
        expect(res).toHaveLength(1)
        expect(res[0].income_cents).toBe(2000)
        expect(res[0].net_cents).toBe(2000)
    })

    it('getArApSummary should return correct summary', async () => {
        const deptId = uuid()
        const today = new Date().toISOString().slice(0, 10)

        await db.insert(arApDocs).values([
            { id: uuid(), kind: 'AR', amountCents: 1000, status: 'open', issueDate: today, departmentId: deptId, partyId: uuid() },
            { id: uuid(), kind: 'AR', amountCents: 500, status: 'closed', issueDate: today, departmentId: deptId, partyId: uuid() }
        ]).run()

        const res = await service.getArApSummary('AR', today, today, deptId)
        expect(res.total_cents).toBe(1500)
        expect(res.by_status['open']).toBe(1000)
        expect(res.by_status['closed']).toBe(500)
    })

    it('getExpenseSummary should return correct summary', async () => {
        const catId = uuid()
        await db.insert(categories).values({ id: catId, name: 'Test Cat', kind: 'expense' }).run()

        const today = new Date().toISOString().slice(0, 10)
        await db.insert(cashFlows).values([
            { id: uuid(), bizDate: today, type: 'expense', amountCents: 300, categoryId: catId, accountId: uuid() }
        ]).run()

        const res = await service.getExpenseSummary(today, today)
        expect(res.rows).toHaveLength(1)
        expect(res.rows[0].total_cents).toBe(300)
    })

    it('getAccountBalance should return correct balance', async () => {
        const accId = uuid()
        await db.insert(accounts).values({ id: accId, name: 'Test Acc', type: 'cash', currency: 'CNY', active: 1 }).run()

        const today = new Date().toISOString().slice(0, 10)
        await db.insert(cashFlows).values([
            { id: uuid(), bizDate: today, type: 'income', amountCents: 1000, accountId: accId }
        ]).run()

        const res = await service.getAccountBalance(today)
        expect(res.rows).toHaveLength(1)
        expect(res.rows[0].closing_cents).toBe(1000)
    })

    it('getBorrowingSummary should return correct summary', async () => {
        const userId = uuid()
        const email = 'test@example.com'
        await db.insert(users).values({ id: userId, email }).run()
        await db.insert(employees).values({ id: uuid(), email, name: 'Test User', status: 'regular' }).run()

        await db.insert(borrowings).values([
            { id: uuid(), userId, amountCents: 1000, currency: 'CNY', borrowDate: '2023-01-01', createdAt: Date.now(), accountId: uuid() }
        ]).run()

        const res = await service.getBorrowingSummary(undefined, undefined, userId)
        expect(res.rows).toHaveLength(1)
        expect(res.rows[0].borrowed_cents).toBe(1000)
        expect(res.rows[0].balance_cents).toBe(1000)
    })

    // Add more tests for other methods as needed
})
