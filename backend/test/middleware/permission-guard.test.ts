/**
 * Permission Guard Property-Based Tests
 *
 * **Feature: permission-system-optimization**
 * **Property 1: Permission Check Correctness**
 * **Validates: Requirements 1.2, 1.3, 1.4**
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  checkPermission,
  checkPermissions,
  type PermissionRequirement,
} from '../../src/middleware/permission.js'
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
const moduleNameArb = fc.constantFrom(
  'hr', 'finance', 'asset', 'report', 'system', 'site', 'pm', 'self'
)

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
  'view', 'create', 'update', 'delete', 'approve', 'reject',
  'export', 'reverse', 'pay', 'allocate', 'assign', 'review',
  'manage', 'view_sensitive'
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
 * Generator for PermissionRequirement
 */
const permissionRequirementArb: fc.Arbitrary<PermissionRequirement> = fc.record({
  module: moduleNameArb,
  subModule: fc.option(subModuleNameArb, { nil: undefined }),
  action: fc.option(actionNameArb, { nil: undefined }),
})

/**
 * Generator for array of PermissionRequirements
 */
const permissionRequirementsArb = fc.array(permissionRequirementArb, { minLength: 1, maxLength: 5 })

/**
 * Generator for logic type
 */
const logicArb = fc.constantFrom<'AND' | 'OR'>('AND', 'OR')

// ============================================================================
// Property 1: Permission Check Correctness
// **Validates: Requirements 1.2, 1.3, 1.4**
// ============================================================================

