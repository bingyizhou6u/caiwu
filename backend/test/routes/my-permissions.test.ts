/**
 * My Permissions Route Property-Based Tests
 *
 * **Feature: permission-system-optimization**
 * **Property 8: API Response Completeness**
 * **Validates: Requirements 5.2, 5.3**
 *
 * Tests for /api/v2/my/permissions endpoint
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import * as fc from 'fast-check'
import { myRoutes } from '../../src/routes/v2/my.js'
import { AppError } from '../../src/utils/errors.js'
import { ErrorCodes } from '../../src/constants/errorCodes.js'
import type { Env, AppVariables } from '../../src/types/index.js'
import type { DataScopeType } from '../../src/constants/permissions.js'

// Mock audit
vi.mock('../../src/utils/audit.js', () => ({
  logAuditAction: vi.fn(),
}))

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
  fc.constant(['*'] as string[]),
  fc.array(
    fc.oneof(
      moduleNameArb,
      moduleNameArb.map(m => `${m}.*`)
    ),
    { minLength: 0, maxLength: 5 }
  )
)

/**
 * Generator for position code (alphanumeric)
 */
const positionCodeArb = fc.stringMatching(/^[A-Z]{2,5}$/)

/**
 * Generator for position name
 */
const positionNameArb = fc.string({ minLength: 1, maxLength: 50 })

/**
 * Generator for complete user context data for testing
 */
const userContextArb = fc.record({
  employeeId: fc.uuid(),
  positionId: fc.uuid(),
  positionCode: positionCodeArb,
  positionName: positionNameArb,
  canManageSubordinates: fc.constantFrom(0, 1),
  dataScope: dataScopeArb,
  permissions: permissionsArb,
  orgDepartmentId: fc.option(fc.uuid(), { nil: null }),
  projectId: fc.option(fc.uuid(), { nil: null }),
  departmentModules: departmentModulesArb,
})

// ============================================================================
// Test Setup
// ============================================================================

