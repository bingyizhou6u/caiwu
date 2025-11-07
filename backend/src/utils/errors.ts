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
  INTERNAL_ERROR: (message = '服务器内部错误') => 
    createError(500, 'INTERNAL_ERROR', message),
}

/**
 * 全局错误处理中间件
 */
export async function errorHandler(c: Context, next: Next) {
  try {
    await next()
  } catch (err) {
    if (err instanceof AppError) {
      return c.json({
        error: err.message,
        code: err.code,
        details: err.details
      }, err.statusCode as any)
    }
    
    // 记录未预期的错误
    console.error('Unexpected error:', {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      url: c.req.url,
      method: c.req.method,
    })
    
    return c.json({
      error: '服务器内部错误',
      code: 'INTERNAL_ERROR'
    }, 500)
  }
}

