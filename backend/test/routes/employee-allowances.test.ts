import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { employeeAllowancesRoutes } from '../../src/routes/employee-allowances.js'
import { Errors } from '../../src/utils/errors.js'
import { v4 as uuid } from 'uuid'

// Mock audit utils
vi.mock('../../src/utils/audit.js', () => ({
    logAuditAction: vi.fn(),
}))

// Mock permissions
vi.mock('../../src/utils/permissions.js', () => ({
    hasPermission: vi.fn(() => true),
}))

const mockEmployeeService = {
    listAllowances: vi.fn(),
    createAllowance: vi.fn(),
    updateAllowance: vi.fn(),
    batchUpdateAllowances: vi.fn(),
    deleteAllowance: vi.fn(),
}

describe('Employee Allowances Routes', () => {
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

        app.route('/', employeeAllowancesRoutes)
    })

    it('should list allowances', async () => {
        const mockResult = [{
            allowance: { id: validId, employeeId: validEmpId, allowanceType: 'meal', currencyId: 'CNY', amountCents: 500 },
            currencyName: 'RMB',
            employeeName: 'John'
        }]
        mockEmployeeService.listAllowances.mockResolvedValue(mockResult)

        const res = await app.request(`/employee-allowances?employee_id=${validEmpId}`, {
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
                currency_name: 'RMB',
                employee_name: 'John'
            }]
        })
    })

    it('should create allowance', async () => {
        const mockAllowance = { id: validId, employeeId: validEmpId, allowanceType: 'meal', currencyId: 'CNY', amountCents: 500 }
        const mockResult = {
            allowance: mockAllowance,
            currencyName: 'RMB',
            employeeName: 'John'
        }

        // Mock listAllowances to return empty (no duplicate)
        mockEmployeeService.listAllowances.mockResolvedValue([])
        mockEmployeeService.createAllowance.mockResolvedValue(mockResult)

        const res = await app.request('/employee-allowances', {
            method: 'POST',
            body: JSON.stringify({
                employee_id: validEmpId,
                allowance_type: 'meal',
                currency_id: 'CNY',
                amount_cents: 500
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
            currency_name: 'RMB',
            employee_name: 'John'
        })
    })

    it('should batch update allowances', async () => {
        const mockResult = [{
            allowance: { id: validId, employeeId: validEmpId, allowanceType: 'meal', currencyId: 'CNY', amountCents: 600 },
            currencyName: 'RMB',
            employeeName: 'John'
        }]
        mockEmployeeService.batchUpdateAllowances.mockResolvedValue(mockResult)

        const res = await app.request('/employee-allowances/batch', {
            method: 'PUT',
            body: JSON.stringify({
                employee_id: validEmpId,
                allowance_type: 'meal',
                allowances: [{ currency_id: 'CNY', amount_cents: 600 }]
            }),
            headers: { 'Content-Type': 'application/json' }
        })

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({
            results: [{
                id: validId,
                employee_id: validEmpId,
                allowance_type: 'meal',
                currency_id: 'CNY',
                amount_cents: 600,
                currency_name: 'RMB',
                employee_name: 'John'
            }]
        })
    })

    it('should delete allowance', async () => {
        mockEmployeeService.deleteAllowance.mockResolvedValue({ id: validId })

        const res = await app.request(`/employee-allowances/${validId}`, {
            method: 'DELETE',
        })

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ ok: true })
    })
})
