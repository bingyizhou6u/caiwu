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
    try {
      const body = await c.req.json()
      const result = schema.safeParse(body)
      
      if (!result.success) {
        const errors = result.error.errors.map(err => ({
          path: err.path.join('.'),
          message: err.message,
          code: err.code,
        }))
        console.error('Validation failed:', {
          url: c.req.url,
          method: c.req.method,
          body: JSON.stringify(body),
          errors: errors
        })
        throw Errors.VALIDATION_ERROR('请求数据验证失败', {
          errors: errors
        })
      }
      
      // 将验证后的数据存储到context中
      c.set('validatedData', result.data)
      await next()
    } catch (err) {
      throw err
    }
  }
}

/**
 * 验证查询参数
 */
export function validateQuery<T extends z.ZodTypeAny>(schema: T) {
  return async (c: Context, next: Next) => {
    try {
      const queryParams = c.req.query()
      const query: Record<string, string> = {}
      for (const [key, value] of Object.entries(queryParams)) {
        query[key] = value
      }
      const result = schema.safeParse(query)
      
      if (!result.success) {
        throw Errors.VALIDATION_ERROR('查询参数验证失败', {
          errors: result.error.errors.map(err => ({
            path: err.path.join('.'),
            message: err.message,
          }))
        })
      }
      
      c.set('validatedQuery', result.data)
      await next()
    } catch (err) {
      throw err
    }
  }
}

/**
 * 验证路径参数
 */
export function validateParam<T extends z.ZodTypeAny>(schema: T) {
  return async (c: Context, next: Next) => {
    try {
      const params = c.req.param()
      const result = schema.safeParse(params)
      
      if (!result.success) {
        throw Errors.VALIDATION_ERROR('路径参数验证失败', {
          errors: result.error.errors.map(err => ({
            path: err.path.join('.'),
            message: err.message,
          }))
        })
      }
      
      c.set('validatedParams', result.data)
      await next()
    } catch (err) {
      throw err
    }
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

