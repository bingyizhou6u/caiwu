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

const mockAllowanceService = {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    batchUpdate: vi.fn(),
    delete: vi.fn(),
    get: vi.fn()
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
                allowance: mockAllowanceService
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

        // 默认 mock 返回，避免未设置时抛错
        mockAllowanceService.list.mockResolvedValue([])
        mockAllowanceService.create.mockResolvedValue({
            allowance: { id: validId, employeeId: validEmpId, allowanceType: 'meal', currencyId: 'CNY', amountCents: 0 },
            currencyName: 'RMB',
            employeeName: 'John'
        })
        mockAllowanceService.update.mockResolvedValue({
            allowance: { id: validId, employeeId: validEmpId, allowanceType: 'meal', currencyId: 'CNY', amountCents: 0 },
            currencyName: 'RMB',
            employeeName: 'John'
        })
        mockAllowanceService.batchUpdate.mockResolvedValue([])
        mockAllowanceService.delete.mockResolvedValue({ id: validId })
    })

    it('should list allowances', async () => {
        const mockResult = [{
            allowance: { id: validId, employeeId: validEmpId, allowanceType: 'meal', currencyId: 'CNY', amountCents: 500 },
            currencyName: 'RMB',
            employeeName: 'John'
        }]
        mockAllowanceService.list.mockResolvedValue(mockResult)

        const res = await app.request(`/employee-allowances?employeeId=${validEmpId}`, {
            method: 'GET',
        })

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({
            results: [{
                id: validId,
                employeeId: validEmpId,
                allowanceType: 'meal',
                currencyId: 'CNY',
                amountCents: 500,
                currencyName: 'RMB',
                employeeName: 'John'
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
        mockAllowanceService.list.mockResolvedValue([])
        mockAllowanceService.create.mockResolvedValue(mockResult)

        const res = await app.request('/employee-allowances', {
            method: 'POST',
            body: JSON.stringify({
                employeeId: validEmpId,
                allowanceType: 'meal',
                currencyId: 'CNY',
                amountCents: 500
            }),
            headers: { 'Content-Type': 'application/json' }
        })

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({
            id: validId,
            employeeId: validEmpId,
            allowanceType: 'meal',
            currencyId: 'CNY',
            amountCents: 500,
            currencyName: 'RMB',
            employeeName: 'John'
        })
    })

    it('should batch update allowances', async () => {
        const mockResult = [{
            allowance: { id: validId, employeeId: validEmpId, allowanceType: 'meal', currencyId: 'CNY', amountCents: 600 },
            currencyName: 'RMB',
            employeeName: 'John'
        }]
        mockAllowanceService.batchUpdate.mockResolvedValue(mockResult)

        const res = await app.request('/employee-allowances/batch', {
            method: 'PUT',
            body: JSON.stringify({
                employeeId: validEmpId,
                allowanceType: 'meal',
                allowances: [{ currencyId: 'CNY', amountCents: 600 }]
            }),
            headers: { 'Content-Type': 'application/json' }
        })

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({
            results: [{
                id: validId,
                employeeId: validEmpId,
                allowanceType: 'meal',
                currencyId: 'CNY',
                amountCents: 600,
                currencyName: 'RMB',
                employeeName: 'John'
            }]
        })
    })

    it('should delete allowance', async () => {
        mockAllowanceService.delete.mockResolvedValue({ id: validId })

        const res = await app.request(`/employee-allowances/${validId}`, {
            method: 'DELETE',
        })

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ ok: true })
    })
})
