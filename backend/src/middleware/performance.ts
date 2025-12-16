/**
 * 性能监控中间件
 * 记录请求处理时间、数据库查询时间等性能指标
 */

import { MiddlewareHandler } from 'hono'
import type { Env, AppVariables } from '../types.js'
import { getMonitoringService } from '../utils/monitoring.js'

/**
 * 性能监控中间件
 * 记录每个请求的处理时间和其他性能指标
 */
export function performanceMonitor(): MiddlewareHandler<{
  Bindings: Env
  Variables: AppVariables
}> {
  return async (c, next) => {
    const monitoring = getMonitoringService()

    // 记录请求开始时间
    const requestStartTime = performance.now()

    try {
      await next()

      // 计算请求处理时间
      const requestDuration = performance.now() - requestStartTime
      const statusCode = c.res.status

      // 记录性能指标
      monitoring.recordMetric('http.request.duration', requestDuration, 'ms', {
        method: c.req.method,
        path: c.req.path,
        status: statusCode.toString(),
      })

      // 记录响应大小（如果可用）
      const contentLength = c.res.headers.get('content-length')
      if (contentLength) {
        monitoring.recordMetric('http.response.size', parseInt(contentLength, 10), 'bytes', {
          method: c.req.method,
          path: c.req.path,
        })
      }

      // 记录慢请求（超过 1 秒）
      if (requestDuration > 1000) {
        monitoring.recordMetric('http.request.slow', requestDuration, 'ms', {
          method: c.req.method,
          path: c.req.path,
          status: statusCode.toString(),
        })
      }

      // 添加性能响应头（可选）
      c.res.headers.set('X-Response-Time', `${Math.round(requestDuration)}ms`)
    } catch (error) {
      // 即使出错也记录性能指标
      const requestDuration = performance.now() - requestStartTime
      monitoring.recordMetric('http.request.duration', requestDuration, 'ms', {
        method: c.req.method,
        path: c.req.path,
        status: 'error',
      })
      throw error
    }
  }
}

/**
 * 数据库查询性能监控装饰器
 * 用于包装数据库查询操作，记录查询时间
 */
export function monitorDbQuery<T extends (...args: any[]) => Promise<any>>(
  queryFn: T,
  queryName: string
): T {
  return (async (...args: Parameters<T>) => {
    const monitoring = getMonitoringService()
    const startTime = performance.now()

    try {
      const result = await queryFn(...args)
      const duration = performance.now() - startTime

      // 记录查询时间
      monitoring.recordMetric('db.query.duration', duration, 'ms', {
        query: queryName,
      })

      // 记录慢查询（超过 500ms）
      if (duration > 500) {
        monitoring.recordMetric('db.query.slow', duration, 'ms', {
          query: queryName,
        })
      }

      return result
    } catch (error) {
      const duration = performance.now() - startTime

      // 记录查询错误
      monitoring.recordMetric('db.query.error', duration, 'ms', {
        query: queryName,
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      throw error
    }
  }) as T
}

/**
 * 内存使用监控
 * 记录当前内存使用情况（如果可用）
 */
export function recordMemoryUsage(): void {
  // 在 Cloudflare Workers 环境中，内存信息可能不可用
  // 这里提供一个占位实现
  try {
    // @ts-ignore - performance.memory 在 Node.js 中可用，但在 Workers 中可能不可用
    if (typeof performance !== 'undefined' && performance.memory) {
      const monitoring = getMonitoringService()
      // @ts-ignore
      const memory = performance.memory

      monitoring.recordMetric('memory.heap.used', memory.usedJSHeapSize, 'bytes')

      monitoring.recordMetric('memory.heap.total', memory.totalJSHeapSize, 'bytes')

      monitoring.recordMetric('memory.heap.limit', memory.jsHeapSizeLimit, 'bytes')
    }
  } catch {
    // 静默失败，内存监控不是必需的
  }
}

/**
 * 定期记录内存使用情况（可选）
 * 可以在应用启动时调用，定期记录内存使用
 */
export function startMemoryMonitoring(intervalMs: number = 60000): () => void {
  let intervalId: any = null

  if (typeof setInterval !== 'undefined') {
    intervalId = setInterval(() => {
      recordMemoryUsage()
    }, intervalMs)
  }

  // 返回停止函数
  return () => {
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
  }
}
