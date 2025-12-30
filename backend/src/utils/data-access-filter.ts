/**
 * Data Access Filter - 数据访问过滤器
 * 根据用户数据范围生成 SQL 过滤条件
 */

import { sql, SQL, and, eq, or } from 'drizzle-orm'
import type { DataScopeType } from '../constants/permissions.js'
import { DataScope } from '../constants/permissions.js'

/**
 * 字段映射配置
 */
export interface FieldMapping {
  /** 员工ID字段名，默认 'employeeId' */
  employeeId?: string
  /** 项目ID字段名，默认 'projectId' */
  projectId?: string
  /** 部门ID字段名，默认 'orgDepartmentId' */
  orgDepartmentId?: string
  /** 创建人字段名，默认 'createdBy' */
  createdBy?: string
}

/**
 * 用户信息
 */
export interface DataAccessUser {
  /** 用户员工ID */
  id: string
  /** 用户所属项目ID */
  projectId: string | null
  /** 用户所属组织部门ID */
  orgDepartmentId: string | null
}

/**
 * 数据访问过滤器配置
 */
export interface DataAccessFilterConfig {
  /** 数据范围 */
  dataScope: DataScopeType
  /** 当前用户信息 */
  user: DataAccessUser
  /** 字段映射 */
  fieldMapping?: FieldMapping
  /** self 模式下使用的字段，默认 'employeeId' */
  selfField?: 'employeeId' | 'createdBy'
  /** 表别名（用于 JOIN 查询） */
  tableAlias?: string
  /** 是否跳过组织部门检查（用于没有 orgDept 字段的表） */
  skipOrgDept?: boolean
}

/**
 * 默认字段映射
 */
const DEFAULT_FIELD_MAPPING: Required<FieldMapping> = {
  employeeId: 'employeeId',
  projectId: 'projectId',
  orgDepartmentId: 'orgDepartmentId',
  createdBy: 'createdBy',
}

/**
 * 验证列名（防止 SQL 注入）
 * 确保列名只包含字母、数字和下划线
 */
function validateColumnName(name: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error(`Invalid column name: ${name}`)
  }
  return name
}

/**
 * 构建带表别名的列名
 */
function buildColumnRef(columnName: string, tableAlias?: string): string {
  const validatedColumn = validateColumnName(columnName)
  if (tableAlias) {
    return `${validateColumnName(tableAlias)}.${validatedColumn}`
  }
  return validatedColumn
}

/**
 * 生成数据访问过滤条件
 * 
 * @param config 过滤器配置
 * @returns SQL 条件，如果是 'all' 范围则返回 undefined（表示不过滤）
 * 
 * @example
 * // 基本用法
 * const filter = createDataAccessFilter({
 *   dataScope: 'project',
 *   user: { id: '123', projectId: 'proj-1', orgDepartmentId: null }
 * })
 * // 返回: projectId = 'proj-1'
 * 
 * @example
 * // 自定义字段映射
 * const filter = createDataAccessFilter({
 *   dataScope: 'self',
 *   user: { id: '123', projectId: null, orgDepartmentId: null },
 *   fieldMapping: { employeeId: 'owner_id' },
 *   selfField: 'employeeId'
 * })
 * // 返回: owner_id = '123'
 */
export function createDataAccessFilter(
  config: DataAccessFilterConfig
): SQL | undefined {
  const {
    dataScope,
    user,
    fieldMapping = {},
    selfField = 'employeeId',
    tableAlias,
    skipOrgDept = false,
  } = config

  // 合并字段映射
  const mapping: Required<FieldMapping> = {
    ...DEFAULT_FIELD_MAPPING,
    ...fieldMapping,
  }

  switch (dataScope) {
    case DataScope.ALL:
      // 'all' 范围不需要过滤
      return undefined

    case DataScope.PROJECT: {
      if (!user.projectId) {
        // 用户没有项目ID，返回不匹配任何数据的条件
        return sql`1=0`
      }
      const projectCol = buildColumnRef(mapping.projectId, tableAlias)
      return sql`${sql.raw(projectCol)} = ${user.projectId}`
    }

    case DataScope.GROUP: {
      if (skipOrgDept) {
        // 如果表没有 orgDept 字段，降级为 SELF
        const ownerCol = buildColumnRef(mapping.employeeId, tableAlias)
        return sql`${sql.raw(ownerCol)} = ${user.id}`
      }
      if (!user.orgDepartmentId) {
        // 用户没有组织部门ID，返回不匹配任何数据的条件
        return sql`1=0`
      }
      const orgDeptCol = buildColumnRef(mapping.orgDepartmentId, tableAlias)
      return sql`${sql.raw(orgDeptCol)} = ${user.orgDepartmentId}`
    }

    case DataScope.SELF:
    default: {
      const fieldName = selfField === 'createdBy' ? mapping.createdBy : mapping.employeeId
      const selfCol = buildColumnRef(fieldName, tableAlias)
      return sql`${sql.raw(selfCol)} = ${user.id}`
    }
  }
}

/**
 * 创建数据访问过滤条件（返回 SQL 或 1=1）
 * 与 createDataAccessFilter 不同，此函数总是返回有效的 SQL 条件
 * 
 * @param config 过滤器配置
 * @returns SQL 条件（'all' 范围返回 1=1）
 */
export function createDataAccessFilterSQL(
  config: DataAccessFilterConfig
): SQL {
  const filter = createDataAccessFilter(config)
  return filter ?? sql`1=1`
}

/**
 * 从 PermissionContext 创建数据访问过滤器配置
 * 便捷函数，用于从权限上下文快速创建过滤器
 */
export interface PermissionContextLike {
  dataScope: DataScopeType
  employee: {
    id: string
    projectId: string | null
    orgDepartmentId: string | null
  }
}

/**
 * 从权限上下文创建数据访问过滤条件
 * 
 * @param ctx 权限上下文（或类似对象）
 * @param options 额外配置选项
 * @returns SQL 条件或 undefined
 */
export function createFilterFromContext(
  ctx: PermissionContextLike,
  options?: Omit<DataAccessFilterConfig, 'dataScope' | 'user'>
): SQL | undefined {
  return createDataAccessFilter({
    dataScope: ctx.dataScope,
    user: {
      id: ctx.employee.id,
      projectId: ctx.employee.projectId,
      orgDepartmentId: ctx.employee.orgDepartmentId,
    },
    ...options,
  })
}

/**
 * 组合多个过滤条件（AND 逻辑）
 * 
 * @param filters 过滤条件数组
 * @returns 组合后的 SQL 条件
 */
export function combineFilters(...filters: (SQL | undefined)[]): SQL | undefined {
  const validFilters = filters.filter((f): f is SQL => f !== undefined)
  if (validFilters.length === 0) return undefined
  if (validFilters.length === 1) return validFilters[0]
  return sql.join(validFilters, sql` AND `)
}

/**
 * 为 Drizzle 查询添加数据访问过滤
 * 这是一个类型安全的辅助函数，用于在查询中添加数据范围过滤
 * 
 * @param baseCondition 基础查询条件
 * @param config 数据访问过滤器配置
 * @returns 组合后的查询条件
 */
export function withDataAccessFilter(
  baseCondition: SQL | undefined,
  config: DataAccessFilterConfig
): SQL | undefined {
  const accessFilter = createDataAccessFilter(config)
  return combineFilters(baseCondition, accessFilter)
}
