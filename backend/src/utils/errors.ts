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
  const isProduction = c.req.url.includes('https://') && !c.req.url.includes('localhost')
  
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
      error: isProduction ? '服务器内部错误' : err.message,
      code: ErrorCodes.SYS_INTERNAL_ERROR,
      // 生产环境不返回堆栈信息
      ...(isProduction ? {} : { stack: err.stack }),
    },
    500
  )
}

/**
 * V2 Unified Error Handler
 * 使用预初始化的监控服务，避免每次错误处理都动态导入
 */
import { getMonitoringService, type MonitoringService } from './monitoring.js'

// 预加载监控服务引用（模块加载时初始化）
let _monitoringService: MonitoringService | null = null

function getMonitoring(): MonitoringService {
  if (!_monitoringService) {
    _monitoringService = getMonitoringService()
  }
  return _monitoringService
}

export function errorHandlerV2(err: Error, c: Context) {
  const monitoring = getMonitoring()

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

  // 判断是否为生产环境
  const isProduction = c.req.url.includes('https://') && !c.req.url.includes('localhost')

  return c.json(
    {
      success: false,
      error: {
        code: ErrorCodes.SYS_INTERNAL_ERROR,
        message: '系统内部错误',
        details: isProduction ? undefined : err.stack,
      },
    },
    500
  )
}
