import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { salaryPaymentsRoutes } from '../../src/routes/salary-payments.js'
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

const mockSalaryPaymentService = {
    generate: vi.fn(),
    list: vi.fn(),
    get: vi.fn(),
    employeeConfirm: vi.fn(),
    financeApprove: vi.fn(),
    paymentTransfer: vi.fn(),
    paymentConfirm: vi.fn(),
    requestAllocation: vi.fn(),
    approveAllocation: vi.fn(),
    rejectAllocation: vi.fn(),
    delete: vi.fn(),
}

describe('Salary Payments Routes', () => {
    let app: Hono<{ Variables: any }>
    const validId = uuid()
    const validEmpId = uuid()

    beforeEach(() => {
        app = new Hono()

        // Mock middleware
        app.use('*', async (c, next) => {
            c.set('userId', 'user123')
            c.set('services', {
                salaryPayment: mockSalaryPaymentService
            } as any)
            await next()
        })

        app.onError((err, c) => {
            if (err instanceof Error && 'statusCode' in err) {
                return c.json({ error: err.message }, (err as any).statusCode)
            }
            return c.json({ error: err.message }, 500)
        })

        app.route('/', salaryPaymentsRoutes)
    })

    it('should list salary payments', async () => {
        const mockResult = [{ id: validId, employeeId: validEmpId, year: 2023, month: 1, salaryCents: 10000 }]
        mockSalaryPaymentService.list.mockResolvedValue(mockResult)

        const res = await app.request('/salary-payments?year=2023&month=1', {
            method: 'GET',
        })

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual(mockResult)
    })

    it('should generate salary payments', async () => {
        const mockResult = { created: 1, ids: [validId] }
        mockSalaryPaymentService.generate.mockResolvedValue(mockResult)

        const res = await app.request('/salary-payments/generate', {
            method: 'POST',
            body: JSON.stringify({
                year: 2023,
                month: 1
            }),
            headers: { 'Content-Type': 'application/json' }
        })

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual(mockResult)
    })

    it('should get salary payment', async () => {
        const mockResult = { id: validId, employeeId: validEmpId, year: 2023, month: 1, salaryCents: 10000 }
        mockSalaryPaymentService.get.mockResolvedValue(mockResult)

        const res = await app.request(`/salary-payments/${validId}`, {
            method: 'GET',
        })

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual(mockResult)
    })

    it('should employee confirm', async () => {
        const mockResult = { id: validId, status: 'pending_finance_approval' }
        mockSalaryPaymentService.employeeConfirm.mockResolvedValue(mockResult)

        const res = await app.request(`/salary-payments/${validId}/employee-confirm`, {
            method: 'POST',
            body: JSON.stringify({ action: 'confirm' }), // Schema might require body, even if ignored
            headers: { 'Content-Type': 'application/json' }
        })

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual(mockResult)
    })

    it('should finance approve', async () => {
        const mockResult = { id: validId, status: 'pending_payment' }
        mockSalaryPaymentService.financeApprove.mockResolvedValue(mockResult)

        const res = await app.request(`/salary-payments/${validId}/finance-approve`, {
            method: 'POST',
            body: JSON.stringify({ action: 'approve' }),
            headers: { 'Content-Type': 'application/json' }
        })

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual(mockResult)
    })

    it('should payment transfer', async () => {
        const mockResult = { id: validId, status: 'pending_payment_confirmation' }
        mockSalaryPaymentService.paymentTransfer.mockResolvedValue(mockResult)

        const res = await app.request(`/salary-payments/${validId}/payment-transfer`, {
            method: 'POST',
            body: JSON.stringify({ accountId: uuid() }),
            headers: { 'Content-Type': 'application/json' }
        })

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual(mockResult)
    })

    it('should payment confirm', async () => {
        const mockResult = { id: validId, status: 'completed' }
        mockSalaryPaymentService.paymentConfirm.mockResolvedValue(mockResult)

        const res = await app.request(`/salary-payments/${validId}/payment-confirm`, {
            method: 'POST',
            body: JSON.stringify({ payment_voucher_path: 'https://example.com/voucher.jpg' }),
            headers: { 'Content-Type': 'application/json' }
        })

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual(mockResult)
    })

    it('should request allocation', async () => {
        const mockResult = { id: validId, allocationStatus: 'requested' }
        mockSalaryPaymentService.requestAllocation.mockResolvedValue(mockResult)

        const res = await app.request(`/salary-payments/${validId}/allocations`, {
            method: 'POST',
            body: JSON.stringify({
                allocations: [{ currencyId: 'CNY', amountCents: 5000 }]
            }),
            headers: { 'Content-Type': 'application/json' }
        })

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual(mockResult)
    })

    it('should approve allocation', async () => {
        const mockResult = { id: validId, allocationStatus: 'approved' }
        mockSalaryPaymentService.approveAllocation.mockResolvedValue(mockResult)

        const res = await app.request(`/salary-payments/${validId}/allocations/approve`, {
            method: 'POST',
            body: JSON.stringify({ approve_all: true }),
            headers: { 'Content-Type': 'application/json' }
        })

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual(mockResult)
    })

    it('should reject allocation', async () => {
        const mockResult = { id: validId, allocationStatus: 'rejected' }
        mockSalaryPaymentService.rejectAllocation.mockResolvedValue(mockResult)

        const res = await app.request(`/salary-payments/${validId}/allocations/reject`, {
            method: 'POST',
            body: JSON.stringify({ allocation_ids: [uuid()] }),
            headers: { 'Content-Type': 'application/json' }
        })

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual(mockResult)
    })

    it('should delete salary payment', async () => {
        mockSalaryPaymentService.delete.mockResolvedValue(undefined)

        const res = await app.request(`/salary-payments/${validId}`, {
            method: 'DELETE',
        })

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ ok: true })
    })
})
