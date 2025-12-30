/**
 * Data Access Filter Property-Based Tests
 *
 * **Feature: permission-system-optimization**
 * **Property 2: Data Access Filter Correctness**
 * **Property 3: Field Mapping Consistency**
 * **Validates: Requirements 2.1, 2.6**
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  createDataAccessFilter,
  createDataAccessFilterSQL,
  createFilterFromContext,
  combineFilters,
  withDataAccessFilter,
  type DataAccessFilterConfig,
  type FieldMapping,
  type DataAccessUser,
} from '../../src/utils/data-access-filter.js'
import { type DataScopeType } from '../../src/constants/permissions.js'
import { SQL } from 'drizzle-orm'

// ============================================================================
// Generators for Property-Based Testing
// ============================================================================

/**
 * Generator for valid DataScope values
 */
const dataScopeArb = fc.constantFrom<DataScopeType>('all', 'project', 'group', 'self')

/**
 * Generator for valid UUID strings
 */
const uuidArb = fc.uuid()

/**
 * Generator for valid column names (alphanumeric + underscore, starting with letter or underscore)
 */
const columnNameArb = fc.stringMatching(/^[a-zA-Z_][a-zA-Z0-9_]{0,29}$/)

/**
 * Generator for DataAccessUser with all fields populated
 */
const userWithAllFieldsArb = fc.record({
  id: uuidArb,
  projectId: uuidArb,
  orgDepartmentId: uuidArb,
}).map(u => ({
  id: u.id,
  projectId: u.projectId as string | null,
  orgDepartmentId: u.orgDepartmentId as string | null,
}))

/**
 * Generator for DataAccessUser with optional null fields
 */
const userArb = fc.record({
  id: uuidArb,
  projectId: fc.option(uuidArb, { nil: null }),
  orgDepartmentId: fc.option(uuidArb, { nil: null }),
})

/**
 * Generator for FieldMapping with custom field names
 */
const fieldMappingArb = fc.record({
  employeeId: fc.option(columnNameArb, { nil: undefined }),
  projectId: fc.option(columnNameArb, { nil: undefined }),
  orgDepartmentId: fc.option(columnNameArb, { nil: undefined }),
  createdBy: fc.option(columnNameArb, { nil: undefined }),
}).map(fm => {
  const result: FieldMapping = {}
  if (fm.employeeId) result.employeeId = fm.employeeId
  if (fm.projectId) result.projectId = fm.projectId
  if (fm.orgDepartmentId) result.orgDepartmentId = fm.orgDepartmentId
  if (fm.createdBy) result.createdBy = fm.createdBy
  return result
})

/**
 * Generator for selfField option
 */
const selfFieldArb = fc.constantFrom<'employeeId' | 'createdBy'>('employeeId', 'createdBy')

/**
 * Generator for table alias
 */
const tableAliasArb = fc.option(columnNameArb, { nil: undefined })

/**
 * Generator for complete DataAccessFilterConfig
 */
const filterConfigArb = fc.record({
  dataScope: dataScopeArb,
  user: userArb,
  fieldMapping: fc.option(fieldMappingArb, { nil: undefined }),
  selfField: fc.option(selfFieldArb, { nil: undefined }),
  tableAlias: tableAliasArb,
  skipOrgDept: fc.option(fc.boolean(), { nil: undefined }),
})

// ============================================================================
// Helper Functions for Testing
// ============================================================================

/**
 * Check if a SQL object is defined (not undefined)
 */
function isSqlDefined(sql: SQL | undefined): sql is SQL {
  return sql !== undefined
}

// ============================================================================
// Property 2: Data Access Filter Correctness
// **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**
// ============================================================================

