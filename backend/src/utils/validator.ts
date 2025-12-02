/**
 * Zod验证中间件
 */

import type { Context, Next } from 'hono'
import { z } from 'zod'
import { Errors } from './errors.js'

/**
 * 验证请求体JSON
 */
export function validateJson<T extends z.ZodTypeAny>(schema: T) {
  return async (c: Context, next: Next) => {
    const body = await c.req.json()
    const result = schema.parse(body) // parse throws ZodError on failure
    c.set('validatedData', result)
    await next()
  }
}

/**
 * 验证查询参数
 */
export function validateQuery<T extends z.ZodTypeAny>(schema: T) {
  return async (c: Context, next: Next) => {
    const queryParams = c.req.query()
    const query: Record<string, string> = {}
    for (const [key, value] of Object.entries(queryParams)) {
      query[key] = value
    }
    const result = schema.parse(query)
    c.set('validatedQuery', result)
    await next()
  }
}

/**
 * 验证路径参数
 */
export function validateParam<T extends z.ZodTypeAny>(schema: T) {
  return async (c: Context, next: Next) => {
    const params = c.req.param()
    const result = schema.parse(params)
    c.set('validatedParams', result)
    await next()
  }
}

/**
 * 获取验证后的数据
 */
export function getValidatedData<T>(c: Context): T {
  return c.get('validatedData') as T
}

export function getValidatedQuery<T>(c: Context): T {
  return c.get('validatedQuery') as T
}

export function getValidatedParams<T>(c: Context): T {
  return c.get('validatedParams') as T
}

