import { describe, it, expect, vi, beforeEach } from 'vitest'
import { checkPermission } from '../../src/middleware/permission'
import { PermissionService } from '../../src/services/hr/PermissionService.js'

// Position and Employee interfaces for testing
interface Position {
  id: string
  code: string
  name: string
  canManageSubordinates: number
  dataScope: string
  permissions: Record<string, Record<string, string[]>>
}

interface Employee {
  id: string
  email: string
  name: string
  positionId: string
  projectId: string | null
  orgDepartmentId: string | null
}

// Mock Hono Context (kept for reference, but tests now use checkPermission directly)
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

/**
 * Helper function to test permission checking using the new checkPermission function
 * This replaces the old hasPermission function tests
 */
function testHasPermission(
  permissions: Record<string, Record<string, string[]>>,
  departmentModules: string[],
  dataScope: string,
  module: string,
  subModule: string,
  action: string
): boolean {
  return checkPermission(permissions, departmentModules, dataScope, { module, subModule, action })
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
      const actor = { id: 'hq', projectId: 'dept-a', orgDepartmentId: 'org-a' }
      const position = { level: 1, code: 'mock_hq_admin', dataScope: 'all' } as any
      const targetEmployeeId = 'target-id'

      const result = await service.canViewEmployee(actor, position, targetEmployeeId)
      expect(result).toBe(true)
    })

    it('Level 2 (Project): can view employee in same project', async () => {
      const actor = { id: 'pm', projectId: 'dept-a', orgDepartmentId: 'org-a' }
      const position = { level: 2, code: 'mock_pm', dataScope: 'project' } as any
      const targetEmployeeId = 'target-id'

      // Mock DB to return employee in the same department
      mockDb.get.mockResolvedValue({ id: targetEmployeeId, projectId: 'dept-a' })

      const result = await service.canViewEmployee(actor, position, targetEmployeeId)
      expect(result).toBe(true)
    })

    it('Level 2 (Project): cannot view employee in other project', async () => {
      const actor = { id: 'pm', projectId: 'dept-a', orgDepartmentId: 'org-a' }
      const position = { level: 2, code: 'mock_pm', dataScope: 'project' } as any
      const targetEmployeeId = 'target-id'

      // Mock DB to return employee in a different department
      mockDb.get.mockResolvedValue({ id: targetEmployeeId, projectId: 'dept-b' })

      const result = await service.canViewEmployee(actor, position, targetEmployeeId)
      expect(result).toBe(false)
    })

    it('Level 3 (Team Leader): can view employee in same team', async () => {
      const actor = { id: 'tl', projectId: 'dept-a', orgDepartmentId: 'team-1' }
      const position = { level: 3, code: 'mock_tl', dataScope: 'group' } as any
      const targetEmployeeId = 'target-id'

      // Mock DB to return employee
      mockDb.get.mockResolvedValue({ id: targetEmployeeId, orgDepartmentId: 'team-1' })

      const result = await service.canViewEmployee(actor, position, targetEmployeeId)
      expect(result).toBe(true)
    })

    it('Level 3 (Team Leader): cannot view employee in other team', async () => {
      const actor = { id: 'tl', projectId: 'dept-a', orgDepartmentId: 'team-1' }
      const position = { level: 3, code: 'mock_tl', dataScope: 'group' } as any
      const targetEmployeeId = 'target-id'

      // Mock DB to return employee
      mockDb.get.mockResolvedValue({ id: targetEmployeeId, orgDepartmentId: 'team-2' })

      const result = await service.canViewEmployee(actor, position, targetEmployeeId)
      expect(result).toBe(false)
    })

    it('Level 3 (Engineer): can only view self', async () => {
      const actor = { id: 'emp-1', projectId: 'dept-a', orgDepartmentId: 'team-1' }
      const position = { level: 3, code: 'mock_engineer', dataScope: 'self' } as any

      expect(await service.canViewEmployee(actor, position, 'emp-1')).toBe(true)
      expect(await service.canViewEmployee(actor, position, 'other-emp')).toBe(false)
    })

    it('should return false if target employee not found', async () => {
      const actor = { id: 'pm', projectId: 'dept-a', orgDepartmentId: 'org-a' }
      const position = { level: 2, code: 'mock_pm', dataScope: 'project' } as any
      const targetEmployeeId = 'non-existent-id'

      // Mock DB to return null
      mockDb.get.mockResolvedValue(null)

      const result = await service.canViewEmployee(actor, position, targetEmployeeId)
      expect(result).toBe(false)
    })
  })

  describe('hasPermission (using checkPermission)', () => {
    const permissions = {
      finance: {
        flow: ['view', 'create'],
      },
      hr: {
        employee: ['view'],
      },
    }

    it('should allow if module allowed and permission exists', () => {
      const result = testHasPermission(
        permissions,
        ['finance.*', 'hr.*'], // Department allows finance and hr
        'project',
        'finance', 'flow', 'create'
      )

      expect(result).toBe(true)
    })

    it('should deny if module NOT allowed by department', () => {
      const result = testHasPermission(
        permissions,
        ['hr.*'], // Department ONLY allows hr
        'project',
        'finance', 'flow', 'create'
      )

      // User has permission in JSON, but department disallows module
      expect(result).toBe(false)
    })

    it('should deny if permission does not exist in position', () => {
      const result = testHasPermission(
        permissions,
        ['*'],
        'project',
        'finance', 'flow', 'delete'
      )

      expect(result).toBe(false)
    })

    it('Level 1 (HQ) should bypass department module restrictions', () => {
      const result = testHasPermission(
        permissions,
        ['hr.*'], // Even if context says restricted modules (unlikely for HQ but testing logic)
        'all', // HQ dataScope = 'all'
        'finance', 'flow', 'view'
      )

      expect(result).toBe(true)
    })
  })
})
