import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { positionPermissionsRoutes } from '../../src/routes/position-permissions.js'
import { Errors } from '../../src/utils/errors.js'

// Mock audit utils
vi.mock('../../src/utils/audit.js', () => ({
    logAuditAction: vi.fn(),
}))

// Mock permissions
vi.mock('../../src/utils/permissions.js', () => ({
    hasPermission: vi.fn(() => true),
}))

const mockPositionService = {
    getPositions: vi.fn(),
    getPosition: vi.fn(),
    createPosition: vi.fn(),
    updatePosition: vi.fn(),
    deletePosition: vi.fn(),
}

describe('Position Permissions Routes', () => {
    let app: Hono

    beforeEach(() => {
        app = new Hono()

        // Mock middleware
        app.use('*', async (c, next) => {
            // @ts-ignore
            c.set('userId', 'user123')
            // @ts-ignore
            c.set('services', {
                position: mockPositionService
            } as any)
            await next()
        })

        app.onError((err, c) => {
            if (err instanceof Error && 'statusCode' in err) {
                return c.json({ error: err.message }, (err as any).statusCode)
            }
            return c.json({ error: err.message }, 500)
        })

        app.route('/', positionPermissionsRoutes)
    })

    it('should get all positions', async () => {
        const mockResult = [{ id: '1', name: 'Director' }]
        mockPositionService.getPositions.mockResolvedValue(mockResult)

        const res = await app.request('/position-permissions', {
            method: 'GET',
        })

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ results: mockResult })
    })

    it('should get position details', async () => {
        const mockResult = { id: '1', name: 'Director' }
        mockPositionService.getPosition.mockResolvedValue(mockResult)

        const res = await app.request('/position-permissions/1', {
            method: 'GET',
        })

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual(mockResult)
    })

    it('should create position', async () => {
        const mockResult = { id: '1', name: 'Director' }
        mockPositionService.createPosition.mockResolvedValue(mockResult)

        const res = await app.request('/position-permissions', {
            method: 'POST',
            body: JSON.stringify({
                code: 'DIR',
                name: 'Director',
                level: 1,
                function_role: 'director',
                permissions: {}
            }),
            headers: { 'Content-Type': 'application/json' }
        })

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual(mockResult)
    })

    it('should update position', async () => {
        const mockResult = { id: '1', name: 'Director Updated' }
        mockPositionService.updatePosition.mockResolvedValue(mockResult)

        const res = await app.request('/position-permissions/1', {
            method: 'PUT',
            body: JSON.stringify({ name: 'Director Updated' }),
            headers: { 'Content-Type': 'application/json' }
        })

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual(mockResult)
    })

    it('should delete position', async () => {
        mockPositionService.deletePosition.mockResolvedValue({ ok: true })

        const res = await app.request('/position-permissions/1', {
            method: 'DELETE',
        })

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ success: true })
    })
})
