/**
 * Permission Context Property-Based Tests
 *
 * **Feature: permission-system-optimization**
 * **Property 4: Permission Context Completeness**
 * **Property 5: hasPermission Method Correctness**
 * **Validates: Requirements 3.2, 3.3**
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  PermissionContext,
  createPermissionContextFromData,
  type PositionInfo,
  type EmployeeInfo,
  type PermissionContextJSON,
} from '../../src/utils/permission-context.js'
import type { DataScopeType } from '../../src/constants/permissions.js'

// ============================================================================
// Generators for Property-Based Testing
// ============================================================================

/**
 * Generator for valid DataScope values
 */
const dataScopeArb = fc.constantFrom<DataScopeType>('all', 'project', 'group', 'self')

/**
 * Generator for valid module names
 */
const moduleNameArb = fc.constantFrom('hr', 'finance', 'asset', 'report', 'system', 'site', 'pm', 'self')

/**
 * Generator for valid submodule names
 */
const subModuleNameArb = fc.constantFrom(
  'employee', 'salary', 'leave', 'reimbursement',
  'flow', 'transfer', 'ar', 'ap',
  'fixed', 'rental',
  'info', 'bill',
  'view', 'export',
  'user', 'position', 'department', 'account', 'category',
  'project', 'requirement', 'task', 'timelog', 'milestone'
)

/**
 * Generator for valid action names
 */
const actionNameArb = fc.constantFrom(
  'view', 'create', 'update', 'delete', 'approve', 'reject', 'export', 'reverse', 'pay', 'allocate', 'assign', 'review', 'manage', 'view_sensitive'
)

/**
 * Generator for permission structure: { module: { subModule: [actions] } }
 */
const permissionsArb = fc.dictionary(
  moduleNameArb,
  fc.dictionary(
    subModuleNameArb,
    fc.array(actionNameArb, { minLength: 0, maxLength: 5 })
  )
)

/**
 * Generator for department modules (allowed modules list)
 */
const departmentModulesArb = fc.oneof(
  fc.constant(['*'] as string[]), // All modules allowed
  fc.array(
    fc.oneof(
      moduleNameArb,
      moduleNameArb.map(m => `${m}.*`)
    ),
    { minLength: 0, maxLength: 5 }
  )
)

/**
 * Generator for PositionInfo
 */
const positionInfoArb = fc.record({
  id: fc.uuid(),
  code: fc.string({ minLength: 1, maxLength: 20 }),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  canManageSubordinates: fc.constantFrom(0, 1),
  dataScope: dataScopeArb,
  permissions: permissionsArb,
})

/**
 * Generator for EmployeeInfo
 */
const employeeInfoArb = fc.record({
  id: fc.uuid(),
  orgDepartmentId: fc.option(fc.uuid(), { nil: null }),
  projectId: fc.option(fc.uuid(), { nil: null }),
})

/**
 * Generator for complete PermissionContext input data
 */
const permissionContextDataArb = fc.record({
  employeeId: fc.uuid(),
  position: positionInfoArb,
  employee: employeeInfoArb,
  departmentModules: departmentModulesArb,
})

// Mock D1Database for testing (minimal implementation)
const mockDb = {
  prepare: () => ({
    bind: () => ({
      first: async () => null,
    }),
  }),
} as unknown as D1Database

// ============================================================================
// Property 4: Permission Context Completeness
// **Validates: Requirements 3.2**
// ============================================================================

