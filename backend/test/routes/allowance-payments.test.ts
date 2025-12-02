import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { allowancePaymentsRoutes } from '../../src/routes/allowance-payments.js'
import { Errors } from '../../src/utils/errors.js'
import { v4 as uuid } from 'uuid'

// Mock audit utils
vi.mock('../../src/utils/audit.js', () => ({
    logAuditAction: vi.fn(),
}))

// Mock permissions
vi.mock('../../src/utils/permissions.js', () => ({
    hasPermission: vi.fn(() => true),
    getUserPosition: vi.fn(() => ({ id: 'pos1', name: 'Manager', level: 1 })),
    getUserId: vi.fn(() => 'user1'),
    isTeamMember: vi.fn(() => false),
}))

const mockEmployeeService = {
    listAllowancePayments: vi.fn(),
    createAllowancePayment: vi.fn(),
    updateAllowancePayment: vi.fn(),
    deleteAllowancePayment: vi.fn(),
    generateAllowancePayments: vi.fn(),
}

describe('Allowance Payments Routes', () => {
    let app: Hono<{ Variables: any }>
    const validId = uuid()
    const validEmpId = uuid()

    beforeEach(() => {
        app = new Hono()

        // Mock middleware
        app.use('*', async (c, next) => {
            c.set('userId', 'user123')
            c.set('services', {
                employee: mockEmployeeService
            } as any)
            await next()
        })

        app.onError((err, c) => {
            if (err instanceof Error && 'statusCode' in err) {
                return c.json({ error: err.message }, (err as any).statusCode)
            }
            return c.json({ error: err.message }, 500)
        })

        app.route('/', allowancePaymentsRoutes)
    })

    it('should list allowance payments', async () => {
        const mockResult = [{
            payment: { id: validId, employeeId: validEmpId, allowanceType: 'meal', currencyId: 'CNY', amountCents: 500, year: 2023, month: 1 },
            currencyName: 'RMB',
            employeeName: 'John'
        }]
        mockEmployeeService.listAllowancePayments.mockResolvedValue(mockResult)

        const res = await app.request(`/allowance-payments?year=2023&month=1`, {
            method: 'GET',
        })

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({
            results: [{
                id: validId,
                employee_id: validEmpId,
                allowance_type: 'meal',
                currency_id: 'CNY',
                amount_cents: 500,
                year: 2023,
                month: 1,
                currency_name: 'RMB',
                employee_name: 'John'
            }]
        })
    })

    it('should create allowance payment', async () => {
        const mockPayment = { id: validId, employeeId: validEmpId, allowanceType: 'meal', currencyId: 'CNY', amountCents: 500, year: 2023, month: 1 }
        const mockResult = {
            payment: mockPayment,
            currencyName: 'RMB',
            employeeName: 'John'
        }
        mockEmployeeService.createAllowancePayment.mockResolvedValue(mockResult)

        const res = await app.request('/allowance-payments', {
            method: 'POST',
            body: JSON.stringify({
                employee_id: validEmpId,
                year: 2023,
                month: 1,
                allowance_type: 'meal',
                currency_id: 'CNY',
                amount_cents: 500,
                payment_date: '2023-01-01'
            }),
            headers: { 'Content-Type': 'application/json' }
        })

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({
            id: validId,
            employee_id: validEmpId,
            allowance_type: 'meal',
            currency_id: 'CNY',
            amount_cents: 500,
            year: 2023,
            month: 1,
            currency_name: 'RMB',
            employee_name: 'John'
        })
    })

    it('should update allowance payment', async () => {
        const mockResult = {
            payment: { id: validId, employeeId: validEmpId, allowanceType: 'meal', currencyId: 'CNY', amountCents: 600, year: 2023, month: 1 },
            currencyName: 'RMB',
            employeeName: 'John'
        }
        mockEmployeeService.updateAllowancePayment.mockResolvedValue(mockResult)

        const res = await app.request(`/allowance-payments/${validId}`, {
            method: 'PUT',
            body: JSON.stringify({
                amount_cents: 600
            }),
            headers: { 'Content-Type': 'application/json' }
        })

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({
            id: validId,
            employee_id: validEmpId,
            allowance_type: 'meal',
            currency_id: 'CNY',
            amount_cents: 600,
            year: 2023,
            month: 1,
            currency_name: 'RMB',
            employee_name: 'John'
        })
    })

    it('should delete allowance payment', async () => {
        mockEmployeeService.deleteAllowancePayment.mockResolvedValue({ id: validId })

        const res = await app.request(`/allowance-payments/${validId}`, {
            method: 'DELETE',
        })

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ ok: true })
    })

    it('should generate allowance payments', async () => {
        const mockResult = { created: 1, ids: [validId] }
        mockEmployeeService.generateAllowancePayments.mockResolvedValue(mockResult)

        const res = await app.request('/allowance-payments/generate', {
            method: 'POST',
            body: JSON.stringify({
                year: 2023,
                month: 1,
                payment_date: '2023-01-01'
            }),
            headers: { 'Content-Type': 'application/json' }
        })

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual(mockResult)
    })
})
