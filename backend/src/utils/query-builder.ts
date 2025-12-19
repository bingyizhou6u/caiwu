import { DrizzleD1Database } from 'drizzle-orm/d1'
import { eq, and, inArray, SQL } from 'drizzle-orm'
import * as schema from '../db/schema.js'
import {
  employees,
  departments,
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
   * 构建员工关联查询
   * 自动关联员工、部门、组织部门、职位表
   */
  static buildEmployeeJoinQuery<T extends { employeeId: any }, TSelect extends Record<string, any>>(
    db: DrizzleD1Database<typeof schema>,
    baseTable: any,
    employeeIdField: any,
    selectFields: TSelect
  ) {
    return db
      .select({
        ...selectFields,
        employeeName: employees.name,
        employeeEmail: employees.email,
        departmentName: departments.name,
        orgDepartmentName: orgDepartments.name,
        positionName: positions.name,
      })
      .from(baseTable)
      .leftJoin(employees, eq(employees.id, employeeIdField))
      .leftJoin(departments, eq(departments.id, employees.departmentId))
      .leftJoin(orgDepartments, eq(orgDepartments.id, employees.orgDepartmentId))
      .leftJoin(positions, eq(positions.id, employees.positionId))
  }

  /**
   * 批量获取关联数据
   * 并行查询多个关联表，提高性能
   */
  static async fetchRelatedData(
    db: DrizzleD1Database<typeof schema>,
    ids: {
      departmentIds?: string[]
      employeeIds?: string[]
      currencyIds?: string[]
      vendorIds?: string[]
      siteIds?: string[]
    }
  ) {
    const { departmentIds, employeeIds, currencyIds, vendorIds, siteIds } = ids

    const [departmentsList, employeesList, currenciesList, vendorsList, sitesList] =
      await Promise.all([
        departmentIds && departmentIds.length > 0
          ? db
            .select()
            .from(departments)
            .where(inArray(departments.id, departmentIds))
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
      departments: departmentsList,
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
      departmentId?: (item: T) => string | null | undefined
      employeeId?: (item: T) => string | null | undefined
      currencyId?: (item: T) => string | null | undefined
      vendorId?: (item: T) => string | null | undefined
      siteId?: (item: T) => string | null | undefined
    }
  ) {
    const departmentIds = new Set<string>()
    const employeeIds = new Set<string>()
    const currencyIds = new Set<string>()
    const vendorIds = new Set<string>()
    const siteIds = new Set<string>()

    items.forEach(item => {
      if (extractors.departmentId) {
        const id = extractors.departmentId(item)
        if (id) departmentIds.add(id)
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
      departmentIds: Array.from(departmentIds),
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