describe('Property 4: Permission Context Completeness', () => {
  /**
   * **Feature: permission-system-optimization, Property 4: Permission Context Completeness**
   * **Validates: Requirements 3.2**
   *
   * *For any* authenticated user, the Permission_Context should contain all required fields:
   * permissions, dataScope, canManageSubordinates, and departmentModules.
   */
  it('should contain all required fields for any valid input', () => {
    fc.assert(
      fc.property(permissionContextDataArb, (data) => {
        const ctx = createPermissionContextFromData(
          data.employeeId,
          data.position,
          data.employee,
          data.departmentModules,
          mockDb
        )

        // Verify all required properties exist and have correct types
        expect(ctx.employeeId).toBe(data.employeeId)
        expect(ctx.dataScope).toBe(data.position.dataScope)
        expect(typeof ctx.canManageSubordinates).toBe('boolean')
        expect(ctx.canManageSubordinates).toBe(data.position.canManageSubordinates === 1)
        expect(Array.isArray(ctx.allowedModules)).toBe(true)
        expect(ctx.allowedModules).toEqual(data.departmentModules)
        expect(typeof ctx.permissions).toBe('object')
        expect(ctx.permissions).toEqual(data.position.permissions)

        return true
      }),
      { numRuns: 100 }
    )
  })

  /**
   * toJSON() should produce a complete JSON representation with all required fields
   */
  it('toJSON should include all required fields for any valid context', () => {
    fc.assert(
      fc.property(permissionContextDataArb, (data) => {
        const ctx = createPermissionContextFromData(
          data.employeeId,
          data.position,
          data.employee,
          data.departmentModules,
          mockDb
        )

        const json = ctx.toJSON()

        // Verify JSON structure completeness
        expect(json.employeeId).toBe(data.employeeId)
        expect(json.position).toBeDefined()
        expect(json.position.id).toBe(data.position.id)
        expect(json.position.code).toBe(data.position.code)
        expect(json.position.name).toBe(data.position.name)
        expect(json.permissions).toEqual(data.position.permissions)
        expect(json.dataScope).toBe(data.position.dataScope)
        expect(typeof json.canManageSubordinates).toBe('boolean')
        expect(json.allowedModules).toEqual(data.departmentModules)
        expect(json.projectId).toBe(data.employee.projectId)
        expect(json.orgDepartmentId).toBe(data.employee.orgDepartmentId)

        return true
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Position and employee getters should return the original data
   */
  it('position and employee getters should return original data', () => {
    fc.assert(
      fc.property(permissionContextDataArb, (data) => {
        const ctx = createPermissionContextFromData(
          data.employeeId,
          data.position,
          data.employee,
          data.departmentModules,
          mockDb
        )

        expect(ctx.position).toEqual(data.position)
        expect(ctx.employee).toEqual(data.employee)

        return true
      }),
      { numRuns: 100 }
    )
  })
})

// ============================================================================
// Property 5: hasPermission Method Correctness
// **Validates: Requirements 3.3**
// ============================================================================

describe('Property 5: hasPermission Method Correctness', () => {
  /**
   * **Feature: permission-system-optimization, Property 5: hasPermission Method Correctness**
   * **Validates: Requirements 3.3**
   *
   * *For any* permission query (module, subModule, action), the hasPermission method
   * should return true if and only if the user's permissions include the queried permission.
   */

  /**
   * When module is in permissions and department allows it, hasPermission(module) should return true
   */
  it('should return true for module-level check when module exists and is allowed', () => {
    fc.assert(
      fc.property(
        permissionContextDataArb,
        moduleNameArb,
        (data, module) => {
          // Ensure the module exists in permissions
          const permissions = { ...data.position.permissions }
          permissions[module] = { subModule1: ['view'] }

          // Ensure department allows all modules
          const departmentModules = ['*']

          const ctx = createPermissionContextFromData(
            data.employeeId,
            { ...data.position, permissions },
            data.employee,
            departmentModules,
            mockDb
          )

          expect(ctx.hasPermission(module)).toBe(true)
          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * When module is NOT in permissions, hasPermission(module) should return false
   */
  it('should return false for module-level check when module does not exist', () => {
    fc.assert(
      fc.property(
        permissionContextDataArb,
        moduleNameArb,
        (data, module) => {
          // Ensure the module does NOT exist in permissions
          const permissions = { ...data.position.permissions }
          delete permissions[module]

          const ctx = createPermissionContextFromData(
            data.employeeId,
            { ...data.position, permissions },
            data.employee,
            ['*'], // Allow all modules at department level
            mockDb
          )

          expect(ctx.hasPermission(module)).toBe(false)
          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * When subModule exists with actions, hasPermission(module, subModule) should return true
   */
  it('should return true for submodule-level check when submodule has actions', () => {
    fc.assert(
      fc.property(
        permissionContextDataArb,
        moduleNameArb,
        subModuleNameArb,
        (data, module, subModule) => {
          // Ensure the module and subModule exist with at least one action
          const permissions = { ...data.position.permissions }
          permissions[module] = { [subModule]: ['view', 'create'] }

          const ctx = createPermissionContextFromData(
            data.employeeId,
            { ...data.position, permissions },
            data.employee,
            ['*'],
            mockDb
          )

          expect(ctx.hasPermission(module, subModule)).toBe(true)
          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * When subModule has empty actions array, hasPermission(module, subModule) should return false
   */
  it('should return false for submodule-level check when submodule has no actions', () => {
    fc.assert(
      fc.property(
        permissionContextDataArb,
        moduleNameArb,
        subModuleNameArb,
        (data, module, subModule) => {
          // Ensure the subModule exists but has empty actions
          const permissions = { ...data.position.permissions }
          permissions[module] = { [subModule]: [] }

          const ctx = createPermissionContextFromData(
            data.employeeId,
            { ...data.position, permissions },
            data.employee,
            ['*'],
            mockDb
          )

          expect(ctx.hasPermission(module, subModule)).toBe(false)
          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * When action exists in subModule, hasPermission(module, subModule, action) should return true
   */
  it('should return true for action-level check when action exists', () => {
    fc.assert(
      fc.property(
        permissionContextDataArb,
        moduleNameArb,
        subModuleNameArb,
        actionNameArb,
        (data, module, subModule, action) => {
          // Ensure the action exists
          const permissions = { ...data.position.permissions }
          permissions[module] = { [subModule]: [action] }

          const ctx = createPermissionContextFromData(
            data.employeeId,
            { ...data.position, permissions },
            data.employee,
            ['*'],
            mockDb
          )

          expect(ctx.hasPermission(module, subModule, action)).toBe(true)
          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * When action does NOT exist in subModule, hasPermission(module, subModule, action) should return false
   */
  it('should return false for action-level check when action does not exist', () => {
    fc.assert(
      fc.property(
        permissionContextDataArb,
        moduleNameArb,
        subModuleNameArb,
        (data, module, subModule) => {
          // Ensure the subModule exists but with different actions
          const permissions = { ...data.position.permissions }
          permissions[module] = { [subModule]: ['view'] }

          const ctx = createPermissionContextFromData(
            data.employeeId,
            { ...data.position, permissions },
            data.employee,
            ['*'],
            mockDb
          )

          // Check for an action that doesn't exist
          expect(ctx.hasPermission(module, subModule, 'nonexistent_action')).toBe(false)
          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Department module restriction: hasPermission should return false when module is not allowed by department
   */
  it('should return false when department does not allow the module', () => {
    fc.assert(
      fc.property(
        permissionContextDataArb,
        (data) => {
          // Set up permissions with 'hr' module
          const permissions = { hr: { employee: ['view', 'create'] } }

          // Department only allows 'finance' module (not 'hr')
          const departmentModules = ['finance']

          // Use non-'all' dataScope so department restrictions apply
          const position = {
            ...data.position,
            permissions,
            dataScope: 'project' as DataScopeType,
          }

          const ctx = createPermissionContextFromData(
            data.employeeId,
            position,
            data.employee,
            departmentModules,
            mockDb
          )

          // Even though 'hr' is in permissions, department doesn't allow it
          expect(ctx.hasPermission('hr')).toBe(false)
          expect(ctx.hasPermission('hr', 'employee')).toBe(false)
          expect(ctx.hasPermission('hr', 'employee', 'view')).toBe(false)

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * DataScope 'all' should bypass department module restrictions
   */
  it('should bypass department restrictions when dataScope is all', () => {
    fc.assert(
      fc.property(
        permissionContextDataArb,
        moduleNameArb,
        (data, module) => {
          // Set up permissions with the module
          const permissions = { [module]: { subModule1: ['view'] } }

          // Department restricts to different module
          const departmentModules = ['other_module']

          // Use 'all' dataScope
          const position = {
            ...data.position,
            permissions,
            dataScope: 'all' as DataScopeType,
          }

          const ctx = createPermissionContextFromData(
            data.employeeId,
            position,
            data.employee,
            departmentModules,
            mockDb
          )

          // With 'all' dataScope, department restrictions don't apply
          expect(ctx.hasPermission(module)).toBe(true)

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * checkPermissions with AND logic should return true only when all permissions are present
   */
  it('checkPermissions with AND logic should require all permissions', () => {
    fc.assert(
      fc.property(
        permissionContextDataArb,
        (data) => {
          const permissions = {
            hr: { employee: ['view', 'create'] },
            finance: { flow: ['view'] },
          }

          const ctx = createPermissionContextFromData(
            data.employeeId,
            { ...data.position, permissions, dataScope: 'all' },
            data.employee,
            ['*'],
            mockDb
          )

          // All permissions present - should return true
          expect(
            ctx.checkPermissions([
              { module: 'hr', subModule: 'employee', action: 'view' },
              { module: 'finance', subModule: 'flow', action: 'view' },
            ], 'AND')
          ).toBe(true)

          // One permission missing - should return false
          expect(
            ctx.checkPermissions([
              { module: 'hr', subModule: 'employee', action: 'view' },
              { module: 'finance', subModule: 'flow', action: 'create' }, // doesn't exist
            ], 'AND')
          ).toBe(false)

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * checkPermissions with OR logic should return true when any permission is present
   */
  it('checkPermissions with OR logic should require any permission', () => {
    fc.assert(
      fc.property(
        permissionContextDataArb,
        (data) => {
          const permissions = {
            hr: { employee: ['view'] },
          }

          const ctx = createPermissionContextFromData(
            data.employeeId,
            { ...data.position, permissions, dataScope: 'all' },
            data.employee,
            ['*'],
            mockDb
          )

          // One permission present - should return true
          expect(
            ctx.checkPermissions([
              { module: 'hr', subModule: 'employee', action: 'view' },
              { module: 'finance', subModule: 'flow', action: 'view' }, // doesn't exist
            ], 'OR')
          ).toBe(true)

          // No permissions present - should return false
          expect(
            ctx.checkPermissions([
              { module: 'finance', subModule: 'flow', action: 'view' },
              { module: 'asset', subModule: 'fixed', action: 'create' },
            ], 'OR')
          ).toBe(false)

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * checkPermissions with empty requirements should return true
   */
  it('checkPermissions with empty requirements should return true', () => {
    fc.assert(
      fc.property(
        permissionContextDataArb,
        (data) => {
          const ctx = createPermissionContextFromData(
            data.employeeId,
            data.position,
            data.employee,
            data.departmentModules,
            mockDb
          )

          expect(ctx.checkPermissions([], 'AND')).toBe(true)
          expect(ctx.checkPermissions([], 'OR')).toBe(true)

          return true
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ============================================================================
// isModuleAllowed Method Tests (Supporting Property 5)
// ============================================================================

describe('isModuleAllowed Method Correctness', () => {
  /**
   * Wildcard '*' in departmentModules should allow all modules
   */
  it('should allow all modules when departmentModules contains wildcard', () => {
    fc.assert(
      fc.property(
        permissionContextDataArb,
        moduleNameArb,
        (data, module) => {
          const ctx = createPermissionContextFromData(
            data.employeeId,
            { ...data.position, dataScope: 'project' },
            data.employee,
            ['*'],
            mockDb
          )

          expect(ctx.isModuleAllowed(module)).toBe(true)
          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Module wildcard pattern (e.g., 'hr.*') should match module and submodules
   */
  it('should match module wildcard patterns correctly', () => {
    fc.assert(
      fc.property(
        permissionContextDataArb,
        moduleNameArb,
        (data, module) => {
          const ctx = createPermissionContextFromData(
            data.employeeId,
            { ...data.position, dataScope: 'project' },
            data.employee,
            [`${module}.*`],
            mockDb
          )

          // Should match the module itself
          expect(ctx.isModuleAllowed(module)).toBe(true)
          // Should match submodules
          expect(ctx.isModuleAllowed(`${module}.submodule`)).toBe(true)

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Exact module match should work
   */
  it('should match exact module names', () => {
    fc.assert(
      fc.property(
        permissionContextDataArb,
        moduleNameArb,
        (data, module) => {
          const ctx = createPermissionContextFromData(
            data.employeeId,
            { ...data.position, dataScope: 'project' },
            data.employee,
            [module],
            mockDb
          )

          expect(ctx.isModuleAllowed(module)).toBe(true)

          return true
        }
      ),
      { numRuns: 100 }
    )
  })
})
