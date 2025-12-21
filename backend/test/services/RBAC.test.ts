import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getDataAccessFilterSQL,
  // canViewEmployee, // Removed as per instruction
  hasPermission,
  Position,
  Employee,
} from '../../src/utils/permissions'
import { PermissionService } from '../../src/services/hr/PermissionService.js'
import { createDb } from '../../src/utils/db'
import * as schema from '../../src/db/schema'
import { employees } from '../../src/db/schema'
import { drizzle } from 'drizzle-orm/d1'

// Mock Hono Context
const createMockContext = (
  position: Partial<Position>,
  employee: Partial<Employee>,
  departmentModules: string[] = ['*'],
  dbMock: any = null
) => {
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
            run: vi.fn(),
          })),
        })),
      },
    },
  } as any
}


describe('RBAC (Role-Based Access Control)', () => {
  // Note: getDataAccessFilter tests removed - function was deprecated and removed.
  // Data access filtering is now done via getDataAccessFilterSQL which returns SQL objects
  // and is tested through integration tests.


  describe('RBAC (PermissionService)', () => {
    let service: PermissionService
    let mockDb: any

    beforeEach(() => {
      // Mock Drizzle query builder
      mockDb = {
        select: vi.fn(),
        from: vi.fn(),
        where: vi.fn(),
        get: vi.fn(),
      }
      // Setup chainable mocks
      mockDb.select.mockReturnThis()
      mockDb.from.mockReturnThis()
      mockDb.where.mockReturnThis()

      service = new PermissionService(mockDb as any)
    })

    it('Level 1 (HQ): can view anyone', async () => {
      const actor = { id: 'hq', departmentId: 'dept-a', orgDepartmentId: 'org-a' }
      const position = { level: 1, code: 'hq_admin' } as { level: number; code: string } // Loose type for test
      const targetEmployeeId = 'target-id'

      const result = await service.canViewEmployee(actor, position, targetEmployeeId)
      expect(result).toBe(true)
    })

    it('Level 2 (Project): can view employee in same project', async () => {
      const actor = { id: 'pm', departmentId: 'dept-a', orgDepartmentId: 'org-a' }
      const position = { level: 2, code: 'project_manager' } as { level: number; code: string }
      const targetEmployeeId = 'target-id'

      // Mock DB to return employee in the same department
      mockDb.get.mockResolvedValue({ id: targetEmployeeId, departmentId: 'dept-a' })

      const result = await service.canViewEmployee(actor, position, targetEmployeeId)
      expect(result).toBe(true)
    })

    it('Level 2 (Project): cannot view employee in other project', async () => {
      const actor = { id: 'pm', departmentId: 'dept-a', orgDepartmentId: 'org-a' }
      const position = { level: 2, code: 'project_manager' } as { level: number; code: string }
      const targetEmployeeId = 'target-id'

      // Mock DB to return employee in a different department
      mockDb.get.mockResolvedValue({ id: targetEmployeeId, departmentId: 'dept-b' })

      const result = await service.canViewEmployee(actor, position, targetEmployeeId)
      expect(result).toBe(false)
    })

    it('Level 3 (Team Leader): can view employee in same team', async () => {
      const actor = { id: 'tl', departmentId: 'dept-a', orgDepartmentId: 'team-1' }
      const position = { level: 3, code: 'team_leader' } as { level: number; code: string }
      const targetEmployeeId = 'target-id'

      // Mock DB to return employee
      mockDb.get.mockResolvedValue({ id: targetEmployeeId, orgDepartmentId: 'team-1' })

      const result = await service.canViewEmployee(actor, position, targetEmployeeId)
      expect(result).toBe(true)
    })

    it('Level 3 (Team Leader): cannot view employee in other team', async () => {
      const actor = { id: 'tl', departmentId: 'dept-a', orgDepartmentId: 'team-1' }
      const position = { level: 3, code: 'team_leader' } as { level: number; code: string }
      const targetEmployeeId = 'target-id'

      // Mock DB to return employee
      mockDb.get.mockResolvedValue({ id: targetEmployeeId, orgDepartmentId: 'team-2' })

      const result = await service.canViewEmployee(actor, position, targetEmployeeId)
      expect(result).toBe(false)
    })

    it('Level 3 (Engineer): can only view self', async () => {
      const actor = { id: 'emp-1', departmentId: 'dept-a', orgDepartmentId: 'team-1' }
      const position = { level: 3, code: 'team_engineer' } as { level: number; code: string }

      expect(await service.canViewEmployee(actor, position, 'emp-1')).toBe(true)
      expect(await service.canViewEmployee(actor, position, 'other-emp')).toBe(false)
    })

    it('should return false if target employee not found', async () => {
      const actor = { id: 'pm', departmentId: 'dept-a', orgDepartmentId: 'org-a' }
      const position = { level: 2, code: 'project_manager' } as { level: number; code: string }
      const targetEmployeeId = 'non-existent-id'

      // Mock DB to return null
      mockDb.get.mockResolvedValue(null)

      const result = await service.canViewEmployee(actor, position, targetEmployeeId)
      expect(result).toBe(false)
    })
  })

  describe('hasPermission', () => {
    const permissions = {
      finance: {
        flow: ['view', 'create'],
      },
      hr: {
        employee: ['view'],
      },
    }

    it('should allow if module allowed and permission exists', () => {
      const ctx = createMockContext(
        { level: 2, permissions } as Position,
        { id: 'u1' } as unknown as Employee,
        ['finance.*', 'hr.*'] // Department allows finance and hr
      )

      expect(hasPermission(ctx, 'finance', 'flow', 'create')).toBe(true)
    })

    it('should deny if module NOT allowed by department', () => {
      const ctx = createMockContext(
        { level: 2, permissions } as Position,
        { id: 'u1' } as unknown as Employee,
        ['hr.*'] // Department ONLY allows hr
      )

      // User has permission in JSON, but department disallows module
      expect(hasPermission(ctx, 'finance', 'flow', 'create')).toBe(false)
    })

    it('should deny if permission does not exist in position', () => {
      const ctx = createMockContext(
        { level: 2, permissions } as Position,
        { id: 'u1' } as unknown as Employee,
        ['*']
      )

      expect(hasPermission(ctx, 'finance', 'flow', 'delete')).toBe(false)
    })

    it('Level 1 (HQ) should bypass department module restrictions', () => {
      const ctx = createMockContext(
        { level: 1, permissions } as Position, // HQ Level 1
        { id: 'u1' } as unknown as Employee,
        ['hr.*'] // Even if context says restricted modules (unlikely for HQ but testing logic)
      )

      expect(hasPermission(ctx, 'finance', 'flow', 'view')).toBe(true)
    })
  })
})
