/**
 * 依赖注入中间件
 * 
 * 使用 ServiceContainer 实现懒加载的服务注入
 * 服务只在首次访问时创建，减少不必要的初始化开销
 */

import { Context, Next } from 'hono'
import { createDb } from '../db/index.js'
import { Logger } from '../utils/logger.js'
import { getMonitoringService } from '../utils/monitoring.js'
import { createServiceContainer, ServiceContainer } from './service-container.js'
import type { Env, AppVariables } from '../types/index.js'

export const di = async (c: Context<{ Bindings: Env; Variables: AppVariables }>, next: Next) => {
  try {
    const db = createDb(c.env.DB)
    
    // 创建服务容器（懒加载模式）
    const services = createServiceContainer(db, c.env)

    // 注入到上下文
    c.set('db', db)
    c.set('monitoring', getMonitoringService())
    c.set('services', services)

    await next()

    // 调试：记录本次请求实际使用的服务数量
    if (process.env.NODE_ENV === 'development') {
      Logger.debug('[DI] Services used in this request', {
        count: services.createdServicesCount,
        services: services.createdServiceNames,
      })
    }
  } catch (error) {
    Logger.error('DI initialization error', { 
      error: error instanceof Error ? error.message : String(error) 
    })
    throw error
  }
}

// 导出 ServiceContainer 类型供其他模块使用
export type { ServiceContainer }