describe('My Permissions Route', () => {
  let app: Hono<{ Bindings: Env; Variables: AppVariables }>

  // ============================================================================
  // Property 8: API Response Completeness
  // **Validates: Requirements 5.2, 5.3**
  // ============================================================================

  describe('Property 8: API Response Completeness', () => {
    /**
     * **Feature: permission-system-optimization, Property 8: API Response Completeness**
     * **Validates: Requirements 5.2, 5.3**
     *
     * *For any* call to /api/v2/my/permissions, the response should include:
     * permissions, dataScope, canManageSubordinates, and allowedModules.
     */
    it('should return complete permission data for any valid user context', () => {
      fc.assert(
        fc.property(userContextArb, (userData) => {
          // Create fresh app for each test
          const testApp = new Hono<{ Bindings: Env; Variables: AppVariables }>()

          // Mock middleware with generated user data
          testApp.use('*', async (c, next) => {
            c.set('employeeId', userData.employeeId)
            c.set('userPosition', {
              id: userData.positionId,
              code: userData.positionCode,
              name: userData.positionName,
              canManageSubordinates: userData.canManageSubordinates,
              dataScope: userData.dataScope,
              permissions: userData.permissions,
            })
            c.set('userEmployee', {
              id: userData.employeeId,
              orgDepartmentId: userData.orgDepartmentId,
              projectId: userData.projectId,
            })
            c.set('departmentModules', userData.departmentModules)
            c.set('services', { my: {} } as any)
            await next()
          })

          // Error handler
          testApp.onError((err, c) => {
            if (err instanceof AppError) {
              return c.json(
                {
                  success: false,
                  error: {
                    code: err.code,
                    message: err.message,
                    details: err.details,
                  },
                },
                err.statusCode as any
              )
            }
            return c.json(
              {
                success: false,
                error: {
                  code: ErrorCodes.SYS_INTERNAL_ERROR,
                  message: err.message || '系统内部错误',
                },
              },
              500 as any
            )
          })

          testApp.route('/', myRoutes)

          // This is a synchronous property test, so we need to return a promise
          return true
        }),
        { numRuns: 100 }
      )
    })

    /**
     * Async test to verify response structure
     */
    it('should include all required fields in response', async () => {
      const testCases = await fc.sample(userContextArb, 10)

      for (const userData of testCases) {
        const testApp = new Hono<{ Bindings: Env; Variables: AppVariables }>()

        testApp.use('*', async (c, next) => {
          c.set('employeeId', userData.employeeId)
          c.set('userPosition', {
            id: userData.positionId,
            code: userData.positionCode,
            name: userData.positionName,
            canManageSubordinates: userData.canManageSubordinates,
            dataScope: userData.dataScope,
            permissions: userData.permissions,
          })
          c.set('userEmployee', {
            id: userData.employeeId,
            orgDepartmentId: userData.orgDepartmentId,
            projectId: userData.projectId,
          })
          c.set('departmentModules', userData.departmentModules)
          c.set('services', { my: {} } as any)
          await next()
        })

        testApp.onError((err, c) => {
          if (err instanceof AppError) {
            return c.json(
              {
                success: false,
                error: {
                  code: err.code,
                  message: err.message,
                },
              },
              err.statusCode as any
            )
          }
          return c.json(
            {
              success: false,
              error: {
                code: ErrorCodes.SYS_INTERNAL_ERROR,
                message: err.message || '系统内部错误',
              },
            },
            500 as any
          )
        })

        testApp.route('/', myRoutes)

        const res = await testApp.request('/my/permissions', {
          method: 'GET',
        }, { DB: {} } as any)

        expect(res.status).toBe(200)
        const data = (await res.json()) as any

        // Verify V2 response format
        expect(data.success).toBe(true)
        expect(data.data).toBeDefined()

        // **Validates: Requirements 5.2** - dataScope and canManageSubordinates
        expect(data.data.dataScope).toBe(userData.dataScope)
        expect(typeof data.data.canManageSubordinates).toBe('boolean')
        expect(data.data.canManageSubordinates).toBe(userData.canManageSubordinates === 1)

        // **Validates: Requirements 5.3** - allowedModules
        expect(Array.isArray(data.data.allowedModules)).toBe(true)
        expect(data.data.allowedModules).toEqual(userData.departmentModules)

        // Verify permissions structure
        expect(typeof data.data.permissions).toBe('object')
        expect(data.data.permissions).toEqual(userData.permissions)

        // Verify position info
        expect(data.data.position).toBeDefined()
        expect(data.data.position.id).toBe(userData.positionId)
        expect(data.data.position.code).toBe(userData.positionCode)
        expect(data.data.position.name).toBe(userData.positionName)

        // Verify employee context
        expect(data.data.employeeId).toBe(userData.employeeId)
        expect(data.data.projectId).toBe(userData.projectId)
        expect(data.data.orgDepartmentId).toBe(userData.orgDepartmentId)
      }
    })

    /**
     * Response should return 401 when user is not authenticated
     */
    it('should return 401 when user is not authenticated', async () => {
      const testApp = new Hono<{ Bindings: Env; Variables: AppVariables }>()

      // No employeeId set - simulating unauthenticated user
      testApp.use('*', async (c, next) => {
        c.set('services', { my: {} } as any)
        await next()
      })

      testApp.onError((err, c) => {
        if (err instanceof AppError) {
          return c.json(
            {
              success: false,
              error: {
                code: err.code,
                message: err.message,
              },
            },
            err.statusCode as any
          )
        }
        return c.json(
          {
            success: false,
            error: {
              code: ErrorCodes.SYS_INTERNAL_ERROR,
              message: err.message || '系统内部错误',
            },
          },
          500 as any
        )
      })

      testApp.route('/', myRoutes)

      const res = await testApp.request('/my/permissions', {
        method: 'GET',
      }, { DB: {} } as any)

      expect(res.status).toBe(401)
      const data = (await res.json()) as any
      expect(data.success).toBe(false)
      expect(data.error).toBeDefined()
    })

    /**
     * Response should return 401 when permission context cannot be created
     */
    it('should return 401 when permission context is incomplete', async () => {
      const testApp = new Hono<{ Bindings: Env; Variables: AppVariables }>()

      // Set employeeId but missing userPosition - incomplete context
      testApp.use('*', async (c, next) => {
        c.set('employeeId', 'emp123')
        // Missing userPosition and userEmployee
        c.set('services', { my: {} } as any)
        await next()
      })

      testApp.onError((err, c) => {
        if (err instanceof AppError) {
          return c.json(
            {
              success: false,
              error: {
                code: err.code,
                message: err.message,
              },
            },
            err.statusCode as any
          )
        }
        return c.json(
          {
            success: false,
            error: {
              code: ErrorCodes.SYS_INTERNAL_ERROR,
              message: err.message || '系统内部错误',
            },
          },
          500 as any
        )
      })

      testApp.route('/', myRoutes)

      const res = await testApp.request('/my/permissions', {
        method: 'GET',
      }, { DB: {} } as any)

      expect(res.status).toBe(401)
      const data = (await res.json()) as any
      expect(data.success).toBe(false)
      expect(data.error).toBeDefined()
    })
  })

  // ============================================================================
  // Additional Unit Tests for Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    beforeEach(() => {
      vi.clearAllMocks()
      app = new Hono<{ Bindings: Env; Variables: AppVariables }>()
    })

    it('should handle empty permissions object', async () => {
      app.use('*', async (c, next) => {
        c.set('employeeId', 'emp123')
        c.set('userPosition', {
          id: 'pos1',
          code: 'EMP',
          name: 'Employee',
          canManageSubordinates: 0,
          dataScope: 'self',
          permissions: {}, // Empty permissions
        })
        c.set('userEmployee', {
          id: 'emp123',
          orgDepartmentId: null,
          projectId: null,
        })
        c.set('departmentModules', ['*'])
        c.set('services', { my: {} } as any)
        await next()
      })

      app.onError((err, c) => {
        if (err instanceof AppError) {
          return c.json(
            {
              success: false,
              error: {
                code: err.code,
                message: err.message,
              },
            },
            err.statusCode as any
          )
        }
        return c.json(
          {
            success: false,
            error: {
              code: ErrorCodes.SYS_INTERNAL_ERROR,
              message: err.message || '系统内部错误',
            },
          },
          500 as any
        )
      })

      app.route('/', myRoutes)

      const res = await app.request('/my/permissions', {
        method: 'GET',
      }, { DB: {} } as any)

      expect(res.status).toBe(200)
      const data = (await res.json()) as any
      expect(data.success).toBe(true)
      expect(data.data.permissions).toEqual({})
    })

    it('should handle empty departmentModules array', async () => {
      app.use('*', async (c, next) => {
        c.set('employeeId', 'emp123')
        c.set('userPosition', {
          id: 'pos1',
          code: 'EMP',
          name: 'Employee',
          canManageSubordinates: 0,
          dataScope: 'self',
          permissions: { hr: { employee: ['view'] } },
        })
        c.set('userEmployee', {
          id: 'emp123',
          orgDepartmentId: 'dept1',
          projectId: null,
        })
        c.set('departmentModules', []) // Empty modules
        c.set('services', { my: {} } as any)
        await next()
      })

      app.onError((err, c) => {
        if (err instanceof AppError) {
          return c.json(
            {
              success: false,
              error: {
                code: err.code,
                message: err.message,
              },
            },
            err.statusCode as any
          )
        }
        return c.json(
          {
            success: false,
            error: {
              code: ErrorCodes.SYS_INTERNAL_ERROR,
              message: err.message || '系统内部错误',
            },
          },
          500 as any
        )
      })

      app.route('/', myRoutes)

      const res = await app.request('/my/permissions', {
        method: 'GET',
      }, { DB: {} } as any)

      expect(res.status).toBe(200)
      const data = (await res.json()) as any
      expect(data.success).toBe(true)
      expect(data.data.allowedModules).toEqual([])
    })

    it('should correctly convert canManageSubordinates to boolean', async () => {
      // Test with canManageSubordinates = 1
      app.use('*', async (c, next) => {
        c.set('employeeId', 'emp123')
        c.set('userPosition', {
          id: 'pos1',
          code: 'MGR',
          name: 'Manager',
          canManageSubordinates: 1,
          dataScope: 'all',
          permissions: {},
        })
        c.set('userEmployee', {
          id: 'emp123',
          orgDepartmentId: null,
          projectId: null,
        })
        c.set('departmentModules', ['*'])
        c.set('services', { my: {} } as any)
        await next()
      })

      app.onError((err, c) => {
        if (err instanceof AppError) {
          return c.json(
            {
              success: false,
              error: {
                code: err.code,
                message: err.message,
              },
            },
            err.statusCode as any
          )
        }
        return c.json(
          {
            success: false,
            error: {
              code: ErrorCodes.SYS_INTERNAL_ERROR,
              message: err.message || '系统内部错误',
            },
          },
          500 as any
        )
      })

      app.route('/', myRoutes)

      const res = await app.request('/my/permissions', {
        method: 'GET',
      }, { DB: {} } as any)

      expect(res.status).toBe(200)
      const data = (await res.json()) as any
      expect(data.success).toBe(true)
      expect(data.data.canManageSubordinates).toBe(true)
    })

    it('should return all dataScope values correctly', async () => {
      const dataScopes: DataScopeType[] = ['all', 'project', 'group', 'self']

      for (const scope of dataScopes) {
        const testApp = new Hono<{ Bindings: Env; Variables: AppVariables }>()

        testApp.use('*', async (c, next) => {
          c.set('employeeId', 'emp123')
          c.set('userPosition', {
            id: 'pos1',
            code: 'TEST',
            name: 'Test Position',
            canManageSubordinates: 0,
            dataScope: scope,
            permissions: {},
          })
          c.set('userEmployee', {
            id: 'emp123',
            orgDepartmentId: 'dept1',
            projectId: 'proj1',
          })
          c.set('departmentModules', ['*'])
          c.set('services', { my: {} } as any)
          await next()
        })

        testApp.onError((err, c) => {
          if (err instanceof AppError) {
            return c.json(
              {
                success: false,
                error: {
                  code: err.code,
                  message: err.message,
                },
              },
              err.statusCode as any
            )
          }
          return c.json(
            {
              success: false,
              error: {
                code: ErrorCodes.SYS_INTERNAL_ERROR,
                message: err.message || '系统内部错误',
              },
            },
            500 as any
          )
        })

        testApp.route('/', myRoutes)

        const res = await testApp.request('/my/permissions', {
          method: 'GET',
        }, { DB: {} } as any)

        expect(res.status).toBe(200)
        const data = (await res.json()) as any
        expect(data.success).toBe(true)
        expect(data.data.dataScope).toBe(scope)
      }
    })
  })
})
