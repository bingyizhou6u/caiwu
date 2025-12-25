/**
 * 数据库查询性能监控工具
 * 记录数据库查询的执行时间和性能指标
 */

import type { Context } from 'hono'
import type { Env, AppVariables } from '../types/index.js'
import { getMonitoringService } from './monitoring.js'
import { ErrorSeverity } from './monitoring.js'
import { Logger } from './logger.js'

/**
 * 数据库查询性能追踪器
 */
export class DBPerformanceTracker {
  /**
   * 包装数据库查询，自动记录性能指标
   * @param queryName 查询名称（用于标识）
   * @param queryFn 查询函数
   * @param c Hono Context（可选，用于记录上下文）
   */
  static async track<T>(
    queryName: string,
    queryFn: () => Promise<T>,
    c?: Context<{ Bindings: Env; Variables: AppVariables }>
  ): Promise<T> {
    const startTime = Date.now()
    let success = true
    let error: Error | null = null

    try {
      const result = await queryFn()
      return result
    } catch (err) {
      success = false
      error = err instanceof Error ? err : new Error(String(err))
      throw err
    } finally {
      const duration = Date.now() - startTime
      const monitoring = getMonitoringService()

      // 记录性能指标
      monitoring.recordMetric('db.query.duration', duration, 'ms', {
        query: queryName,
        success: String(success),
      })

      // 记录慢查询（超过1秒）
      if (duration > 1000) {
        monitoring.recordMetric('db.query.slow', duration, 'ms', {
          query: queryName,
          duration: String(duration),
        })

        Logger.warn(`[DB Performance] Slow query detected: ${queryName} took ${duration}ms`, {
          query: queryName,
          duration,
          error: error?.message,
          context: c ? {
            requestId: c.get('requestId'),
            userId: c.get('userId'),
            path: c.req.path,
          } : undefined,
        })
      }

      // 记录查询错误
      if (!success && error) {
        monitoring.recordError(error, {
          requestId: c?.get('requestId'),
          userId: c?.get('userId'),
          path: c?.req.path,
        }, ErrorSeverity.MEDIUM)
      }
    }
  }

  /**
   * 批量查询性能追踪
   * @param queryName 查询名称
   * @param queries 查询函数数组
   * @param c Hono Context（可选）
   */
  static async trackBatch<T extends any[]>(
    queryName: string,
    queries: { [K in keyof T]: () => Promise<T[K]> },
    c?: Context<{ Bindings: Env; Variables: AppVariables }>
  ): Promise<T> {
    const startTime = Date.now()
    const monitoring = getMonitoringService()

    try {
      // 并行执行所有查询
      const results = await Promise.all(queries.map((q) => q()))
      const duration = Date.now() - startTime

      monitoring.recordMetric('db.query.batch.duration', duration, 'ms', {
        query: queryName,
        count: String(queries.length),
      })

      return results as any as T
    } catch (error) {
      const duration = Date.now() - startTime
      monitoring.recordMetric('db.query.batch.duration', duration, 'ms', {
        query: queryName,
        count: String(queries.length),
        success: 'false',
      })

      throw error
    }
  }
}

/**
 * 数据库查询性能装饰器
 * 用于自动追踪服务方法的数据库查询性能
 */
export function trackDBPerformance(queryName: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const c = args.find((arg) => arg && typeof arg === 'object' && 'req' in arg)
      return DBPerformanceTracker.track(
        `${target.constructor.name}.${propertyKey}`,
        () => originalMethod.apply(this, args),
        c
      )
    }

    return descriptor
  }
}
