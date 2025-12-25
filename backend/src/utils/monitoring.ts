/**
 * 错误监控工具
 * 用于收集、分析和报告应用错误和性能指标
 */

import type { Context } from 'hono'
import type { Env, AppVariables } from '../types/index.js'
import { AppError } from './errors.js'
import { ErrorCodes } from '../constants/errorCodes.js'

/**
 * 错误级别
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * 错误上下文信息
 */
export interface ErrorContext {
  /**
   * 请求 ID
   */
  requestId?: string
  /**
   * 用户 ID
   */
  userId?: string
  /**
   * 请求路径
   */
  path?: string
  /**
   * 请求方法
   */
  method?: string
  /**
   * 请求 IP
   */
  ip?: string
  /**
   * 用户代理
   */
  userAgent?: string
  /**
   * 额外上下文数据
   */
  metadata?: Record<string, any>
}

/**
 * 错误记录
 */
export interface ErrorRecord {
  /**
   * 错误 ID（唯一标识）
   */
  id: string
  /**
   * 错误代码
   */
  code: string
  /**
   * 错误消息
   */
  message: string
  /**
   * 错误级别
   */
  severity: ErrorSeverity
  /**
   * 错误堆栈
   */
  stack?: string
  /**
   * 错误上下文
   */
  context: ErrorContext
  /**
   * 发生时间
   */
  timestamp: number
  /**
   * 错误详情
   */
  details?: any
}

/**
 * 性能指标
 */
export interface PerformanceMetric {
  /**
   * 指标名称
   */
  name: string
  /**
   * 指标值
   */
  value: number
  /**
   * 单位（如 'ms', 'bytes', 'count'）
   */
  unit: string
  /**
   * 标签（用于分类）
   */
  tags?: Record<string, string>
  /**
   * 时间戳
   */
  timestamp: number
}

/**
 * 监控服务类
 */
export class MonitoringService {
  private errors: ErrorRecord[] = []
  private metrics: PerformanceMetric[] = []
  private readonly maxErrors = 1000 // 内存中最多保存的错误记录数
  private readonly maxMetrics = 5000 // 内存中最多保存的指标数

  /**
   * 记录错误
   */
  recordError(
    error: Error | AppError,
    context: ErrorContext,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM
  ): string {
    const errorId = this.generateErrorId()
    const isAppError = error instanceof AppError

    const record: ErrorRecord = {
      id: errorId,
      code: isAppError ? error.code : ErrorCodes.SYS_INTERNAL_ERROR,
      message: error.message,
      severity: this.determineSeverity(error, severity),
      stack: error.stack,
      context,
      timestamp: Date.now(),
      details: isAppError ? error.details : undefined,
    }

    // 添加到内存队列
    this.errors.push(record)
    if (this.errors.length > this.maxErrors) {
      this.errors.shift() // 移除最旧的记录
    }

    // 输出到控制台（开发环境）
    if (process.env.NODE_ENV === 'development') {
      console.error('[Monitoring] Error recorded:', {
        id: errorId,
        code: record.code,
        message: record.message,
        severity: record.severity,
        context: record.context,
      })
    }

    // TODO: 在生产环境中，可以发送到外部监控服务
    // 例如：Sentry, Datadog, Cloudflare Analytics 等
    // this.sendToExternalService(record)

    return errorId
  }

  /**
   * 记录性能指标
   */
  recordMetric(
    name: string,
    value: number,
    unit: string = 'ms',
    tags?: Record<string, string>
  ): void {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      tags,
      timestamp: Date.now(),
    }

