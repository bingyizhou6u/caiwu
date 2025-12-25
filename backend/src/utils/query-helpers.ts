/**
 * 数据库查询辅助工具
 * 提供统一的查询方法，自动应用性能监控和最佳实践
 * 
 * 使用这些辅助方法可以确保：
 * 1. 自动性能监控
 * 2. 统一的错误处理
 * 3. 符合开发规范
 */

import { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from '../db/schema.js'
import { DBPerformanceTracker } from './db-performance.js'
import { BatchQuery } from './batch-query.js'
import type { Context } from 'hono'
import type { Env, AppVariables } from '../types/index.js'

/**
 * 查询辅助类
 * 提供统一的查询接口
 */
export class QueryHelpers {
  /**
   * 单个查询（自动性能监控）
   * @param db 数据库实例
   * @param queryName 查询名称（格式：ServiceName.methodName.queryName）
   * @param queryFn 查询函数
   * @param c Context（可选）
   */
  static async query<T>(
    db: DrizzleD1Database<typeof schema>,
    queryName: string,
    queryFn: () => Promise<T>,
    c?: Context<{ Bindings: Env; Variables: AppVariables }>
  ): Promise<T> {
    return DBPerformanceTracker.track(queryName, queryFn, c)
  }

  /**
   * 批量获取（自动性能监控 + 批量优化）
   * @param db 数据库实例
   * @param table 表对象
   * @param ids ID数组
   * @param queryName 查询名称
   * @param options 批量查询选项
   * @param c Context（可选）
   */
  static async getByIds<T extends { id: string }>(
    db: DrizzleD1Database<typeof schema>,
    table: any,
    ids: string[],
    queryName: string,
    options: {
      batchSize?: number
      parallel?: boolean
    } = {},
    c?: Context<{ Bindings: Env; Variables: AppVariables }>
  ): Promise<T[]> {
    return DBPerformanceTracker.track(
      queryName,
      () =>
        BatchQuery.getByIds(db, table, ids, {
          batchSize: options.batchSize || 100,
          parallel: options.parallel !== false,
          queryName,
        }),
      c
    )
  }

  /**
   * 批量更新（自动性能监控 + 批量优化）
   */
  static async updateBatch<T extends { id: string }>(
    db: DrizzleD1Database<typeof schema>,
    table: any,
    updates: Array<{ id: string; [key: string]: any }>,
    queryName: string,
    options: {
      batchSize?: number
      parallel?: boolean
    } = {},
    c?: Context<{ Bindings: Env; Variables: AppVariables }>
  ): Promise<void> {
    return DBPerformanceTracker.track(
      queryName,
      () =>
        BatchQuery.updateBatch(db, table, updates, {
          batchSize: options.batchSize || 50,
          parallel: options.parallel || false, // 更新默认串行
          queryName,
        }),
      c
    )
  }

  /**
   * 批量插入（自动性能监控 + 批量优化）
   */
  static async insertBatch<T>(
    db: DrizzleD1Database<typeof schema>,
    table: any,
    data: T[],
    queryName: string,
    options: {
      batchSize?: number
      parallel?: boolean
    } = {},
    c?: Context<{ Bindings: Env; Variables: AppVariables }>
  ): Promise<void> {
    return DBPerformanceTracker.track(
      queryName,
      () =>
        BatchQuery.insertBatch(db, table, data, {
          batchSize: options.batchSize || 100,
          parallel: options.parallel || false, // 插入默认串行
          queryName,
        }),
      c
    )
  }
}

/**
 * 便捷方法：单个查询
 * 使用示例：
 * ```typescript
 * const employee = await query(
 *   this.db,
 *   'EmployeeService.getById',
 *   () => this.db.select().from(employees).where(eq(employees.id, id)).get()
 * )
 * ```
 */
export function query<T>(
  db: DrizzleD1Database<typeof schema>,
  queryName: string,
  queryFn: () => Promise<T>,
  c?: Context<{ Bindings: Env; Variables: AppVariables }>
): Promise<T> {
  return QueryHelpers.query(db, queryName, queryFn, c)
}

/**
 * 便捷方法：批量获取
 * 使用示例：
 * ```typescript
 * const employees = await getByIds(
 *   this.db,
 *   employees,
 *   employeeIds,
 *   'EmployeeService.getByIds'
 * )
 * ```
 */
export function getByIds<T extends { id: string }>(
  db: DrizzleD1Database<typeof schema>,
  table: any,
  ids: string[],
  queryName: string,
  options?: {
    batchSize?: number
    parallel?: boolean
  },
  c?: Context<{ Bindings: Env; Variables: AppVariables }>
): Promise<T[]> {
  return QueryHelpers.getByIds(db, table, ids, queryName, options, c)
}
