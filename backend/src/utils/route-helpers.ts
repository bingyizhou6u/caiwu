/**
 * 路由辅助函数
 * 统一处理路由响应格式和错误处理
 */

import { Context } from 'hono'
import type { Env, AppVariables } from '../types.js'
import { apiSuccess, jsonResponse, PaginationMeta } from './response.js'

type RouteContext = Context<{ Bindings: Env; Variables: AppVariables }>

/**
 * 创建标准路由处理器
 * 统一处理异步路由函数，自动包装响应格式
 */
export function createRouteHandler<T>(
  handler: (c: RouteContext) => Promise<T>
) {
  return async (c: RouteContext) => {
    try {
      const result = await handler(c)
      return jsonResponse(c, apiSuccess(result))
    } catch (error) {
      // 错误由全局错误处理中间件处理
      throw error
    }
  }
}

/**
 * 创建分页路由处理器
 * 自动解析 page 和 limit 参数，统一分页响应格式
 */
export function createPaginatedHandler<T>(
  handler: (c: RouteContext) => Promise<{ items: T[]; total: number }>
) {
  return async (c: RouteContext) => {
    try {
      const page = parseInt(c.req.query('page') || '1', 10)
      const limit = parseInt(c.req.query('limit') || '20', 10)
      
      const result = await handler(c)
      
      const pagination: PaginationMeta = {
        page,
        pageSize: limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      }
      
      return jsonResponse(c, apiSuccess({
        items: result.items,
        pagination,
      }))
    } catch (error) {
      throw error
    }
  }
}

/**
 * 从查询参数解析分页信息
 */
export function parsePagination(c: RouteContext): { page: number; limit: number; offset: number } {
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10))
  const limit = Math.max(1, Math.min(100, parseInt(c.req.query('limit') || '20', 10)))
  const offset = (page - 1) * limit
  
  return { page, limit, offset }
}

