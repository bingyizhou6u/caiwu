
import { eq } from 'drizzle-orm'
import { describe, it, expect, beforeEach, beforeAll } from 'vitest'
import { env } from 'cloudflare:test'
import { SiteBillService } from '../../src/services/SiteBillService'
import { createDb } from '../../src/utils/db'
import { uuid } from '../../src/utils/db'
import { sites, employees, siteBills } from '../../src/db/schema'
import schemaSql from '../../src/db/schema.sql?raw'

async function applySchema(db: any) {
    const statements = schemaSql.split(';').filter(s => s.trim())
    for (const statement of statements) {
        try {
            await db.prepare(statement).run()
        } catch (e) {
            console.error('Failed to execute statement:', statement)
            throw e
        }
    }
}

describe('SiteBillService', () => {
    let service: SiteBillService
    let db: any
    let siteId: string
    let userId: string

    beforeAll(async () => {
        const rawDb = env.DB
        await applySchema(rawDb)
        db = createDb(rawDb)

        // Create base data
        userId = uuid()
        siteId = uuid()
        await db.insert(employees).values({
            id: userId,
            email: 'test_sitebill@example.com',
            name: 'Test SiteBill User',
            active: 1,
            createdAt: Date.now(),
            updatedAt: Date.now()
        }).execute()

        await db.insert(sites).values({
            id: siteId,
            siteCode: 'TEST-SB',
            name: 'Test Site SB',
            departmentId: 'dept-123',
            active: 1,
            createdAt: Date.now(),
            updatedAt: Date.now()
        }).execute()
    })

    beforeEach(() => {
        service = new SiteBillService(db)
    })

    describe('Site Bills', () => {
        it('should create a site bill', async () => {
            const result = await service.create({
                siteId,
                billDate: '2023-01-09',
                billType: 'expense',
                amountCents: 1500,
                currency: 'CNY',
                description: 'Test Site Bill',
                status: 'pending',
                createdBy: userId
            })

            expect(result.id).toBeDefined()

            const bills = await service.list(10, eq(siteBills.siteId, siteId))
            expect(bills.length).toBeGreaterThan(0)
            expect(bills[0].bill.amountCents).toBe(1500)
        })

        it('should update a site bill', async () => {
            const { id } = await service.create({
                siteId,
                billDate: '2023-01-10',
                billType: 'income',
                amountCents: 2000,
                currency: 'CNY',
                description: 'Test Site Bill Update',
                status: 'pending'
            })

            const result = await service.update(id, {
                status: 'paid',
                paymentDate: '2023-01-11'
            })

            expect(result.ok).toBe(true)

            const bills = await service.list(1, eq(siteBills.billType, 'income'))
            const updatedBill = bills.find(b => b.bill.id === id)
            expect(updatedBill?.bill.status).toBe('paid')
        })

        it('should delete a site bill', async () => {
            const { id } = await service.create({
                siteId,
                billDate: '2023-01-12',
                billType: 'expense',
                amountCents: 100,
                currency: 'CNY',
                description: 'Test Site Bill Delete',
                status: 'pending'
            })

            const result = await service.delete(id)
            expect(result.ok).toBe(true)

            const bills = await service.list(200)
            const deletedBill = bills.find(b => b.bill.id === id)
            expect(deletedBill).toBeUndefined()
        })
    })
})