    this.metrics.push(metric)
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift()
    }

    // 输出到控制台（开发环境）
    if (process.env.NODE_ENV === 'development') {
      console.log('[Monitoring] Metric recorded:', metric)
    }
  }

  /**
   * 获取错误统计
   */
  getErrorStats(timeWindowMs: number = 3600000): {
    total: number
    bySeverity: Record<ErrorSeverity, number>
    byCode: Record<string, number>
    recent: ErrorRecord[]
  } {
    const now = Date.now()
    const cutoff = now - timeWindowMs
    const recentErrors = this.errors.filter(e => e.timestamp >= cutoff)

    const bySeverity: Record<ErrorSeverity, number> = {
      [ErrorSeverity.LOW]: 0,
      [ErrorSeverity.MEDIUM]: 0,
      [ErrorSeverity.HIGH]: 0,
      [ErrorSeverity.CRITICAL]: 0,
    }

    const byCode: Record<string, number> = {}

    recentErrors.forEach(error => {
      bySeverity[error.severity]++
      byCode[error.code] = (byCode[error.code] || 0) + 1
    })

    return {
      total: recentErrors.length,
      bySeverity,
      byCode,
      recent: recentErrors.slice(-100), // 返回最近 100 条
    }
  }

  /**
   * 获取性能指标统计
   */
  getMetricStats(
    name: string,
    timeWindowMs: number = 3600000
  ): {
    count: number
    avg: number
    min: number
    max: number
    p95: number
    p99: number
  } | null {
    const now = Date.now()
    const cutoff = now - timeWindowMs
    const recentMetrics = this.metrics.filter(m => m.name === name && m.timestamp >= cutoff)

    if (recentMetrics.length === 0) {
      return null
    }

    const values = recentMetrics.map(m => m.value).sort((a, b) => a - b)
    const sum = values.reduce((a, b) => a + b, 0)

    return {
      count: values.length,
      avg: sum / values.length,
      min: values[0],
      max: values[values.length - 1],
      p95: values[Math.floor(values.length * 0.95)],
      p99: values[Math.floor(values.length * 0.99)],
    }
  }

  /**
   * 清除旧数据
   */
  clearOldData(maxAgeMs: number = 86400000): void {
    const now = Date.now()
    const cutoff = now - maxAgeMs

    this.errors = this.errors.filter(e => e.timestamp >= cutoff)
    this.metrics = this.metrics.filter(m => m.timestamp >= cutoff)
  }

  /**
   * 从 Context 提取错误上下文
   */
  extractContext(c: Context<{ Bindings: Env; Variables: AppVariables }>): ErrorContext {
    return {
      requestId: c.get('requestId'),
      userId: c.get('userId'),
      path: c.req.path,
      method: c.req.method,
      ip: c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || undefined,
      userAgent: c.req.header('user-agent'),
      metadata: {
        // 可以添加更多上下文信息
      },
    }
  }

  /**
   * 确定错误级别
   */
  private determineSeverity(
    error: Error | AppError,
    defaultSeverity: ErrorSeverity
  ): ErrorSeverity {
    if (error instanceof AppError) {
      // 根据错误代码确定严重程度
      const code = error.code

      // 认证错误通常是中等严重程度
      if (code.startsWith('AUTH_')) {
        return ErrorSeverity.MEDIUM
      }

      // 验证错误通常是低严重程度
      if (code.startsWith('VALIDATION_')) {
        return ErrorSeverity.LOW
      }

      // 业务错误通常是中等严重程度
      if (code.startsWith('BUSINESS_')) {
        return ErrorSeverity.MEDIUM
      }

      // 系统错误通常是高严重程度
      if (code.startsWith('SYSTEM_')) {
        return ErrorSeverity.HIGH
      }
    }

    return defaultSeverity
  }

  /**
   * 生成错误 ID
   */
  private generateErrorId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }
}

/**
 * 全局监控服务实例
 * 在生产环境中，可以考虑使用单例模式或依赖注入
 */
let monitoringInstance: MonitoringService | null = null

/**
 * 获取监控服务实例
 */
export function getMonitoringService(): MonitoringService {
  if (!monitoringInstance) {
    monitoringInstance = new MonitoringService()
  }
  return monitoringInstance
}

/**
 * 重置监控服务（主要用于测试）
 */
export function resetMonitoringService(): void {
  monitoringInstance = null
}
