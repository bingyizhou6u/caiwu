/**
 * API 版本检测中间件
 * 自动检测请求的 API 版本并设置到 context
 */

import { Context, Next } from 'hono'
import type { Env, AppVariables } from '../types.js'

/**
 * API 版本检测中间件
 * 从请求路径中提取版本信息并设置到 context
 */
export function createVersionMiddleware() {
  return async (
    c: Context<{ Bindings: Env; Variables: AppVariables }>,
    next: Next
  ) => {
    const path = c.req.path

    // 检测版本
    let version = 'v2' // 默认版本

    if (path.startsWith('/api/v3')) {
      version = 'v3'
    } else if (path.startsWith('/api/v2')) {
      version = 'v2'
    }
    // /api/* 默认使用 v2

    // 设置版本到 context
    c.set('apiVersion', version)

    // 添加版本响应头
    c.header('X-API-Version', version)

    await next()
  }
}
