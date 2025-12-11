import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { employeesRoutes } from '../../src/routes/employees.js'
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
    getAll: vi.fn(),
    migrateFromUser: vi.fn(),
    update: vi.fn(),
}

describe('Employees Routes', () => {
    let app: Hono<{ Variables: any }>
    const validId = uuid()

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

        app.route('/', employeesRoutes)
    })

    it('should list employees', async () => {
        const mockResult = [{ id: validId, name: 'John Doe' }]
        mockEmployeeService.getAll.mockResolvedValue(mockResult)

        const res = await app.request('/employees', {
            method: 'GET',
        })

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ results: mockResult })
    })

    it('should migrate user to employee', async () => {
        const mockResult = { id: validId }
        mockEmployeeService.migrateFromUser.mockResolvedValue(mockResult)

        const res = await app.request('/employees/create-from-user', {
            method: 'POST',
            body: JSON.stringify({
                user_id: uuid(),
                orgDepartmentId: uuid(),
                positionId: uuid(),
                join_date: '2023-01-01',
                probation_salary_cents: 500000,
                regular_salary_cents: 600000
            }),
            headers: { 'Content-Type': 'application/json' }
        })

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual(mockResult)
    })

    it('should update employee', async () => {
        const mockResult = { id: validId }
        mockEmployeeService.update.mockResolvedValue(mockResult)

        const res = await app.request(`/employees/${validId}`, {
            method: 'PUT',
            body: JSON.stringify({
                name: 'John Doe Updated'
            }),
            headers: { 'Content-Type': 'application/json' }
        })

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual(mockResult)
    })
})
