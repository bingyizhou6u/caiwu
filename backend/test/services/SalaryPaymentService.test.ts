import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SalaryPaymentService } from '../../src/services/SalaryPaymentService'
import { createDb } from '../../src/db'
import { env } from 'cloudflare:test'
import { applySchema } from '../setup'
import { employees, employeeSalaries, currencies } from '../../src/db/schema'
import { v4 as uuid } from 'uuid'

describe('SalaryPaymentService', () => {
    let db: any
    let salaryPaymentService: SalaryPaymentService

    beforeEach(async () => {
        db = createDb(env.DB)
        // @ts-ignore
        db.transaction = async (cb) => cb(db)
        await applySchema(env.DB)
        salaryPaymentService = new SalaryPaymentService(db)

        // Setup test data
        // 1. Currency
        await db.insert(currencies).values({
            code: 'USDT',
            name: 'Tether',
            active: 1
        }).run()

        // 2. Employee
        await db.insert(employees).values({
            id: 'emp1',
            email: 'test@example.com',
            name: 'Test Employee',
            joinDate: '2023-01-01',
            status: 'regular',
            regularSalaryCents: 100000, // 1000.00
            active: 1
        }).run()

        // 3. Employee Salary (Multi-currency)
        await db.insert(employeeSalaries).values({
            id: uuid(),
            employeeId: 'emp1',
            salaryType: 'regular',
            currencyId: 'USDT',
            amountCents: 100000,
            createdAt: Date.now()
        }).run()
    })

    it('should generate salary payments', async () => {
        const result = await salaryPaymentService.generate(2023, 10, 'admin')
        expect(result.created).toBe(1)
        expect(result.ids.length).toBe(1)

        const payment = await salaryPaymentService.get(result.ids[0])
        expect(payment).toBeDefined()
        expect(payment?.salaryCents).toBe(100000)
        expect(payment?.status).toBe('pending_employee_confirmation')
    })

    it('should handle employee confirmation and finance approval', async () => {
        const genResult = await salaryPaymentService.generate(2023, 10, 'admin')
        const id = genResult.ids[0]

        // Employee Confirm
        await salaryPaymentService.employeeConfirm(id, 'emp1')
        let payment = await salaryPaymentService.get(id)
        expect(payment?.status).toBe('pending_finance_approval')
        expect(payment?.employeeConfirmedBy).toBe('emp1')

        // Finance Approve
        await salaryPaymentService.financeApprove(id, 'finance1')
        payment = await salaryPaymentService.get(id)
        expect(payment?.status).toBe('pending_payment')
        expect(payment?.financeApprovedBy).toBe('finance1')
    })

    it('should handle currency allocation workflow', async () => {
        const genResult = await salaryPaymentService.generate(2023, 10, 'admin')
        const id = genResult.ids[0]

        // Employee Confirm first (needed for some logic, though service doesn't strictly enforce it for allocation request, but route does)
        // Service.requestAllocation doesn't check status strictly in my implementation, but let's follow flow

        // Request Allocation
        await salaryPaymentService.requestAllocation(id, [
            { currencyId: 'USDT', amountCents: 50000 }
        ], 'emp1')

        let payment = await salaryPaymentService.get(id)
        expect(payment?.allocationStatus).toBe('requested')
        expect(payment?.allocations.length).toBe(1)
        expect(payment?.allocations[0].amountCents).toBe(50000)
        expect(payment?.allocations[0].status).toBe('pending')

        // Approve Allocation
        await salaryPaymentService.approveAllocation(id, undefined, true, 'finance1')

        payment = await salaryPaymentService.get(id)
        expect(payment?.allocationStatus).toBe('approved')
        expect(payment?.allocations[0].status).toBe('approved')
    })
})
