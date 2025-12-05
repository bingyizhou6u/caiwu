import { describe, it, expect, vi, beforeEach } from 'vitest'
import { 
    getDataAccessFilter, 
    canViewEmployee, 
    hasPermission,
    Position,
    Employee
} from '../../src/utils/permissions'

// Mock Hono Context
const createMockContext = (position: Partial<Position>, employee: Partial<Employee>, departmentModules: string[] = ['*'], dbMock: any = null) => {
    return {
        get: (key: string) => {
            if (key === 'userPosition') return position
            if (key === 'userEmployee') return employee
            if (key === 'departmentModules') return departmentModules
            return undefined
        },
        env: {
            DB: dbMock || {
                prepare: vi.fn(() => ({
                    bind: vi.fn(() => ({
                        first: vi.fn(),
                        all: vi.fn(),
                        run: vi.fn()
                    }))
                }))
            }
        }
    } as any
}

describe('RBAC (Role-Based Access Control)', () => {
    
    describe('getDataAccessFilter', () => {
        it('Level 1 (HQ): should return global access', () => {
            const ctx = createMockContext({ level: 1 } as Position, { id: 'u1' } as Employee)
            const filter = getDataAccessFilter(ctx)
            expect(filter.where).toBe('1=1')
            expect(filter.binds).toEqual([])
        })

        it('Level 2 (Project): should filter by department_id', () => {
            const ctx = createMockContext(
                { level: 2 } as Position, 
                { id: 'u2', department_id: 'dept-a' } as Employee
            )
            const filter = getDataAccessFilter(ctx, 't')
            expect(filter.where).toBe('t.department_id = ?')
            expect(filter.binds).toEqual(['dept-a'])
        })

        it('Level 3 (Team Leader): should filter by org_department_id', () => {
            const ctx = createMockContext(
                { level: 3, code: 'team_leader' } as Position, 
                { id: 'u3', org_department_id: 'org-1' } as Employee
            )
            const filter = getDataAccessFilter(ctx, 't')
            expect(filter.where).toBe('t.org_department_id = ?')
            expect(filter.binds).toEqual(['org-1'])
        })

        it('Level 3 (Engineer): should filter by own id', () => {
            const ctx = createMockContext(
                { level: 3, code: 'team_engineer' } as Position, 
                { id: 'emp-1' } as Employee
            )
            const filter = getDataAccessFilter(ctx, 't')
            expect(filter.where).toBe('t.id = ?')
            expect(filter.binds).toEqual(['emp-1'])
        })

        it('Missing context: should return 1=0', () => {
            // @ts-ignore
            const filter = getDataAccessFilter({ get: () => undefined } as any)
            expect(filter.where).toBe('1=0')
        })
    })

    describe('canViewEmployee', () => {
        // Mock DB helper
        const mockDbReturn = (value: any) => ({
            prepare: vi.fn(() => ({
                bind: vi.fn(() => ({
                    first: vi.fn().mockResolvedValue(value)
                }))
            }))
        })

        it('Level 1 (HQ): can view anyone', async () => {
            const ctx = createMockContext({ level: 1 } as Position, { id: 'hq' } as Employee)
            const result = await canViewEmployee(ctx, 'target-id')
            expect(result).toBe(true)
        })

        it('Level 2 (Project): can view employee in same project', async () => {
            const db = mockDbReturn({ department_id: 'dept-a' })
            const ctx = createMockContext(
                { level: 2 } as Position, 
                { id: 'pm', department_id: 'dept-a' } as Employee,
                ['*'], db
            )
            
            const result = await canViewEmployee(ctx, 'target-id')
            expect(result).toBe(true)
        })

        it('Level 2 (Project): cannot view employee in other project', async () => {
            const db = mockDbReturn({ department_id: 'dept-b' }) // Target is in dept-b
            const ctx = createMockContext(
                { level: 2 } as Position, 
                { id: 'pm', department_id: 'dept-a' } as Employee, // PM is in dept-a
                ['*'], db
            )
            
            const result = await canViewEmployee(ctx, 'target-id')
            expect(result).toBe(false)
        })

        it('Team Leader: can view employee in same team', async () => {
            const db = mockDbReturn({ org_department_id: 'team-1' })
            const ctx = createMockContext(
                { level: 3, code: 'team_leader' } as Position, 
                { id: 'tl', org_department_id: 'team-1' } as Employee,
                ['*'], db
            )
            
            const result = await canViewEmployee(ctx, 'target-id')
            expect(result).toBe(true)
        })

        it('Team Leader: cannot view employee in other team', async () => {
            const db = mockDbReturn({ org_department_id: 'team-2' })
            const ctx = createMockContext(
                { level: 3, code: 'team_leader' } as Position, 
                { id: 'tl', org_department_id: 'team-1' } as Employee,
                ['*'], db
            )
            
            const result = await canViewEmployee(ctx, 'target-id')
            expect(result).toBe(false)
        })

        it('Engineer: can only view self', async () => {
            const ctx = createMockContext(
                { level: 3, code: 'team_engineer' } as Position, 
                { id: 'emp-1' } as Employee
            )
            
            expect(await canViewEmployee(ctx, 'emp-1')).toBe(true)
            expect(await canViewEmployee(ctx, 'other-emp')).toBe(false)
        })
    })

    describe('hasPermission', () => {
        const permissions = {
            finance: {
                flow: ['view', 'create']
            },
            hr: {
                employee: ['view']
            }
        }

        it('should allow if module allowed and permission exists', () => {
            const ctx = createMockContext(
                { level: 2, permissions } as Position,
                { id: 'u1' } as Employee,
                ['finance.*', 'hr.*'] // Department allows finance and hr
            )

            expect(hasPermission(ctx, 'finance', 'flow', 'create')).toBe(true)
        })

        it('should deny if module NOT allowed by department', () => {
            const ctx = createMockContext(
                { level: 2, permissions } as Position,
                { id: 'u1' } as Employee,
                ['hr.*'] // Department ONLY allows hr
            )

            // User has permission in JSON, but department disallows module
            expect(hasPermission(ctx, 'finance', 'flow', 'create')).toBe(false)
        })

        it('should deny if permission does not exist in position', () => {
            const ctx = createMockContext(
                { level: 2, permissions } as Position,
                { id: 'u1' } as Employee,
                ['*']
            )

            expect(hasPermission(ctx, 'finance', 'flow', 'delete')).toBe(false)
        })

        it('Level 1 (HQ) should bypass department module restrictions', () => {
            const ctx = createMockContext(
                { level: 1, permissions } as Position, // HQ Level 1
                { id: 'u1' } as Employee,
                ['hr.*'] // Even if context says restricted modules (unlikely for HQ but testing logic)
            )

            expect(hasPermission(ctx, 'finance', 'flow', 'view')).toBe(true)
        })
    })
})


