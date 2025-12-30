/**
 * Permission Audit Service Property-Based Tests
 *
 * **Feature: permission-system-optimization**
 * **Property 6: Audit Log Completeness**
 * **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
 */

import { describe, it, expect, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import {
  PermissionAuditService,
  type PermissionChangeType,
  type PermissionChangeRecord,
  type PermissionDiff,
} from '../../src/services/system/PermissionAuditService.js'
import { createDb } from '../../src/db/index.js'
import { env } from 'cloudflare:test'
import { applySchema } from '../setup.js'
import { employees, businessOperationHistory } from '../../src/db/schema.js'
import { eq } from 'drizzle-orm'

// ============================================================================
// Generators for Property-Based Testing
// ============================================================================

/**
 * Generator for valid PermissionChangeType values
 */
const changeTypeArb = fc.constantFrom<PermissionChangeType>(
  'position_permission_update',
  'employee_position_change',
  'department_module_update'
)

/**
 * Generator for valid entity types
 */
const entityTypeArb = fc.constantFrom(
  'position',
  'employee',
  'org_department',
  'position_permission',
  'employee_position',
  'department_module'
)

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
  'user', 'position', 'department', 'account', 'category'
)

/**
 * Generator for valid action names
 */
const actionNameArb = fc.constantFrom(
  'view', 'create', 'update', 'delete', 'approve', 'reject',
  'export', 'reverse', 'pay', 'allocate', 'assign', 'review'
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
 * Generator for IP addresses
 */
const ipAddressArb = fc.oneof(
  // IPv4
  fc.tuple(
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 })
  ).map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`),
  // Simple IPv6-like
  fc.constant('::1'),
  fc.constant('2001:db8::1')
)

/**
 * Generator for memo strings
 */
const memoArb = fc.option(
  fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  { nil: undefined }
)

/**
 * Generator for operator name
 */
const operatorNameArb = fc.option(
  fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  { nil: undefined }
)

/**
 * Generator for beforeData/afterData (permission-related data)
 */
const permissionDataArb = fc.oneof(
  // Position permission data
  fc.record({
    permissions: permissionsArb,
    dataScope: fc.constantFrom('all', 'project', 'group', 'self'),
    canManageSubordinates: fc.constantFrom(0, 1),
  }),
  // Employee position change data
  fc.record({
    positionId: fc.uuid(),
    positionName: fc.string({ minLength: 1, maxLength: 50 }),
  }),
  // Department module data
  fc.record({
    allowedModules: fc.array(moduleNameArb, { minLength: 0, maxLength: 5 }),
  }),
  // Null for creation scenarios
  fc.constant(null)
)

/**
 * Generator for complete PermissionChangeRecord
 */
const permissionChangeRecordArb: fc.Arbitrary<PermissionChangeRecord> = fc.record({
  changeType: changeTypeArb,
  entityType: entityTypeArb,
  entityId: fc.uuid(),
  beforeData: permissionDataArb,
  afterData: permissionDataArb,
  operatorId: fc.uuid(),
  operatorName: operatorNameArb,
  ip: fc.option(ipAddressArb, { nil: undefined }),
  memo: memoArb,
})

// ============================================================================
// Property 6: Audit Log Completeness
// **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
// ============================================================================

describe('Property 6: Audit Log Completeness', () => {
  let db: ReturnType<typeof createDb>
  let auditService: PermissionAuditService
  const testOperatorId = 'test-operator-001'

  beforeEach(async () => {
    db = createDb(env.DB)
    await applySchema(env.DB)
    auditService = new PermissionAuditService(db)

    // Create test operator employee
    await db
      .insert(employees)
      .values({
        id: testOperatorId,
        email: 'operator@example.com',
        name: 'Test Operator',
        joinDate: '2023-01-01',
        status: 'regular',
        active: 1,
      })
      .run()
  })

  /**
   * **Feature: permission-system-optimization, Property 6: Audit Log Completeness**
   * **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
   *
   * *For any* permission change operation, the audit log should contain:
   * changeType, entityType, entityId, beforeData, afterData, operatorId, and timestamp.
   */
  it('should record all required fields for any permission change', async () => {
    await fc.assert(
      fc.asyncProperty(permissionChangeRecordArb, async (record) => {
        // Use the test operator ID to ensure the employee exists
        const recordWithValidOperator = {
          ...record,
          operatorId: testOperatorId,
        }

        // Log the permission change
        await auditService.logPermissionChange(recordWithValidOperator)

        // Retrieve the logged record
        const history = await auditService.getPermissionHistory(
          recordWithValidOperator.entityType,
          recordWithValidOperator.entityId,
          { limit: 1 }
        )

        expect(history.length).toBeGreaterThanOrEqual(1)
        const logged = history[0]

        // Verify all required fields are present
        expect(logged.id).toBeDefined()
        expect(typeof logged.id).toBe('string')
        expect(logged.id.length).toBeGreaterThan(0)

        expect(logged.entityType).toBe(recordWithValidOperator.entityType)
        expect(logged.entityId).toBe(recordWithValidOperator.entityId)
        expect(logged.operatorId).toBe(recordWithValidOperator.operatorId)

        // Verify timestamp is present and valid
        expect(logged.createdAt).toBeDefined()
        expect(typeof logged.createdAt).toBe('number')
        expect(logged.createdAt).toBeGreaterThan(0)

        // Verify beforeData and afterData are preserved
        if (recordWithValidOperator.beforeData !== null) {
          expect(logged.beforeData).toEqual(recordWithValidOperator.beforeData)
        }
        if (recordWithValidOperator.afterData !== null) {
          expect(logged.afterData).toEqual(recordWithValidOperator.afterData)
        }

        // Verify action is derived from changeType
        expect(logged.action).toBeDefined()
        expect(typeof logged.action).toBe('string')

        return true
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Validates: Requirements 4.1 - Position permission changes are recorded
   */
  it('should record position permission changes with correct action', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        permissionsArb,
        permissionsArb,
        async (entityId, beforePerms, afterPerms) => {
          const record: PermissionChangeRecord = {
            changeType: 'position_permission_update',
            entityType: 'position',
            entityId,
            beforeData: { permissions: beforePerms },
            afterData: { permissions: afterPerms },
            operatorId: testOperatorId,
          }

          await auditService.logPermissionChange(record)

          const history = await auditService.getPermissionHistory('position', entityId, { limit: 1 })
          expect(history.length).toBeGreaterThanOrEqual(1)

          const logged = history[0]
          expect(logged.action).toBe('permission_update')
          expect(logged.entityType).toBe('position')

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Validates: Requirements 4.2 - Employee position changes are recorded
   */
  it('should record employee position changes with correct action', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        async (entityId, oldPositionId, newPositionId) => {
          const record: PermissionChangeRecord = {
            changeType: 'employee_position_change',
            entityType: 'employee',
            entityId,
            beforeData: { positionId: oldPositionId },
            afterData: { positionId: newPositionId },
            operatorId: testOperatorId,
          }

          await auditService.logPermissionChange(record)

          const history = await auditService.getPermissionHistory('employee', entityId, { limit: 1 })
          expect(history.length).toBeGreaterThanOrEqual(1)

          const logged = history[0]
          expect(logged.action).toBe('position_change')
          expect(logged.entityType).toBe('employee')

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Validates: Requirements 4.3 - Department module changes are recorded
   */
  it('should record department module changes with correct action', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.array(moduleNameArb, { minLength: 0, maxLength: 5 }),
        fc.array(moduleNameArb, { minLength: 0, maxLength: 5 }),
        async (entityId, beforeModules, afterModules) => {
          const record: PermissionChangeRecord = {
            changeType: 'department_module_update',
            entityType: 'org_department',
            entityId,
            beforeData: { allowedModules: beforeModules },
            afterData: { allowedModules: afterModules },
            operatorId: testOperatorId,
          }

          await auditService.logPermissionChange(record)

          const history = await auditService.getPermissionHistory('org_department', entityId, { limit: 1 })
          expect(history.length).toBeGreaterThanOrEqual(1)

          const logged = history[0]
          expect(logged.action).toBe('module_update')
          expect(logged.entityType).toBe('org_department')

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Validates: Requirements 4.4 - Context information (IP, memo) is recorded
   */
  it('should record context information (IP, memo) when provided', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        ipAddressArb,
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        async (entityId, ip, customMemo) => {
          const record: PermissionChangeRecord = {
            changeType: 'position_permission_update',
            entityType: 'position',
            entityId,
            beforeData: null,
            afterData: { permissions: {} },
            operatorId: testOperatorId,
            ip,
            memo: customMemo,
          }

          await auditService.logPermissionChange(record)

          const history = await auditService.getPermissionHistory('position', entityId, { limit: 1 })
          expect(history.length).toBeGreaterThanOrEqual(1)

          const logged = history[0]
          // Memo should contain the IP and custom memo
          expect(logged.memo).toBeDefined()
          expect(logged.memo).toContain(ip)
          expect(logged.memo).toContain(customMemo)

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Validates: Requirements 4.4 - Operator name is resolved and recorded
   */
  it('should resolve and record operator name', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        changeTypeArb,
        async (entityId, changeType) => {
          const record: PermissionChangeRecord = {
            changeType,
            entityType: 'position',
            entityId,
            beforeData: null,
            afterData: { permissions: {} },
            operatorId: testOperatorId,
            // Don't provide operatorName - it should be resolved
          }

          await auditService.logPermissionChange(record)

          const history = await auditService.getPermissionHistory('position', entityId, { limit: 1 })
          expect(history.length).toBeGreaterThanOrEqual(1)

          const logged = history[0]
          // Operator name should be resolved from the database
          expect(logged.operatorName).toBe('Test Operator')

          return true
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ============================================================================
// diffPermissions Static Method Tests
// ============================================================================

describe('diffPermissions Method Correctness', () => {
  /**
   * Empty before and after should produce empty diff
   */
  it('should produce empty diff for empty inputs', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const diff = PermissionAuditService.diffPermissions(null, null)

        expect(diff.added).toEqual({})
        expect(diff.removed).toEqual({})
        expect(diff.changed).toEqual({})

        return true
      }),
      { numRuns: 10 }
    )
  })

  /**
   * Adding a new module should be detected as 'added'
   */
  it('should detect added modules', () => {
    fc.assert(
      fc.property(
        moduleNameArb,
        subModuleNameArb,
        fc.array(actionNameArb, { minLength: 1, maxLength: 3 }),
        (module, subModule, actions) => {
          const before: Record<string, Record<string, string[]>> = {}
          const after: Record<string, Record<string, string[]>> = {
            [module]: { [subModule]: actions },
          }

          const diff = PermissionAuditService.diffPermissions(before, after)

          expect(diff.added[module]).toBeDefined()
          expect(diff.added[module][subModule]).toEqual(actions)
          expect(diff.removed).toEqual({})

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Removing a module should be detected as 'removed'
   */
  it('should detect removed modules', () => {
    fc.assert(
      fc.property(
        moduleNameArb,
        subModuleNameArb,
        fc.array(actionNameArb, { minLength: 1, maxLength: 3 }),
        (module, subModule, actions) => {
          const before: Record<string, Record<string, string[]>> = {
            [module]: { [subModule]: actions },
          }
          const after: Record<string, Record<string, string[]>> = {}

          const diff = PermissionAuditService.diffPermissions(before, after)

          expect(diff.removed[module]).toBeDefined()
          expect(diff.removed[module][subModule]).toEqual(actions)
          expect(diff.added).toEqual({})

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Changing actions within a module should be detected as 'changed'
   */
  it('should detect changed actions within modules', () => {
    fc.assert(
      fc.property(
        moduleNameArb,
        subModuleNameArb,
        (module, subModule) => {
          const before: Record<string, Record<string, string[]>> = {
            [module]: { [subModule]: ['view'] },
          }
          const after: Record<string, Record<string, string[]>> = {
            [module]: { [subModule]: ['view', 'create'] },
          }

          const diff = PermissionAuditService.diffPermissions(before, after)

          expect(diff.changed[module]).toBeDefined()
          expect(diff.changed[module].before[subModule]).toEqual(['view'])
          expect(diff.changed[module].after[subModule]).toEqual(['view', 'create'])

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Identical permissions should produce empty diff
   */
  it('should produce empty diff for identical permissions', () => {
    fc.assert(
      fc.property(permissionsArb, (permissions) => {
        // Deep clone to ensure we're comparing equal but different objects
        const before = JSON.parse(JSON.stringify(permissions))
        const after = JSON.parse(JSON.stringify(permissions))

        const diff = PermissionAuditService.diffPermissions(before, after)

        expect(diff.added).toEqual({})
        expect(diff.removed).toEqual({})
        expect(diff.changed).toEqual({})

        return true
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Diff should be symmetric: swapping before/after should swap added/removed
   */
  it('should be symmetric - swapping before/after swaps added/removed', () => {
    fc.assert(
      fc.property(
        permissionsArb,
        permissionsArb,
        (perms1, perms2) => {
          const diff1 = PermissionAuditService.diffPermissions(perms1, perms2)
          const diff2 = PermissionAuditService.diffPermissions(perms2, perms1)

          // Added in diff1 should be removed in diff2
          expect(Object.keys(diff1.added).sort()).toEqual(Object.keys(diff2.removed).sort())
          // Removed in diff1 should be added in diff2
          expect(Object.keys(diff1.removed).sort()).toEqual(Object.keys(diff2.added).sort())

          return true
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ============================================================================
// getPermissionHistory Query Tests
// ============================================================================

describe('getPermissionHistory Query Correctness', () => {
  let db: ReturnType<typeof createDb>
  let auditService: PermissionAuditService
  const testOperatorId = 'test-operator-002'

  beforeEach(async () => {
    db = createDb(env.DB)
    await applySchema(env.DB)
    auditService = new PermissionAuditService(db)

    await db
      .insert(employees)
      .values({
        id: testOperatorId,
        email: 'operator2@example.com',
        name: 'Test Operator 2',
        joinDate: '2023-01-01',
        status: 'regular',
        active: 1,
      })
      .run()
  })

  /**
   * Query should return records in descending order by timestamp
   */
  it('should return records in descending order by timestamp', async () => {
    const entityId = 'test-entity-order'

    // Create multiple records with delays
    for (let i = 0; i < 3; i++) {
      await auditService.logPermissionChange({
        changeType: 'position_permission_update',
        entityType: 'position',
        entityId,
        beforeData: { index: i },
        afterData: { index: i + 1 },
        operatorId: testOperatorId,
      })
      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10))
    }

    const history = await auditService.getPermissionHistory('position', entityId)

    expect(history.length).toBe(3)
    // Should be in descending order (newest first)
    for (let i = 0; i < history.length - 1; i++) {
      expect(history[i].createdAt).toBeGreaterThanOrEqual(history[i + 1].createdAt)
    }
  })

  /**
   * Query should respect limit parameter
   */
  it('should respect limit parameter', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }),
        async (limit) => {
          const entityId = `test-entity-limit-${limit}-${Date.now()}`

          // Create more records than the limit
          for (let i = 0; i < limit + 5; i++) {
            await auditService.logPermissionChange({
              changeType: 'position_permission_update',
              entityType: 'position',
              entityId,
              beforeData: { index: i },
              afterData: { index: i + 1 },
              operatorId: testOperatorId,
            })
          }

          const history = await auditService.getPermissionHistory('position', entityId, { limit })

          expect(history.length).toBe(limit)

          return true
        }
      ),
      { numRuns: 5 } // Reduced runs due to database operations
    )
  })

  /**
   * Query should filter by entityType and entityId correctly
   */
  it('should filter by entityType and entityId correctly', async () => {
    const entityId1 = 'test-entity-filter-1'
    const entityId2 = 'test-entity-filter-2'

    // Create records for different entities
    await auditService.logPermissionChange({
      changeType: 'position_permission_update',
      entityType: 'position',
      entityId: entityId1,
      beforeData: null,
      afterData: { permissions: {} },
      operatorId: testOperatorId,
    })

    await auditService.logPermissionChange({
      changeType: 'employee_position_change',
      entityType: 'employee',
      entityId: entityId2,
      beforeData: null,
      afterData: { positionId: 'new-pos' },
      operatorId: testOperatorId,
    })

    // Query for entity1
    const history1 = await auditService.getPermissionHistory('position', entityId1)
    expect(history1.length).toBe(1)
    expect(history1[0].entityId).toBe(entityId1)
    expect(history1[0].entityType).toBe('position')

    // Query for entity2
    const history2 = await auditService.getPermissionHistory('employee', entityId2)
    expect(history2.length).toBe(1)
    expect(history2[0].entityId).toBe(entityId2)
    expect(history2[0].entityType).toBe('employee')
  })
})
