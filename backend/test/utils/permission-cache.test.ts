/**
 * Permission Cache Property-Based Tests
 *
 * **Feature: permission-system-optimization**
 * **Property 7: Cache Consistency**
 * **Validates: Requirements 6.2, 6.3**
 */

import { describe, it, expect, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import {
  PermissionCache,
  createPermissionCache,
  type PermissionCacheData,
  PERMISSION_CACHE_PREFIX,
  PERMISSION_CACHE_TTL,
} from '../../src/utils/permission-cache.js'
import { createDb } from '../../src/db/index.js'
import { env } from 'cloudflare:test'
import { applySchema } from '../setup.js'
import { employees, sessions, positions } from '../../src/db/schema.js'

// ============================================================================
// Generators for Property-Based Testing
// ============================================================================

/**
 * Generator for valid DataScope values
 */
const dataScopeArb = fc.constantFrom('all', 'project', 'group', 'self')

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
  'fixed', 'rental'
)

/**
 * Generator for valid action names
 */
const actionNameArb = fc.constantFrom(
  'view', 'create', 'update', 'delete', 'approve', 'reject', 'export'
)

/**
 * Generator for permission structure
 */
const permissionsArb = fc.dictionary(
  moduleNameArb,
  fc.dictionary(
    subModuleNameArb,
    fc.array(actionNameArb, { minLength: 0, maxLength: 3 })
  )
)

/**
 * Generator for PermissionCacheData
 */
const permissionCacheDataArb = fc.record({
  session: fc.record({
    id: fc.uuid(),
    employeeId: fc.uuid(),
    expires_at: fc.integer({ min: Date.now(), max: Date.now() + 86400000 * 7 }),
  }),
  user: fc.record({
    id: fc.uuid(),
    email: fc.emailAddress(),
    name: fc.string({ minLength: 1, maxLength: 50 }),
  }),
  position: fc.option(
    fc.record({
      id: fc.uuid(),
      code: fc.string({ minLength: 1, maxLength: 20 }),
      name: fc.string({ minLength: 1, maxLength: 50 }),
      canManageSubordinates: fc.constantFrom(0, 1),
      dataScope: dataScopeArb,
      permissions: permissionsArb,
    }),
    { nil: null }
  ),
  employee: fc.option(
    fc.record({
      id: fc.uuid(),
      orgDepartmentId: fc.option(fc.uuid(), { nil: null }),
      projectId: fc.option(fc.uuid(), { nil: null }),
    }),
    { nil: null }
  ),
  departmentModules: fc.array(moduleNameArb, { minLength: 0, maxLength: 5 }),
})

// ============================================================================
// Property 7: Cache Consistency
// **Validates: Requirements 6.2, 6.3**
// ============================================================================

