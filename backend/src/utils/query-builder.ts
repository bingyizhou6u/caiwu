import { DrizzleD1Database } from 'drizzle-orm/d1'
import { eq, and, inArray, SQL } from 'drizzle-orm'
import * as schema from '../db/schema.js'
import { Logger } from './logger.js'
import {
  employees,
  projects,
  orgDepartments,
  positions,
  currencies,
  vendors,
  sites,
} from '../db/schema.js'

/**
 * 通用查询构建器工具类
 * 封装常用的查询模式，减少重复代码
 */
export class QueryBuilder {
  /**
   * 构建员工关联查询（已废弃）
   * 
   * @deprecated 此方法使用多个 LEFT JOIN，违反 D1 兼容性规范。
   * 请使用 buildEmployeeRelatedData 方法进行顺序查询。
   * 
   * 自动关联员工、部门、组织部门、职位表
   */
  static buildEmployeeJoinQuery<T extends { employeeId: any }, TSelect extends Record<string, any>>(
    db: DrizzleD1Database<typeof schema>,
    baseTable: any,
    employeeIdField: any,
    selectFields: TSelect
  ) {
    // 警告：此方法使用多个 JOIN，在 D1 中可能不稳定
    // 建议使用 buildEmployeeRelatedData 代替
    Logger.warn(
      '[QueryBuilder] buildEmployeeJoinQuery is deprecated. ' +
      'Use buildEmployeeRelatedData instead for D1 compatibility.'
    )
    return db
      .select({
        ...selectFields,
        employeeName: employees.name,
        employeeEmail: employees.email,
        departmentName: projects.name,
        orgDepartmentName: orgDepartments.name,
        positionName: positions.name,
      })
      .from(baseTable)
      .leftJoin(employees, eq(employees.id, employeeIdField))
      .leftJoin(projects, eq(projects.id, employees.projectId))
      .leftJoin(orgDepartments, eq(orgDepartments.id, employees.orgDepartmentId))
      .leftJoin(positions, eq(positions.id, employees.positionId))
  }

  /**
   * 批量获取员工关联数据（D1 兼容）
   * 使用顺序查询代替复杂 JOIN，避免 D1 不稳定问题
   * 
   * @param db 数据库实例
   * @param employeeIds 员工ID数组
   * @returns 包含员工、部门、组织部门、职位信息的映射表
   */
  static async buildEmployeeRelatedData(
    db: DrizzleD1Database<typeof schema>,
    employeeIds: string[]
  ): Promise<{
    employees: Map<string, { id: string; name: string | null; email: string | null; projectId: string | null; orgDepartmentId: string | null; positionId: string | null }>
    projects: Map<string, { id: string; name: string | null }>
    orgDepartments: Map<string, { id: string; name: string | null }>
    positions: Map<string, { id: string; name: string | null }>
  }> {
    if (employeeIds.length === 0) {
      return {
        employees: new Map(),
        projects: new Map(),
        orgDepartments: new Map(),
        positions: new Map(),
      }
    }

    // 1. 批量查询员工信息
    const employeesList = await db
      .select({
        id: employees.id,
        name: employees.name,
        email: employees.email,
        projectId: employees.projectId,
        orgDepartmentId: employees.orgDepartmentId,
        positionId: employees.positionId,
      })
      .from(employees)
      .where(inArray(employees.id, employeeIds))
      .execute()

    // 2. 收集关联ID
    const deptIds = [...new Set(employeesList.map(e => e.projectId).filter(Boolean) as string[])]
    const orgDeptIds = [...new Set(employeesList.map(e => e.orgDepartmentId).filter(Boolean) as string[])]
    const positionIds = [...new Set(employeesList.map(e => e.positionId).filter(Boolean) as string[])]

    // 3. 并行查询关联数据
    const [projectsList, orgDepartmentsList, positionsList] = await Promise.all([
      deptIds.length > 0
        ? db
          .select({ id: projects.id, name: projects.name })
          .from(projects)
          .where(inArray(projects.id, deptIds))
          .execute()
        : Promise.resolve([]),
      orgDeptIds.length > 0
        ? db
          .select({ id: orgDepartments.id, name: orgDepartments.name })
          .from(orgDepartments)
          .where(inArray(orgDepartments.id, orgDeptIds))
          .execute()
        : Promise.resolve([]),
      positionIds.length > 0
        ? db
          .select({ id: positions.id, name: positions.name })
          .from(positions)
          .where(inArray(positions.id, positionIds))
          .execute()
        : Promise.resolve([]),
    ])

    // 4. 创建映射表
    return {
      employees: new Map(employeesList.map(e => [e.id, e])),
      projects: new Map(projectsList.map(d => [d.id, d])),
      orgDepartments: new Map(orgDepartmentsList.map(od => [od.id, od])),
      positions: new Map(positionsList.map(p => [p.id, p])),
    }
  }

