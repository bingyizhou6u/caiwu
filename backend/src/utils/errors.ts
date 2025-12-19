/**
 * 统一错误处理
 */

import type { Context, Next } from 'hono'
import { ErrorCodes } from '../constants/errorCodes.js'

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
  UNAUTHORIZED: (message = '未授权') => createError(401, ErrorCodes.AUTH_UNAUTHORIZED, message),
  FORBIDDEN: (message = '权限不足') => createError(403, ErrorCodes.AUTH_FORBIDDEN, message),

  // 资源错误
  NOT_FOUND: (resource = '资源') => createError(404, ErrorCodes.BUS_NOT_FOUND, `${resource}不存在`),
  DUPLICATE: (field = '字段') => createError(409, ErrorCodes.BUS_DUPLICATE, `${field}已存在`),

  // 验证错误
  VALIDATION_ERROR: (message = '验证失败', details?: any) =>
    createError(400, ErrorCodes.VAL_BAD_REQUEST, message, details),

  // 业务错误
  BUSINESS_ERROR: (message: string, details?: any) =>
    createError(400, ErrorCodes.BUS_GENERAL, message, details),

  // 服务器错误
  INTERNAL_ERROR: (message = '服务器内部错误', details?: any) =>
    createError(500, ErrorCodes.SYS_INTERNAL_ERROR, message, details),
}

/**
 * 全局错误处理中间件
 */
import { ZodError } from 'zod'
import { Logger } from './logger.js'
import { ErrorSeverity } from './monitoring.js'

export async function errorHandler(err: Error, c: Context) {
  if (err instanceof AppError) {
    // 业务错误，使用 info 级别
    Logger.info(
      'Business Error',
      {
        error: err.message,
        code: err.code,
        details: err.details,
        stack: err.stack,
      },
      c
    )

    return c.json(
      {
        error: err.message,
        code: err.code,
        details: err.details,
      },
      err.statusCode as any
    )
  }

  if (err instanceof ZodError) {
    // Zod 验证错误
    Logger.info(
      'Validation Error',
      {
        error: '验证失败',
        details: err.errors,
      },
      c
    )

    return c.json(
      {
        error: '验证失败',
        code: ErrorCodes.VAL_BAD_REQUEST,
        details: {
          errors: err.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message,
            code: e.code,
          })),
        },
      },
      400
    )
  }

  // 未预期的错误，使用 error 级别
  Logger.error(
    'Unexpected Error',
    {
      error: err.message,
      name: err.name,
      stack: err.stack,
    },
    c
  )

  return c.json(
    {
      error: err.message,
      code: ErrorCodes.SYS_INTERNAL_ERROR,
      stack: err.stack,
    },
    500
  )
}

/**
 * V2 Unified Error Handler
 */
export async function errorHandlerV2(err: Error, c: Context) {
  // 导入监控服务（延迟导入避免循环依赖）
  const { getMonitoringService } = await import('./monitoring.js')
  const monitoring = getMonitoringService()

  if (err instanceof AppError) {
    Logger.info(
      'Business Error',
      {
        error: err.message,
        code: err.code,
        details: err.details,
        stack: err.stack,
      },
      c
    )

    // 记录错误到监控服务
    monitoring.recordError(err, monitoring.extractContext(c as any), ErrorSeverity.MEDIUM)

    return c.json(
      {
        success: false,
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
        },
      },
      err.statusCode as any
    )
  }

  if (err instanceof ZodError) {
    Logger.info(
      'Validation Error',
      {
        error: '验证失败',
        details: err.errors,
      },
      c
    )

    // 验证错误通常是低严重程度
    monitoring.recordError(err, monitoring.extractContext(c as any), ErrorSeverity.LOW)

    return c.json(
      {
        success: false,
        error: {
          code: ErrorCodes.VAL_BAD_REQUEST,
          message: '验证失败',
          details: {
            errors: err.errors.map(e => ({
              path: e.path.join('.'),
              message: e.message,
              code: e.code,
            })),
          },
        },
      },
      400
    )
  }

  Logger.error(
    'Unexpected Error',
    {
      error: err.message,
      name: err.name,
      stack: err.stack,
    },
    c
  )

  // 未预期的错误通常是高严重程度
  monitoring.recordError(err, monitoring.extractContext(c as any), ErrorSeverity.HIGH)

  return c.json(
    {
      success: false,
      error: {
        code: ErrorCodes.SYS_INTERNAL_ERROR,
        message: '系统内部错误',
        details: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      },
    },
    500
  )
}