describe('Property 7: Cache Consistency', () => {
  let db: ReturnType<typeof createDb>
  let permissionCache: PermissionCache

  beforeEach(async () => {
    db = createDb(env.DB)
    await applySchema(env.DB)
    permissionCache = createPermissionCache(env.SESSIONS_KV, db)
  })

  /**
   * **Feature: permission-system-optimization, Property 7: Cache Consistency**
   * **Validates: Requirements 6.2**
   *
   * *For any* cached permission data, reading from cache should return the exact same data
   * that was written.
   */
  it('should return exact data that was cached (round-trip consistency)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        permissionCacheDataArb,
        async (sessionId, cacheData) => {
          // Write to cache
          await permissionCache.set(sessionId, cacheData as PermissionCacheData)

          // Read from cache
          const retrieved = await permissionCache.get(sessionId)

          // Verify round-trip consistency
          expect(retrieved).not.toBeNull()
          expect(retrieved).toEqual(cacheData)

          // Clean up
          await permissionCache.delete(sessionId)

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 6.3**
   *
   * *For any* session, deleting the cache should result in null on subsequent reads.
   */
  it('should return null after cache deletion', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        permissionCacheDataArb,
        async (sessionId, cacheData) => {
          // Write to cache
          await permissionCache.set(sessionId, cacheData as PermissionCacheData)

          // Verify it exists
          const beforeDelete = await permissionCache.get(sessionId)
          expect(beforeDelete).not.toBeNull()

          // Delete from cache
          await permissionCache.delete(sessionId)

          // Verify it's gone
          const afterDelete = await permissionCache.get(sessionId)
          expect(afterDelete).toBeNull()

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 6.3**
   *
   * *For any* set of sessions, batch deletion should invalidate all of them.
   */
  it('should invalidate all sessions in batch deletion', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }),
        permissionCacheDataArb,
        async (sessionIds, cacheData) => {
          // Ensure unique session IDs
          const uniqueSessionIds = [...new Set(sessionIds)]

          // Write all sessions to cache
          for (const sessionId of uniqueSessionIds) {
            await permissionCache.set(sessionId, cacheData as PermissionCacheData)
          }

          // Verify all exist
          for (const sessionId of uniqueSessionIds) {
            const cached = await permissionCache.get(sessionId)
            expect(cached).not.toBeNull()
          }

          // Batch delete
          await permissionCache.deleteMany(uniqueSessionIds)

          // Verify all are gone
          for (const sessionId of uniqueSessionIds) {
            const cached = await permissionCache.get(sessionId)
            expect(cached).toBeNull()
          }

          return true
        }
      ),
      { numRuns: 50 }
    )
  })

  /**
   * Cache key should use the correct prefix
   */
  it('should use correct cache key prefix', () => {
    expect(PERMISSION_CACHE_PREFIX).toBe('session:')
  })

  /**
   * Cache TTL should be 7 days
   */
  it('should have correct default TTL', () => {
    expect(PERMISSION_CACHE_TTL).toBe(60 * 60 * 24 * 7)
  })

  /**
   * Reading non-existent cache should return null
   */
  it('should return null for non-existent cache entries', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (sessionId) => {
        const cached = await permissionCache.get(sessionId)
        expect(cached).toBeNull()
        return true
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Overwriting cache should update the data
   */
  it('should update data when cache is overwritten', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        permissionCacheDataArb,
        permissionCacheDataArb,
        async (sessionId, data1, data2) => {
          // Write first data
          await permissionCache.set(sessionId, data1 as PermissionCacheData)

          // Verify first data
          const first = await permissionCache.get(sessionId)
          expect(first).toEqual(data1)

          // Overwrite with second data
          await permissionCache.set(sessionId, data2 as PermissionCacheData)

          // Verify second data
          const second = await permissionCache.get(sessionId)
          expect(second).toEqual(data2)

          // Clean up
          await permissionCache.delete(sessionId)

          return true
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ============================================================================
// Cache Invalidation by Entity Tests
// **Validates: Requirements 6.3**
// ============================================================================

describe('Cache Invalidation by Entity', () => {
  let db: ReturnType<typeof createDb>
  let permissionCache: PermissionCache
  const testPositionId = 'test-position-001'
  const testDepartmentId = 'test-dept-001'

  beforeEach(async () => {
    db = createDb(env.DB)
    await applySchema(env.DB)
    permissionCache = createPermissionCache(env.SESSIONS_KV, db)

    // Create test position
    await db
      .insert(positions)
      .values({
        id: testPositionId,
        code: 'TEST_POS',
        name: 'Test Position',
        dataScope: 'all',
        canManageSubordinates: 0,
        permissions: JSON.stringify({}),
        sortOrder: 1,
      })
      .run()
  })

  /**
   * **Validates: Requirements 6.3**
   *
   * When an employee's permissions change, all their active sessions should be invalidated.
   */
  it('should invalidate all sessions for an employee when invalidateByEmployeeId is called', async () => {
    const employeeId = 'test-employee-invalidate'
    const sessionIds = ['session-1', 'session-2', 'session-3']

    // Create test employee
    await db
      .insert(employees)
      .values({
        id: employeeId,
        email: 'test-invalidate@example.com',
        name: 'Test Employee',
        joinDate: '2023-01-01',
        status: 'regular',
        active: 1,
        positionId: testPositionId,
      })
      .run()

    // Create sessions for the employee
    for (const sessionId of sessionIds) {
      await db
        .insert(sessions)
        .values({
          id: sessionId,
          employeeId,
          expiresAt: Date.now() + 86400000,
        })
        .run()

      // Cache permission data for each session
      await permissionCache.set(sessionId, {
        session: { id: sessionId, employeeId, expires_at: Date.now() + 86400000 },
        user: { id: employeeId, email: 'test@example.com', name: 'Test' },
        position: null,
        employee: null,
        departmentModules: [],
      })
    }

    // Verify all sessions are cached
    for (const sessionId of sessionIds) {
      const cached = await permissionCache.get(sessionId)
      expect(cached).not.toBeNull()
    }

    // Invalidate by employee ID
    await permissionCache.invalidateByEmployeeId(employeeId)

    // Verify all sessions are invalidated
    for (const sessionId of sessionIds) {
      const cached = await permissionCache.get(sessionId)
      expect(cached).toBeNull()
    }
  })

  /**
   * **Validates: Requirements 6.3**
   *
   * When a position's permissions change, all employees with that position should have
   * their sessions invalidated.
   */
  it('should invalidate sessions for all employees with a position when invalidateByPositionId is called', async () => {
    const positionId = 'test-position-invalidate'
    const employeeIds = ['emp-pos-1', 'emp-pos-2']
    const sessionIds = ['session-pos-1', 'session-pos-2']

    // Create test position
    await db
      .insert(positions)
      .values({
        id: positionId,
        code: 'POS_INV',
        name: 'Position to Invalidate',
        dataScope: 'all',
        canManageSubordinates: 0,
        permissions: JSON.stringify({}),
        sortOrder: 2,
      })
      .run()

    // Create employees with this position
    for (let i = 0; i < employeeIds.length; i++) {
      await db
        .insert(employees)
        .values({
          id: employeeIds[i],
          email: `emp-pos-${i}@example.com`,
          name: `Employee ${i}`,
          joinDate: '2023-01-01',
          status: 'regular',
          active: 1,
          positionId,
        })
        .run()

      // Create session for each employee
      await db
        .insert(sessions)
        .values({
          id: sessionIds[i],
          employeeId: employeeIds[i],
          expiresAt: Date.now() + 86400000,
        })
        .run()

      // Cache permission data
      await permissionCache.set(sessionIds[i], {
        session: { id: sessionIds[i], employeeId: employeeIds[i], expires_at: Date.now() + 86400000 },
        user: { id: employeeIds[i], email: `emp-pos-${i}@example.com`, name: `Employee ${i}` },
        position: null,
        employee: null,
        departmentModules: [],
      })
    }

    // Verify all sessions are cached
    for (const sessionId of sessionIds) {
      const cached = await permissionCache.get(sessionId)
      expect(cached).not.toBeNull()
    }

    // Invalidate by position ID
    await permissionCache.invalidateByPositionId(positionId)

    // Verify all sessions are invalidated
    for (const sessionId of sessionIds) {
      const cached = await permissionCache.get(sessionId)
      expect(cached).toBeNull()
    }
  })

  /**
   * **Validates: Requirements 6.3**
   *
   * When a department's module permissions change, all employees in that department
   * should have their sessions invalidated.
   */
  it('should invalidate sessions for all employees in a department when invalidateByDepartmentId is called', async () => {
    const departmentId = 'test-dept-invalidate'
    const employeeIds = ['emp-dept-1', 'emp-dept-2']
    const sessionIds = ['session-dept-1', 'session-dept-2']

    // Create employees in this department
    for (let i = 0; i < employeeIds.length; i++) {
      await db
        .insert(employees)
        .values({
          id: employeeIds[i],
          email: `emp-dept-${i}@example.com`,
          name: `Employee Dept ${i}`,
          joinDate: '2023-01-01',
          status: 'regular',
          active: 1,
          positionId: testPositionId,
          orgDepartmentId: departmentId,
        })
        .run()

      // Create session for each employee
      await db
        .insert(sessions)
        .values({
          id: sessionIds[i],
          employeeId: employeeIds[i],
          expiresAt: Date.now() + 86400000,
        })
        .run()

      // Cache permission data
      await permissionCache.set(sessionIds[i], {
        session: { id: sessionIds[i], employeeId: employeeIds[i], expires_at: Date.now() + 86400000 },
        user: { id: employeeIds[i], email: `emp-dept-${i}@example.com`, name: `Employee Dept ${i}` },
        position: null,
        employee: null,
        departmentModules: [],
      })
    }

    // Verify all sessions are cached
    for (const sessionId of sessionIds) {
      const cached = await permissionCache.get(sessionId)
      expect(cached).not.toBeNull()
    }

    // Invalidate by department ID
    await permissionCache.invalidateByDepartmentId(departmentId)

    // Verify all sessions are invalidated
    for (const sessionId of sessionIds) {
      const cached = await permissionCache.get(sessionId)
      expect(cached).toBeNull()
    }
  })

  /**
   * Invalidating non-existent employee should not throw
   */
  it('should handle invalidation of non-existent employee gracefully', async () => {
    await expect(
      permissionCache.invalidateByEmployeeId('non-existent-employee')
    ).resolves.not.toThrow()
  })

  /**
   * Invalidating non-existent position should not throw
   */
  it('should handle invalidation of non-existent position gracefully', async () => {
    await expect(
      permissionCache.invalidateByPositionId('non-existent-position')
    ).resolves.not.toThrow()
  })

  /**
   * Invalidating non-existent department should not throw
   */
  it('should handle invalidation of non-existent department gracefully', async () => {
    await expect(
      permissionCache.invalidateByDepartmentId('non-existent-department')
    ).resolves.not.toThrow()
  })
})

// ============================================================================
// Cache Refresh Tests
// **Validates: Requirements 6.2, 6.3**
// ============================================================================

describe('Cache Refresh', () => {
  let db: ReturnType<typeof createDb>
  let permissionCache: PermissionCache
  const testPositionId = 'test-position-refresh'

  beforeEach(async () => {
    db = createDb(env.DB)
    await applySchema(env.DB)
    permissionCache = createPermissionCache(env.SESSIONS_KV, db)

    // Create test position
    await db
      .insert(positions)
      .values({
        id: testPositionId,
        code: 'TEST_REFRESH',
        name: 'Test Position Refresh',
        dataScope: 'all',
        canManageSubordinates: 0,
        permissions: JSON.stringify({ hr: { employee: ['view'] } }),
        sortOrder: 1,
      })
      .run()
  })

  /**
   * Refreshing cache for non-existent employee should not throw
   */
  it('should handle refresh of non-existent employee gracefully', async () => {
    await expect(
      permissionCache.refreshByEmployeeId('non-existent-employee')
    ).resolves.not.toThrow()
  })

  /**
   * Refreshing cache for employee with no sessions should not throw
   */
  it('should handle refresh of employee with no sessions gracefully', async () => {
    const employeeId = 'emp-no-sessions'

    // Create employee without sessions
    await db
      .insert(employees)
      .values({
        id: employeeId,
        email: 'no-sessions@example.com',
        name: 'No Sessions Employee',
        joinDate: '2023-01-01',
        status: 'regular',
        active: 1,
        positionId: testPositionId,
      })
      .run()

    await expect(
      permissionCache.refreshByEmployeeId(employeeId)
    ).resolves.not.toThrow()
  })
})

