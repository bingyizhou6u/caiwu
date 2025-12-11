/**
 * 统一错误处理
 */

import type { Context, Next } from 'hono'

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message)
    this.name = 'AppError'
  }
}

/**
 * 创建业务错误
 */
export function createError(
  statusCode: number,
  code: string,
  message: string,
  details?: any
): AppError {
  return new AppError(statusCode, code, message, details)
}

/**
 * 常用错误类型
 */
export const Errors = {
  // 认证错误
  UNAUTHORIZED: (message = '未授权') => createError(401, 'UNAUTHORIZED', message),
  FORBIDDEN: (message = '权限不足') => createError(403, 'FORBIDDEN', message),

  // 资源错误
  NOT_FOUND: (resource = '资源') => createError(404, 'NOT_FOUND', `${resource}不存在`),
  DUPLICATE: (field = '字段') => createError(409, 'DUPLICATE', `${field}已存在`),

  // 验证错误
  VALIDATION_ERROR: (message = '验证失败', details?: any) =>
    createError(400, 'VALIDATION_ERROR', message, details),

  // 业务错误
  BUSINESS_ERROR: (message: string, details?: any) =>
    createError(400, 'BUSINESS_ERROR', message, details),

  // 服务器错误
  INTERNAL_ERROR: (message = '服务器内部错误', details?: any) =>
    createError(500, 'INTERNAL_ERROR', message, details),
}

/**
 * 全局错误处理中间件
 */
import { ZodError } from 'zod'

export async function errorHandler(err: Error, c: Context) {
  // 结构化错误日志
  const errorLog = {
    timestamp: new Date().toISOString(),
    url: c.req.url,
    method: c.req.method,
    userId: c.get('userId') || 'anonymous',
    userRole: c.get('userRole') || 'unknown',
    ip: c.req.header('cf-connecting-ip') || c.req.header('x-real-ip') || 'unknown',
    userAgent: c.req.header('user-agent') || 'unknown',
    error: {
      message: err.message,
      name: err.name,
      stack: err.stack
    }
  }

  if (err instanceof AppError) {
    // 业务错误，使用 info 级别
    console.info('Business Error:', JSON.stringify(errorLog))
    return c.json({
      error: err.message,
      code: err.code,
      details: err.details
    }, err.statusCode as any)
  }

  if (err instanceof ZodError) {
    // Zod 验证错误
    console.info('Validation Error:', JSON.stringify(errorLog))
    return c.json({
      error: '验证失败',
      code: 'VALIDATION_ERROR',
      details: {
        errors: err.errors.map(e => ({
          path: e.path.join('.'),
          message: e.message,
          code: e.code
        }))
      }
    }, 400)
  }

  // 未预期的错误，使用 error 级别
  console.error('Unexpected Error:', JSON.stringify(errorLog))

  return c.json({
    error: err.message,
    code: 'INTERNAL_ERROR',
    stack: err.stack
  }, 500)
}

