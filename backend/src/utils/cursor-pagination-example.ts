/**
 * 游标分页使用示例
 *
 * 此文件仅作为参考，展示如何在路由中使用游标分页
 * 实际使用时请参考此示例修改对应的路由文件
 */

/*
// 示例：在路由中使用游标分页

import { cursorPaginationSchema, getCursorPaginationParams, buildCursorPaginationResult } from '../../utils/cursor-pagination.js'
import { apiCursorPaged, jsonResponse } from '../../utils/response.js'
import { desc, asc, sql } from 'drizzle-orm'
import { cashFlows } from '../../db/schema.js'

// 1. 在路由定义中使用 cursorPaginationSchema
const listCashFlowsRoute = createRoute({
  method: 'get',
  path: '/flows',
  summary: 'List cash flows (cursor pagination)',
  request: {
    query: cursorPaginationSchema
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: cursorPaginationResponseSchema(cashFlowResponseSchema)
        }
      },
      description: 'List of cash flows'
    }
  }
})

// 2. 在路由处理函数中使用游标分页
flowsRoutes.openapi(listCashFlowsRoute, async (c) => {
  const query = c.req.valid('query')
  
  // 获取分页参数
  const { cursor, limit, sortBy, sortOrder } = getCursorPaginationParams(
    query,
    'createdAt', // 默认排序字段
    'desc' // 默认排序方向
  )

  // 构建查询条件
  let whereConditions: any[] = []
  
  // 如果有游标，添加游标条件
  if (cursor) {
    const { sql: cursorSql, params: cursorParams } = getCursorWhereClause(
      cursor,
      sortBy,
      sortOrder
    )
    if (cursorSql) {
      whereConditions.push(sql.raw(cursorSql, cursorParams))
    }
  }

  // 添加其他过滤条件（如权限过滤等）
  // whereConditions.push(...)

  const whereClause = whereConditions.length > 0 
    ? sql`${sql.join(whereConditions, sql` AND `)}`
    : undefined

  // 执行查询（多查询一条用于判断是否有下一页）
  const items = await db
    .select({
      id: cashFlows.id,
      // ... 其他字段
      createdAt: cashFlows.createdAt,
    })
    .from(cashFlows)
    .where(whereClause)
    .orderBy(
      sortOrder === 'desc' 
        ? desc(cashFlows[sortBy as keyof typeof cashFlows])
        : asc(cashFlows[sortBy as keyof typeof cashFlows]),
      desc(cashFlows.id) // 添加 id 作为辅助排序
    )
    .limit(limit)
    .all()

  // 构建分页结果
  const result = buildCursorPaginationResult(
    items,
    limit - 1, // 实际每页数量（减去多查询的一条）
    sortBy,
    query.cursor || null
  )

  return jsonResponse(c, apiCursorPaged(result.items, result.pagination))
})

// 3. 前端使用示例
// 
// // 首次请求
// const response1 = await fetch('/api/v2/flows?limit=20')
// const data1 = await response1.json()
// // data1.data.pagination.nextCursor 用于下一页
//
// // 下一页请求
// const response2 = await fetch(`/api/v2/flows?limit=20&cursor=${data1.data.pagination.nextCursor}`)
// const data2 = await response2.json()
//
// // 检查是否有下一页
// if (data2.data.pagination.hasNext) {
//   // 继续加载
// }
*/