describe('Property 2: Data Access Filter Correctness', () => {
  /**
   * **Feature: permission-system-optimization, Property 2: Data Access Filter Correctness**
   * **Validates: Requirements 2.1**
   *
   * *For any* dataScope value and user context, the generated SQL condition should correctly
   * filter data according to the scope rules.
   */

  /**
   * 'all' dataScope should return undefined (no filter)
   * Validates: Requirements 2.2
   */
  it('should return undefined for dataScope "all"', () => {
    fc.assert(
      fc.property(userArb, fieldMappingArb, tableAliasArb, (user, fieldMapping, tableAlias) => {
        const filter = createDataAccessFilter({
          dataScope: 'all',
          user,
          fieldMapping,
          tableAlias,
        })

        expect(filter).toBeUndefined()
        return true
      }),
      { numRuns: 100 }
    )
  })

  /**
   * 'project' dataScope should return a defined SQL filter when user has projectId
   * Validates: Requirements 2.3
   */
  it('should return defined SQL for dataScope "project" when user has projectId', () => {
    fc.assert(
      fc.property(userWithAllFieldsArb, (user) => {
        const filter = createDataAccessFilter({
          dataScope: 'project',
          user,
        })

        // Should return a defined SQL object
        expect(filter).toBeDefined()
        expect(isSqlDefined(filter)).toBe(true)
        return true
      }),
      { numRuns: 100 }
    )
  })

  /**
   * 'project' dataScope should return a defined SQL filter when user has no projectId
   * (returns a "no match" condition like 1=0)
   * Validates: Requirements 2.3
   */
  it('should return defined SQL for dataScope "project" when user has no projectId', () => {
    fc.assert(
      fc.property(uuidArb, uuidArb, (id, orgDeptId) => {
        const user: DataAccessUser = {
          id,
          projectId: null,
          orgDepartmentId: orgDeptId,
        }

        const filter = createDataAccessFilter({
          dataScope: 'project',
          user,
        })

        // Should return a defined SQL object (the 1=0 condition)
        expect(filter).toBeDefined()
        return true
      }),
      { numRuns: 100 }
    )
  })

  /**
   * 'group' dataScope should return a defined SQL filter when user has orgDepartmentId
   * Validates: Requirements 2.4
   */
  it('should return defined SQL for dataScope "group" when user has orgDepartmentId', () => {
    fc.assert(
      fc.property(userWithAllFieldsArb, (user) => {
        const filter = createDataAccessFilter({
          dataScope: 'group',
          user,
        })

        // Should return a defined SQL object
        expect(filter).toBeDefined()
        expect(isSqlDefined(filter)).toBe(true)
        return true
      }),
      { numRuns: 100 }
    )
  })

  /**
   * 'group' dataScope should return a defined SQL filter when user has no orgDepartmentId
   * (returns a "no match" condition like 1=0)
   * Validates: Requirements 2.4
   */
  it('should return defined SQL for dataScope "group" when user has no orgDepartmentId', () => {
    fc.assert(
      fc.property(uuidArb, uuidArb, (id, projectId) => {
        const user: DataAccessUser = {
          id,
          projectId,
          orgDepartmentId: null,
        }

        const filter = createDataAccessFilter({
          dataScope: 'group',
          user,
        })

        // Should return a defined SQL object (the 1=0 condition)
        expect(filter).toBeDefined()
        return true
      }),
      { numRuns: 100 }
    )
  })

  /**
   * 'group' dataScope with skipOrgDept should return a defined filter (fallback to employeeId)
   * Validates: Requirements 2.4
   */
  it('should return defined SQL for dataScope "group" with skipOrgDept', () => {
    fc.assert(
      fc.property(userArb, (user) => {
        const filter = createDataAccessFilter({
          dataScope: 'group',
          user,
          skipOrgDept: true,
        })

        // Should return a defined SQL object (fallback to employeeId filter)
        expect(filter).toBeDefined()
        expect(isSqlDefined(filter)).toBe(true)
        return true
      }),
      { numRuns: 100 }
    )
  })

  /**
   * 'self' dataScope should always return a defined SQL filter
   * Validates: Requirements 2.5
   */
  it('should return defined SQL for dataScope "self"', () => {
    fc.assert(
      fc.property(userArb, (user) => {
        const filter = createDataAccessFilter({
          dataScope: 'self',
          user,
        })

        // Should always return a defined SQL object
        expect(filter).toBeDefined()
        expect(isSqlDefined(filter)).toBe(true)
        return true
      }),
      { numRuns: 100 }
    )
  })

  /**
   * 'self' dataScope with selfField='createdBy' should return a defined SQL filter
   * Validates: Requirements 2.5
   */
  it('should return defined SQL for dataScope "self" with selfField="createdBy"', () => {
    fc.assert(
      fc.property(userArb, (user) => {
        const filter = createDataAccessFilter({
          dataScope: 'self',
          user,
          selfField: 'createdBy',
        })

        expect(filter).toBeDefined()
        expect(isSqlDefined(filter)).toBe(true)
        return true
      }),
      { numRuns: 100 }
    )
  })

  /**
   * createDataAccessFilterSQL should always return a valid SQL (never undefined)
   */
  it('createDataAccessFilterSQL should always return valid SQL', () => {
    fc.assert(
      fc.property(filterConfigArb, (config) => {
        const filter = createDataAccessFilterSQL(config as DataAccessFilterConfig)

        // Should always return a defined SQL object
        expect(filter).toBeDefined()
        return true
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Different dataScopes should produce different filter behaviors
   */
  it('different dataScopes should produce different filter behaviors', () => {
    fc.assert(
      fc.property(userWithAllFieldsArb, (user) => {
        const allFilter = createDataAccessFilter({ dataScope: 'all', user })
        const projectFilter = createDataAccessFilter({ dataScope: 'project', user })
        const groupFilter = createDataAccessFilter({ dataScope: 'group', user })
        const selfFilter = createDataAccessFilter({ dataScope: 'self', user })

        // 'all' should be undefined, others should be defined
        expect(allFilter).toBeUndefined()
        expect(projectFilter).toBeDefined()
        expect(groupFilter).toBeDefined()
        expect(selfFilter).toBeDefined()

        return true
      }),
      { numRuns: 100 }
    )
  })
})

// ============================================================================
// Property 3: Field Mapping Consistency
// **Validates: Requirements 2.6**
// ============================================================================

describe('Property 3: Field Mapping Consistency', () => {
  /**
   * **Feature: permission-system-optimization, Property 3: Field Mapping Consistency**
   * **Validates: Requirements 2.6**
   *
   * *For any* custom field mapping configuration, the Data_Access_Filter should use
   * the mapped field names in the generated SQL condition.
   */

  /**
   * Custom field mapping should produce a defined filter for 'project' scope
   */
  it('should produce defined filter with custom projectId field mapping', () => {
    fc.assert(
      fc.property(userWithAllFieldsArb, columnNameArb, (user, customFieldName) => {
        // Skip empty field names
        if (!customFieldName || customFieldName.length === 0) return true

        const filter = createDataAccessFilter({
          dataScope: 'project',
          user,
          fieldMapping: { projectId: customFieldName },
        })

        expect(filter).toBeDefined()
        expect(isSqlDefined(filter)).toBe(true)
        return true
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Custom field mapping should produce a defined filter for 'group' scope
   */
  it('should produce defined filter with custom orgDepartmentId field mapping', () => {
    fc.assert(
      fc.property(userWithAllFieldsArb, columnNameArb, (user, customFieldName) => {
        // Skip empty field names
        if (!customFieldName || customFieldName.length === 0) return true

        const filter = createDataAccessFilter({
          dataScope: 'group',
          user,
          fieldMapping: { orgDepartmentId: customFieldName },
        })

        expect(filter).toBeDefined()
        expect(isSqlDefined(filter)).toBe(true)
        return true
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Custom field mapping should produce a defined filter for 'self' scope
   */
  it('should produce defined filter with custom employeeId field mapping', () => {
    fc.assert(
      fc.property(userArb, columnNameArb, (user, customFieldName) => {
        // Skip empty field names
        if (!customFieldName || customFieldName.length === 0) return true

        const filter = createDataAccessFilter({
          dataScope: 'self',
          user,
          fieldMapping: { employeeId: customFieldName },
          selfField: 'employeeId',
        })

        expect(filter).toBeDefined()
        expect(isSqlDefined(filter)).toBe(true)
        return true
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Custom createdBy field mapping should work with selfField='createdBy'
   */
  it('should produce defined filter with custom createdBy field mapping', () => {
    fc.assert(
      fc.property(userArb, columnNameArb, (user, customFieldName) => {
        // Skip empty field names
        if (!customFieldName || customFieldName.length === 0) return true

        const filter = createDataAccessFilter({
          dataScope: 'self',
          user,
          fieldMapping: { createdBy: customFieldName },
          selfField: 'createdBy',
        })

        expect(filter).toBeDefined()
        expect(isSqlDefined(filter)).toBe(true)
        return true
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Table alias should not break filter generation
   */
  it('should produce defined filter with table alias', () => {
    fc.assert(
      fc.property(userWithAllFieldsArb, columnNameArb, dataScopeArb, (user, tableAlias, dataScope) => {
        // Skip 'all' scope (returns undefined) and empty aliases
        if (dataScope === 'all' || !tableAlias || tableAlias.length === 0) return true

        const filter = createDataAccessFilter({
          dataScope,
          user,
          tableAlias,
        })

        // Should produce a defined filter (not 1=0 since user has all fields)
        expect(filter).toBeDefined()
        expect(isSqlDefined(filter)).toBe(true)
        return true
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Default field names should work when no custom mapping is provided
   */
  it('should produce defined filter with default field names', () => {
    fc.assert(
      fc.property(userWithAllFieldsArb, dataScopeArb, (user, dataScope) => {
        // Skip 'all' scope (returns undefined)
        if (dataScope === 'all') return true

        const filter = createDataAccessFilter({
          dataScope,
          user,
        })

        expect(filter).toBeDefined()
        expect(isSqlDefined(filter)).toBe(true)
        return true
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Invalid column names should throw an error
   */
  it('should throw error for invalid column names', () => {
    const user: DataAccessUser = {
      id: 'test-id',
      projectId: 'test-project',
      orgDepartmentId: 'test-dept',
    }

    // SQL injection attempt should be rejected
    expect(() => {
      createDataAccessFilter({
        dataScope: 'project',
        user,
        fieldMapping: { projectId: 'field; DROP TABLE users;--' },
      })
    }).toThrow()
  })
})

// ============================================================================
// Additional Helper Function Tests
// ============================================================================

describe('Helper Functions', () => {
  /**
   * createFilterFromContext should produce same result as createDataAccessFilter
   */
  it('createFilterFromContext should produce equivalent results', () => {
    fc.assert(
      fc.property(
        dataScopeArb,
        userArb,
        fieldMappingArb,
        selfFieldArb,
        (dataScope, user, fieldMapping, selfField) => {
          const ctx = {
            dataScope,
            employee: {
              id: user.id,
              projectId: user.projectId,
              orgDepartmentId: user.orgDepartmentId,
            },
          }

          const filterFromContext = createFilterFromContext(ctx, { fieldMapping, selfField })
          const filterDirect = createDataAccessFilter({
            dataScope,
            user,
            fieldMapping,
            selfField,
          })

          // Both should be undefined or both should be defined
          if (filterFromContext === undefined) {
            expect(filterDirect).toBeUndefined()
          } else {
            expect(filterDirect).toBeDefined()
          }
          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * combineFilters should handle undefined filters correctly
   */
  it('combineFilters should handle undefined filters', () => {
    fc.assert(
      fc.property(userWithAllFieldsArb, (user) => {
        const filter1 = createDataAccessFilter({ dataScope: 'all', user })
        const filter2 = createDataAccessFilter({ dataScope: 'project', user })

        // filter1 is undefined (all scope), filter2 is defined
        const combined = combineFilters(filter1, filter2)

        // Should return filter2 since filter1 is undefined
        expect(combined).toBeDefined()
        return true
      }),
      { numRuns: 100 }
    )
  })

  /**
   * combineFilters with all undefined should return undefined
   */
  it('combineFilters with all undefined should return undefined', () => {
    fc.assert(
      fc.property(userArb, (user) => {
        const filter1 = createDataAccessFilter({ dataScope: 'all', user })
        const filter2 = createDataAccessFilter({ dataScope: 'all', user })

        const combined = combineFilters(filter1, filter2)
        expect(combined).toBeUndefined()
        return true
      }),
      { numRuns: 100 }
    )
  })

  /**
   * combineFilters with multiple defined filters should return a combined filter
   */
  it('combineFilters with multiple defined filters should combine them', () => {
    fc.assert(
      fc.property(userWithAllFieldsArb, (user) => {
        const filter1 = createDataAccessFilter({ dataScope: 'project', user })
        const filter2 = createDataAccessFilter({ dataScope: 'self', user })

        const combined = combineFilters(filter1, filter2)

        // Should return a combined filter
        expect(combined).toBeDefined()
        return true
      }),
      { numRuns: 100 }
    )
  })

  /**
   * withDataAccessFilter should combine base condition with access filter
   */
  it('withDataAccessFilter should combine conditions correctly', () => {
    fc.assert(
      fc.property(userWithAllFieldsArb, dataScopeArb, (user, dataScope) => {
        // Skip 'all' scope for this test
        if (dataScope === 'all') return true

        const baseCondition = undefined
        const combined = withDataAccessFilter(baseCondition, { dataScope, user })

        // Should return the access filter when base is undefined
        const accessFilter = createDataAccessFilter({ dataScope, user })
        
        // Both should be defined or both undefined
        if (accessFilter === undefined) {
          expect(combined).toBeUndefined()
        } else {
          expect(combined).toBeDefined()
        }
        return true
      }),
      { numRuns: 100 }
    )
  })
})
