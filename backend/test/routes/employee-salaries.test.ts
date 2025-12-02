import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { employeeSalariesRoutes } from '../../src/routes/employee-salaries.js'
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
    listSalaries: vi.fn(),
    createSalary: vi.fn(),
    updateSalary: vi.fn(),
    batchUpdateSalaries: vi.fn(),
    deleteSalary: vi.fn(),
}

describe('Employee Salaries Routes', () => {
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

        app.route('/', employeeSalariesRoutes)
    })

    it('should list salaries', async () => {
        const mockResult = [{
            salary: { id: validId, employeeId: validEmpId, salaryType: 'regular', currencyId: 'CNY', amountCents: 1000 },
            currencyName: 'RMB',
            employeeName: 'John'
        }]
        mockEmployeeService.listSalaries.mockResolvedValue(mockResult)

        const res = await app.request(`/employee-salaries?employee_id=${validEmpId}`, {
            method: 'GET',
        })

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({
            results: [{
                id: validId,
                employee_id: validEmpId,
                salary_type: 'regular',
                currency_id: 'CNY',
                amount_cents: 1000,
                currency_name: 'RMB',
                employee_name: 'John'
            }]
        })
    })

    it('should create salary', async () => {
        const mockSalary = { id: validId, employeeId: validEmpId, salaryType: 'regular', currencyId: 'CNY', amountCents: 1000 }
        const mockResult = {
            salary: mockSalary,
            currencyName: 'RMB',
            employeeName: 'John'
        }

        // Mock listSalaries to return empty (no duplicate)
        mockEmployeeService.listSalaries.mockResolvedValue([])
        mockEmployeeService.createSalary.mockResolvedValue(mockResult)

        const res = await app.request('/employee-salaries', {
            method: 'POST',
            body: JSON.stringify({
                employee_id: validEmpId,
                salary_type: 'regular',
                currency_id: 'CNY',
                amount_cents: 1000
            }),
            headers: { 'Content-Type': 'application/json' }
        })

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({
            id: validId,
            employee_id: validEmpId,
            salary_type: 'regular',
            currency_id: 'CNY',
            amount_cents: 1000,
            currency_name: 'RMB',
            employee_name: 'John'
        })
    })

    it('should batch update salaries', async () => {
        const mockResult = [{
            salary: { id: validId, employeeId: validEmpId, salaryType: 'regular', currencyId: 'CNY', amountCents: 2000 },
            currencyName: 'RMB',
            employeeName: 'John'
        }]
        mockEmployeeService.batchUpdateSalaries.mockResolvedValue(mockResult)

        const res = await app.request('/employee-salaries/batch', {
            method: 'PUT',
            body: JSON.stringify({
                employee_id: validEmpId,
                salary_type: 'regular',
                salaries: [{ currency_id: 'CNY', amount_cents: 2000 }]
            }),
            headers: { 'Content-Type': 'application/json' }
        })

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({
            results: [{
                id: validId,
                employee_id: validEmpId,
                salary_type: 'regular',
                currency_id: 'CNY',
                amount_cents: 2000,
                currency_name: 'RMB',
                employee_name: 'John'
            }]
        })
    })

    it('should delete salary', async () => {
        mockEmployeeService.deleteSalary.mockResolvedValue({ id: validId })

        const res = await app.request(`/employee-salaries/${validId}`, {
            method: 'DELETE',
        })

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ ok: true })
    })
})
