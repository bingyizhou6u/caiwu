/**
 * 游标分页工具
 * 使用游标（cursor）实现高效分页，避免 offset 的性能问题
 * 适合大数据量场景，不需要查询总数
 */

import type { CursorPaginationMeta } from './response.js'

/**
 * 游标分页参数
 */
export interface CursorPaginationParams {
  /**
   * 游标值（上一页返回的 nextCursor）
   * 首次请求不传或传空字符串
   */
  cursor?: string | null
  /**
   * 每页数量
   */
  limit?: number | string
  /**
   * 排序字段（用于生成游标）
   */
  sortBy?: string
  /**
   * 排序方向
   */
  sortOrder?: 'asc' | 'desc'
}

// CursorPaginationMeta 已移至 response.ts

/**
 * 游标分页结果
 */
export interface CursorPaginationResult<T> {
  items: T[]
  pagination: CursorPaginationMeta
}

/**
 * 默认每页数量
 */
export const DEFAULT_CURSOR_LIMIT = 20
export const MAX_CURSOR_LIMIT = 100

/**
 * 解析游标
 * 游标格式：base64编码的JSON对象，包含排序字段的值
 *
 * @example
 * // 对于按 createdAt 降序排序
 * cursor = btoa(JSON.stringify({ createdAt: 1234567890, id: 'xxx' }))
 */
export function parseCursor(cursor?: string | null): Record<string, any> | null {
  if (!cursor) {return null}
  
  try {
    const decoded = atob(cursor)
    return JSON.parse(decoded)
  } catch {
    // 无效的游标格式，返回 null
    return null
  }
}

/**
 * 生成游标
 *
 * @param values 排序字段的值（通常是最后一条记录的排序字段值）
 * @returns base64编码的游标字符串
 */
export function encodeCursor(values: Record<string, any>): string {
  return btoa(JSON.stringify(values))
}

/**
 * 获取游标分页参数
 */
export function getCursorPaginationParams(
  params: CursorPaginationParams,
  defaultSortBy: string = 'createdAt',
  defaultSortOrder: 'asc' | 'desc' = 'desc'
): {
  cursor: Record<string, any> | null
  limit: number
  sortBy: string
  sortOrder: 'asc' | 'desc'
} {
  const limit = Math.min(Number(params.limit) || DEFAULT_CURSOR_LIMIT, MAX_CURSOR_LIMIT)

  const sortBy = params.sortBy || defaultSortBy
  const sortOrder = params.sortOrder || defaultSortOrder
  const cursor = parseCursor(params.cursor)

  return {
    cursor,
    limit: limit + 1, // 多查询一条，用于判断是否有下一页
    sortBy,
    sortOrder,
  }
}

/**
 * 构建游标分页结果
 *
 * @param items 查询结果（可能包含额外的一条用于判断下一页）
 * @param limit 请求的每页数量
 * @param sortBy 排序字段
 * @param prevCursor 上一页游标（如果有）
 * @returns 分页结果
 */
export function buildCursorPaginationResult<T extends Record<string, any>>(
  items: T[],
  limit: number,
  sortBy: string,
  prevCursor?: string | null
): CursorPaginationResult<T> {
  const hasNext = items.length > limit
  const actualItems = hasNext ? items.slice(0, limit) : items

  // 生成下一页游标（使用最后一条记录的排序字段值）
  let nextCursor: string | null = null
  if (hasNext && actualItems.length > 0) {
    const lastItem = actualItems[actualItems.length - 1]
    const cursorValues: Record<string, any> = {
      [sortBy]: lastItem[sortBy],
      id: lastItem.id, // 添加 id 作为辅助排序字段，确保唯一性
    }
    nextCursor = encodeCursor(cursorValues)
  }

  return {
    items: actualItems,
    pagination: {
      hasNext,
      hasPrev: !!prevCursor,
      nextCursor,
      prevCursor: prevCursor || null,
      limit,
    },
  }
}

/**
 * 创建游标分页查询条件（用于 Drizzle ORM）
 *
 * 注意：这个函数返回 SQL 片段，需要配合 Drizzle 的 where 使用
 * 实际使用时建议直接在查询中构建条件
 *
 * @param cursor 游标值
 * @param sortBy 排序字段
 * @param sortOrder 排序方向
 * @returns SQL 条件字符串和参数（用于手动构建 where 子句）
 */
export function getCursorWhereClause(
  cursor: Record<string, any> | null,
  sortBy: string,
  sortOrder: 'asc' | 'desc'
): { sql: string; params: any[] } | null {
  if (!cursor || !cursor[sortBy]) {
    return null // 首次查询，不需要 where 条件
  }

  // 返回 SQL 片段和参数，供手动构建 where 子句
  if (sortOrder === 'desc') {
    // 降序：查找小于游标值的记录
    return {
      sql: `(${sortBy} < ? OR (${sortBy} = ? AND id < ?))`,
      params: [cursor[sortBy], cursor[sortBy], cursor.id],
    }
  } else {
    // 升序：查找大于游标值的记录
    return {
      sql: `(${sortBy} > ? OR (${sortBy} = ? AND id > ?))`,
      params: [cursor[sortBy], cursor[sortBy], cursor.id],
    }
  }
}

/**
 * 游标分页 Schema（用于 OpenAPI）
 */
import { z } from '@hono/zod-openapi'

export const cursorPaginationSchema = z.object({
  cursor: z.string().optional().nullable().describe('游标值（上一页返回的 nextCursor）'),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(DEFAULT_CURSOR_LIMIT)
    .describe('每页数量'),
  sortBy: z.string().optional().describe('排序字段'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc').describe('排序方向'),
})

/**
 * 游标分页响应 Schema（用于 OpenAPI）
 */
export const cursorPaginationResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    success: z.boolean(),
    data: z.object({
      results: z.array(itemSchema),
      pagination: z.object({
        hasNext: z.boolean(),
        hasPrev: z.boolean(),
        nextCursor: z.string().nullable().optional(),
        prevCursor: z.string().nullable().optional(),
        limit: z.number(),
      }),
    }),
  })