  /**
   * 批量获取关联数据
   * 并行查询多个关联表，提高性能
   */
  static async fetchRelatedData(
    db: DrizzleD1Database<typeof schema>,
    ids: {
      projectIds?: string[]
      employeeIds?: string[]
      currencyIds?: string[]
      vendorIds?: string[]
      siteIds?: string[]
    }
  ) {
    const { projectIds, employeeIds, currencyIds, vendorIds, siteIds } = ids

    const [projectsList, employeesList, currenciesList, vendorsList, sitesList] =
      await Promise.all([
        projectIds && projectIds.length > 0
          ? db
            .select()
            .from(projects)
            .where(inArray(projects.id, projectIds))
            .execute()
          : Promise.resolve([]),
        employeeIds && employeeIds.length > 0
          ? db
            .select()
            .from(employees)
            .where(inArray(employees.id, employeeIds))
            .execute()
          : Promise.resolve([]),
        currencyIds && currencyIds.length > 0
          ? db
            .select()
            .from(currencies)
            .where(inArray(currencies.code, currencyIds))
            .execute()
          : Promise.resolve([]),
        vendorIds && vendorIds.length > 0
          ? db
            .select()
            .from(vendors)
            .where(inArray(vendors.id, vendorIds))
            .execute()
          : Promise.resolve([]),
        siteIds && siteIds.length > 0
          ? db
            .select()
            .from(sites)
            .where(inArray(sites.id, siteIds))
            .execute()
          : Promise.resolve([]),
      ])

    return {
      projects: projectsList,
      employees: employeesList,
      currencies: currenciesList,
      vendors: vendorsList,
      sites: sitesList,
    }
  }

  /**
   * 构建条件数组
   * 过滤掉 undefined 和 null 的条件，避免无效查询
   */
  static buildConditionArray(conditions: (SQL | undefined | null)[]): SQL[] {
    return conditions.filter((c): c is SQL => c !== undefined && c !== null)
  }

  /**
   * 从数据中提取关联ID集合
   * 用于批量查询关联数据
   */
  static extractRelatedIds<T>(
    items: T[],
    extractors: {
      projectId?: (item: T) => string | null | undefined
      employeeId?: (item: T) => string | null | undefined
      currencyId?: (item: T) => string | null | undefined
      vendorId?: (item: T) => string | null | undefined
      siteId?: (item: T) => string | null | undefined
    }
  ) {
    const projectIds = new Set<string>()
    const employeeIds = new Set<string>()
    const currencyIds = new Set<string>()
    const vendorIds = new Set<string>()
    const siteIds = new Set<string>()

    items.forEach(item => {
      if (extractors.projectId) {
        const id = extractors.projectId(item)
        if (id) projectIds.add(id)
      }
      if (extractors.employeeId) {
        const id = extractors.employeeId(item)
        if (id) employeeIds.add(id)
      }
      if (extractors.currencyId) {
        const id = extractors.currencyId(item)
        if (id) currencyIds.add(id)
      }
      if (extractors.vendorId) {
        const id = extractors.vendorId(item)
        if (id) vendorIds.add(id)
      }
      if (extractors.siteId) {
        const id = extractors.siteId(item)
        if (id) siteIds.add(id)
      }
    })

    return {
      projectIds: Array.from(projectIds),
      employeeIds: Array.from(employeeIds),
      currencyIds: Array.from(currencyIds),
      vendorIds: Array.from(vendorIds),
      siteIds: Array.from(siteIds),
    }
  }

  /**
   * 创建关联数据的 Map，便于快速查找
   */
  static createMaps<T extends { id: string }>(items: T[]): Map<string, T> {
    return new Map(items.map(item => [item.id, item]))
  }
}

