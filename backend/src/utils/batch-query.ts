/**
 * 批量查询优化工具
 * 用于优化数据库批量查询操作，减少查询次数和提升性能
 */

import { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from '../db/schema.js'
import { DBPerformanceTracker } from './db-performance.js'

/**
 * 批量查询选项
 */
export interface BatchQueryOptions {
  /**
   * 批次大小（每次查询的数量）
   */
  batchSize?: number
  /**
   * 是否并行执行
   */
  parallel?: boolean
  /**
   * 查询名称（用于性能追踪）
   */
  queryName?: string
}

/**
 * 批量查询工具类
 */
export class BatchQuery {
  /**
   * 批量获取数据（按ID列表）
   * @param db 数据库实例
   * @param table 表名
   * @param ids ID列表
   * @param options 查询选项
   */
  static async getByIds<T extends { id: string }>(
    db: DrizzleD1Database<typeof schema>,
    table: any,
    ids: string[],
    options: BatchQueryOptions = {}
  ): Promise<T[]> {
    const { batchSize = 100, parallel = true, queryName = 'batch.getByIds' } = options

    if (ids.length === 0) {
      return []
    }

    // 如果数量较少，直接查询
    if (ids.length <= batchSize) {
      return DBPerformanceTracker.track(
        queryName,
        async () => {
          const { inArray } = await import('drizzle-orm')
          return db.select().from(table).where(inArray(table.id, ids)).all() as Promise<T[]>
        }
      )
    }

    // 分批查询
    const batches: string[][] = []
    for (let i = 0; i < ids.length; i += batchSize) {
      batches.push(ids.slice(i, i + batchSize))
    }

    if (parallel) {
      // 并行执行所有批次
      const results = await DBPerformanceTracker.trackBatch(
        queryName,
        batches.map((batch) => async () => {
          const { inArray } = await import('drizzle-orm')
          return db.select().from(table).where(inArray(table.id, batch)).all() as Promise<T[]>
        })
      )
      return results.flat() as T[]
    } else {
      // 串行执行批次
      const results: T[] = []
      for (const batch of batches) {
        const batchResults = await DBPerformanceTracker.track(
          `${queryName}.batch`,
          async () => {
            const { inArray } = await import('drizzle-orm')
            return db.select().from(table).where(inArray(table.id, batch)).all() as Promise<T[]>
          }
        )
        results.push(...(batchResults as T[]))
      }
      return results
    }
  }

  /**
   * 批量更新数据
   * @param db 数据库实例
   * @param table 表名
   * @param updates 更新数据数组（包含id和更新字段）
   * @param options 查询选项
   */
  static async updateBatch<T extends { id: string }>(
    db: DrizzleD1Database<typeof schema>,
    table: any,
    updates: Array<{ id: string; [key: string]: any }>,
    options: BatchQueryOptions = {}
  ): Promise<void> {
    const { batchSize = 50, parallel = false, queryName = 'batch.update' } = options

    if (updates.length === 0) {
      return
    }

    // 如果数量较少，直接更新
    if (updates.length <= batchSize) {
      await DBPerformanceTracker.track(queryName, async () => {
        const { eq } = await import('drizzle-orm')
        for (const update of updates) {
          const { id, ...data } = update
          await db.update(table).set(data).where(eq(table.id, id)).execute()
        }
      })
      return
    }

    // 分批更新
    const batches: Array<{ id: string; [key: string]: any }>[] = []
    for (let i = 0; i < updates.length; i += batchSize) {
      batches.push(updates.slice(i, i + batchSize))
    }

    if (parallel) {
      // 并行执行所有批次
      await DBPerformanceTracker.trackBatch(
        queryName,
        batches.map((batch) => async () => {
          const { eq } = await import('drizzle-orm')
          for (const update of batch) {
            const { id, ...data } = update
            await db.update(table).set(data).where(eq(table.id, id)).execute()
          }
        })
      )
    } else {
      // 串行执行批次
      for (const batch of batches) {
        await DBPerformanceTracker.track(`${queryName}.batch`, async () => {
          const { eq } = await import('drizzle-orm')
          for (const update of batch) {
            const { id, ...data } = update
            await db.update(table).set(data).where(eq(table.id, id)).execute()
          }
        })
      }
    }
  }

  /**
   * 批量插入数据
   * @param db 数据库实例
   * @param table 表名
   * @param data 数据数组
   * @param options 查询选项
   */
  static async insertBatch<T>(
    db: DrizzleD1Database<typeof schema>,
    table: any,
    data: T[],
    options: BatchQueryOptions = {}
  ): Promise<void> {
    const { batchSize = 100, parallel = false, queryName = 'batch.insert' } = options

    if (data.length === 0) {
      return
    }

    // 如果数量较少，直接插入
    if (data.length <= batchSize) {
      await DBPerformanceTracker.track(queryName, async () => {
        await db.insert(table).values(data as any).execute()
      })
      return
    }

    // 分批插入
    const batches: T[][] = []
    for (let i = 0; i < data.length; i += batchSize) {
      batches.push(data.slice(i, i + batchSize))
    }

    if (parallel) {
      // 并行执行所有批次
      await DBPerformanceTracker.trackBatch(
        queryName,
        batches.map((batch) => async () => {
          await db.insert(table).values(batch as any).execute()
        })
      )
    } else {
      // 串行执行批次
      for (const batch of batches) {
        await DBPerformanceTracker.track(`${queryName}.batch`, async () => {
          await db.insert(table).values(batch as any).execute()
        })
      }
    }
  }
}