describe('Property 1: Permission Check Correctness', () => {
  /**
   * **Feature: permission-system-optimization, Property 1: Permission Check Correctness**
   * **Validates: Requirements 1.2, 1.3, 1.4**
   *
   * *For any* user with permissions P and any route requiring permission R,
   * the permission guard should return true if and only if P contains R
   * (considering AND/OR logic).
   */

  // --------------------------------------------------------------------------
  // Single Permission Check Tests (checkPermission)
  // --------------------------------------------------------------------------

  describe('checkPermission - Single Permission Check', () => {
    /**
     * When module exists in permissions and department allows it,
     * checkPermission(module) should return true
     * Validates: Requirements 1.2
     */
    it('should return true for module-level check when module exists and is allowed', () => {
      fc.assert(
        fc.property(
          moduleNameArb,
          dataScopeArb,
          (module, dataScope) => {
            // Set up permissions with the module
            const permissions = { [module]: { subModule1: ['view'] } }
            // Department allows all modules
            const departmentModules = ['*']

            const result = checkPermission(
              permissions,
              departmentModules,
              dataScope,
              { module }
            )

            expect(result).toBe(true)
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * When module does NOT exist in permissions,
     * checkPermission(module) should return false
     * Validates: Requirements 1.2
     */
    it('should return false for module-level check when module does not exist', () => {
      fc.assert(
        fc.property(
          moduleNameArb,
          dataScopeArb,
          (module, dataScope) => {
            // Empty permissions (module doesn't exist)
            const permissions: Record<string, Record<string, string[]>> = {}
            const departmentModules = ['*']

            const result = checkPermission(
              permissions,
              departmentModules,
              dataScope,
              { module }
            )

            expect(result).toBe(false)
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * When subModule exists with actions,
     * checkPermission(module, subModule) should return true
     * Validates: Requirements 1.2
     */
    it('should return true for submodule-level check when submodule has actions', () => {
      fc.assert(
        fc.property(
          moduleNameArb,
          subModuleNameArb,
          dataScopeArb,
          (module, subModule, dataScope) => {
            // Set up permissions with the module and subModule with actions
            const permissions = { [module]: { [subModule]: ['view', 'create'] } }
            const departmentModules = ['*']

            const result = checkPermission(
              permissions,
              departmentModules,
              dataScope,
              { module, subModule }
            )

            expect(result).toBe(true)
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * When subModule has empty actions array,
     * checkPermission(module, subModule) should return false
     * Validates: Requirements 1.2
     */
    it('should return false for submodule-level check when submodule has no actions', () => {
      fc.assert(
        fc.property(
          moduleNameArb,
          subModuleNameArb,
          dataScopeArb,
          (module, subModule, dataScope) => {
            // Set up permissions with empty actions
            const permissions = { [module]: { [subModule]: [] } }
            const departmentModules = ['*']

            const result = checkPermission(
              permissions,
              departmentModules,
              dataScope,
              { module, subModule }
            )

            expect(result).toBe(false)
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * When action exists in subModule,
     * checkPermission(module, subModule, action) should return true
     * Validates: Requirements 1.2
     */
    it('should return true for action-level check when action exists', () => {
      fc.assert(
        fc.property(
          moduleNameArb,
          subModuleNameArb,
          actionNameArb,
          dataScopeArb,
          (module, subModule, action, dataScope) => {
            // Set up permissions with the action
            const permissions = { [module]: { [subModule]: [action] } }
            const departmentModules = ['*']

            const result = checkPermission(
              permissions,
              departmentModules,
              dataScope,
              { module, subModule, action }
            )

            expect(result).toBe(true)
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * When action does NOT exist in subModule,
     * checkPermission(module, subModule, action) should return false
     * Validates: Requirements 1.2
     */
    it('should return false for action-level check when action does not exist', () => {
      fc.assert(
        fc.property(
          moduleNameArb,
          subModuleNameArb,
          dataScopeArb,
          (module, subModule, dataScope) => {
            // Set up permissions with different actions
            const permissions = { [module]: { [subModule]: ['view'] } }
            const departmentModules = ['*']

            // Check for an action that doesn't exist
            const result = checkPermission(
              permissions,
              departmentModules,
              dataScope,
              { module, subModule, action: 'nonexistent_action' }
            )

            expect(result).toBe(false)
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * When department does not allow the module (non-'all' dataScope),
     * checkPermission should return false even if permission exists
     * Validates: Requirements 1.3
     */
    it('should return false when department does not allow the module', () => {
      fc.assert(
        fc.property(
          moduleNameArb,
          subModuleNameArb,
          actionNameArb,
          fc.constantFrom<DataScopeType>('project', 'group', 'self'), // Non-'all' scopes
          (module, subModule, action, dataScope) => {
            // Set up permissions with the module
            const permissions = { [module]: { [subModule]: [action] } }
            // Department only allows a different module
            const departmentModules = ['other_module']

            const result = checkPermission(
              permissions,
              departmentModules,
              dataScope,
              { module, subModule, action }
            )

            expect(result).toBe(false)
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * When dataScope is 'all', department restrictions should be bypassed
     * Validates: Requirements 1.2
     */
    it('should bypass department restrictions when dataScope is all', () => {
      fc.assert(
        fc.property(
          moduleNameArb,
          subModuleNameArb,
          actionNameArb,
          (module, subModule, action) => {
            // Set up permissions with the module
            const permissions = { [module]: { [subModule]: [action] } }
            // Department restricts to different module
            const departmentModules = ['other_module']
            const dataScope = 'all'

            const result = checkPermission(
              permissions,
              departmentModules,
              dataScope,
              { module, subModule, action }
            )

            // With 'all' dataScope, department restrictions don't apply
            expect(result).toBe(true)
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * Wildcard '*' in departmentModules should allow all modules
     */
    it('should allow all modules when departmentModules contains wildcard', () => {
      fc.assert(
        fc.property(
          moduleNameArb,
          subModuleNameArb,
          actionNameArb,
          fc.constantFrom<DataScopeType>('project', 'group', 'self'),
          (module, subModule, action, dataScope) => {
            const permissions = { [module]: { [subModule]: [action] } }
            const departmentModules = ['*']

            const result = checkPermission(
              permissions,
              departmentModules,
              dataScope,
              { module, subModule, action }
            )

            expect(result).toBe(true)
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * Module wildcard pattern (e.g., 'hr.*') should match module
     */
    it('should match module wildcard patterns correctly', () => {
      fc.assert(
        fc.property(
          moduleNameArb,
          subModuleNameArb,
          actionNameArb,
          fc.constantFrom<DataScopeType>('project', 'group', 'self'),
          (module, subModule, action, dataScope) => {
            const permissions = { [module]: { [subModule]: [action] } }
            // Department allows module with wildcard
            const departmentModules = [`${module}.*`]

            const result = checkPermission(
              permissions,
              departmentModules,
              dataScope,
              { module, subModule, action }
            )

            expect(result).toBe(true)
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  // --------------------------------------------------------------------------
  // Multiple Permission Check Tests (checkPermissions)
  // --------------------------------------------------------------------------

  describe('checkPermissions - Multiple Permission Check with AND/OR Logic', () => {
    /**
     * checkPermissions with AND logic should return true only when ALL permissions are present
     * Validates: Requirements 1.4
     */
    it('should return true with AND logic when all permissions are present', () => {
      fc.assert(
        fc.property(
          dataScopeArb,
          (dataScope) => {
            // Set up permissions with multiple modules
            const permissions = {
              hr: { employee: ['view', 'create'] },
              finance: { flow: ['view'] },
            }
            const departmentModules = ['*']

            const requirements: PermissionRequirement[] = [
              { module: 'hr', subModule: 'employee', action: 'view' },
              { module: 'finance', subModule: 'flow', action: 'view' },
            ]

            const result = checkPermissions(
              permissions,
              departmentModules,
              dataScope,
              requirements,
              'AND'
            )

            expect(result).toBe(true)
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * checkPermissions with AND logic should return false when ANY permission is missing
     * Validates: Requirements 1.4
     */
    it('should return false with AND logic when any permission is missing', () => {
      fc.assert(
        fc.property(
          dataScopeArb,
          (dataScope) => {
            // Set up permissions with only one module
            const permissions = {
              hr: { employee: ['view'] },
            }
            const departmentModules = ['*']

            const requirements: PermissionRequirement[] = [
              { module: 'hr', subModule: 'employee', action: 'view' },
              { module: 'finance', subModule: 'flow', action: 'view' }, // Missing
            ]

            const result = checkPermissions(
              permissions,
              departmentModules,
              dataScope,
              requirements,
              'AND'
            )

            expect(result).toBe(false)
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * checkPermissions with OR logic should return true when ANY permission is present
     * Validates: Requirements 1.4
     */
    it('should return true with OR logic when any permission is present', () => {
      fc.assert(
        fc.property(
          dataScopeArb,
          (dataScope) => {
            // Set up permissions with only one module
            const permissions = {
              hr: { employee: ['view'] },
            }
            const departmentModules = ['*']

            const requirements: PermissionRequirement[] = [
              { module: 'hr', subModule: 'employee', action: 'view' }, // Present
              { module: 'finance', subModule: 'flow', action: 'view' }, // Missing
            ]

            const result = checkPermissions(
              permissions,
              departmentModules,
              dataScope,
              requirements,
              'OR'
            )

            expect(result).toBe(true)
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * checkPermissions with OR logic should return false when NO permissions are present
     * Validates: Requirements 1.4
     */
    it('should return false with OR logic when no permissions are present', () => {
      fc.assert(
        fc.property(
          dataScopeArb,
          (dataScope) => {
            // Empty permissions
            const permissions: Record<string, Record<string, string[]>> = {}
            const departmentModules = ['*']

            const requirements: PermissionRequirement[] = [
              { module: 'hr', subModule: 'employee', action: 'view' },
              { module: 'finance', subModule: 'flow', action: 'view' },
            ]

            const result = checkPermissions(
              permissions,
              departmentModules,
              dataScope,
              requirements,
              'OR'
            )

            expect(result).toBe(false)
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * checkPermissions with empty requirements should return true
     * Validates: Requirements 1.4
     */
    it('should return true with empty requirements', () => {
      fc.assert(
        fc.property(
          permissionsArb,
          departmentModulesArb,
          dataScopeArb,
          logicArb,
          (permissions, departmentModules, dataScope, logic) => {
            const result = checkPermissions(
              permissions,
              departmentModules,
              dataScope,
              [],
              logic
            )

            expect(result).toBe(true)
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * checkPermissions should default to AND logic when not specified
     */
    it('should default to AND logic when logic is not specified', () => {
      fc.assert(
        fc.property(
          dataScopeArb,
          (dataScope) => {
            const permissions = {
              hr: { employee: ['view'] },
              finance: { flow: ['view'] },
            }
            const departmentModules = ['*']

            const requirements: PermissionRequirement[] = [
              { module: 'hr', subModule: 'employee', action: 'view' },
              { module: 'finance', subModule: 'flow', action: 'view' },
            ]

            // Call without logic parameter (should default to AND)
            const result = checkPermissions(
              permissions,
              departmentModules,
              dataScope,
              requirements
            )

            expect(result).toBe(true)
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  // --------------------------------------------------------------------------
  // Comprehensive Property Tests
  // --------------------------------------------------------------------------

  describe('Comprehensive Permission Check Properties', () => {
    /**
     * For any permission that exists in user permissions and is allowed by department,
     * checkPermission should return true
     */
    it('should return true for any permission that exists and is allowed', () => {
      fc.assert(
        fc.property(
          moduleNameArb,
          subModuleNameArb,
          actionNameArb,
          dataScopeArb,
          (module, subModule, action, dataScope) => {
            // Construct permissions that include the requirement
            const permissions = { [module]: { [subModule]: [action] } }
            
            // Department allows the module (either wildcard or specific)
            const departmentModules = dataScope === 'all' ? ['other'] : ['*']

            const result = checkPermission(
              permissions,
              departmentModules,
              dataScope,
              { module, subModule, action }
            )

            expect(result).toBe(true)
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * For any permission that does NOT exist in user permissions,
     * checkPermission should return false (regardless of department settings)
     */
    it('should return false for any permission that does not exist', () => {
      fc.assert(
        fc.property(
          moduleNameArb,
          subModuleNameArb,
          actionNameArb,
          dataScopeArb,
          (module, subModule, action, dataScope) => {
            // Empty permissions
            const permissions: Record<string, Record<string, string[]>> = {}
            const departmentModules = ['*']

            const result = checkPermission(
              permissions,
              departmentModules,
              dataScope,
              { module, subModule, action }
            )

            expect(result).toBe(false)
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * Permission check result should be consistent across multiple calls
     * with the same inputs (deterministic)
     */
    it('should be deterministic - same inputs produce same outputs', () => {
      fc.assert(
        fc.property(
          permissionsArb,
          departmentModulesArb,
          dataScopeArb,
          permissionRequirementArb,
          (permissions, departmentModules, dataScope, requirement) => {
            const result1 = checkPermission(
              permissions,
              departmentModules,
              dataScope,
              requirement
            )

            const result2 = checkPermission(
              permissions,
              departmentModules,
              dataScope,
              requirement
            )

            expect(result1).toBe(result2)
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * AND logic should be stricter than OR logic
     * If AND returns true, OR should also return true
     */
    it('AND logic should be stricter than OR logic', () => {
      fc.assert(
        fc.property(
          permissionsArb,
          departmentModulesArb,
          dataScopeArb,
          permissionRequirementsArb,
          (permissions, departmentModules, dataScope, requirements) => {
            const andResult = checkPermissions(
              permissions,
              departmentModules,
              dataScope,
              requirements,
              'AND'
            )

            const orResult = checkPermissions(
              permissions,
              departmentModules,
              dataScope,
              requirements,
              'OR'
            )

            // If AND is true, OR must also be true
            if (andResult) {
              expect(orResult).toBe(true)
            }
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
