/**
 * Permission Cache - 权限缓存管理
 * 
 * 提供权限信息的 KV 缓存管理，包括：
 * 1. 缓存读取优化
 * 2. 缓存失效机制
 * 3. 批量缓存操作
 */

import { Logger } from './logger.js'
import { getUserFullContext } from './db.js'
import { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from '../db/schema.js'
import { eq } from 'drizzle-orm'
import { employees, sessions } from '../db/schema.js'

/**
 * 权限缓存键前缀
 */
export const PERMISSION_CACHE_PREFIX = 'session:'

/**
 * 权限缓存 TTL（秒）- 7天
 */
export const PERMISSION_CACHE_TTL = 60 * 60 * 24 * 7

/**
 * 权限缓存数据结构
 */
export interface PermissionCacheData {
  session: {
    id: string
    employeeId: string
    expires_at: number
  }
  user: {
    id: string
    email: string
    name: string
  }
  position: {
    id: string
    code: string
    name: string
    canManageSubordinates: number
    dataScope: string
    permissions: Record<string, Record<string, string[]>>
  } | null
  employee: {
    id: string
    orgDepartmentId: string | null
    projectId: string | null
  } | null
  departmentModules: string[]
}

/**
 * 权限缓存管理类
 */
export class PermissionCache {
  constructor(
    private kv: KVNamespace,
    private db: DrizzleD1Database<typeof schema>
  ) {}

  /**
   * 获取缓存键
   */
  private getCacheKey(sessionId: string): string {
    return `${PERMISSION_CACHE_PREFIX}${sessionId}`
  }

  /**
   * 从缓存获取权限数据
   * @param sessionId 会话ID
   * @returns 缓存的权限数据，如果不存在则返回 null
   */
  async get(sessionId: string): Promise<PermissionCacheData | null> {
    try {
      const cached = await this.kv.get(this.getCacheKey(sessionId), 'json')
      return cached as PermissionCacheData | null
    } catch (error) {
      Logger.warn('[PermissionCache] Get failed:', error)
      return null
    }
  }

  /**
   * 设置权限缓存
   * @param sessionId 会话ID
   * @param data 权限数据
   * @param ttl 缓存时间（秒），默认 7 天
   */
  async set(sessionId: string, data: PermissionCacheData, ttl?: number): Promise<void> {
    try {
      await this.kv.put(
        this.getCacheKey(sessionId),
        JSON.stringify(data),
        { expirationTtl: ttl || PERMISSION_CACHE_TTL }
      )
    } catch (error) {
      Logger.warn('[PermissionCache] Set failed:', error)
    }
  }

  /**
   * 删除权限缓存
   * @param sessionId 会话ID
   */
  async delete(sessionId: string): Promise<void> {
    try {
      await this.kv.delete(this.getCacheKey(sessionId))
    } catch (error) {
      Logger.warn('[PermissionCache] Delete failed:', error)
    }
  }

  /**
   * 批量删除权限缓存
   * @param sessionIds 会话ID数组
   */
  async deleteMany(sessionIds: string[]): Promise<void> {
    try {
      await Promise.all(sessionIds.map(id => this.delete(id)))
    } catch (error) {
      Logger.warn('[PermissionCache] DeleteMany failed:', error)
    }
  }

  /**
   * 根据员工ID失效所有相关缓存
   * 当员工的职位、部门等权限相关信息变更时调用
   * @param employeeId 员工ID
   */
  async invalidateByEmployeeId(employeeId: string): Promise<void> {
    try {
      // 查询该员工的所有活跃会话
      const activeSessions = await this.db
        .select({ id: sessions.id })
        .from(sessions)
        .where(eq(sessions.employeeId, employeeId))
        .all()

      if (activeSessions.length > 0) {
        const sessionIds = activeSessions.map(s => s.id)
        await this.deleteMany(sessionIds)
        Logger.info('[PermissionCache] Invalidated sessions for employee', { 
          employeeId, 
          sessionCount: sessionIds.length 
        })
      }
    } catch (error) {
      Logger.warn('[PermissionCache] InvalidateByEmployeeId failed:', error)
    }
  }

  /**
   * 根据职位ID失效所有相关缓存
   * 当职位权限变更时调用
   * @param positionId 职位ID
   */
  async invalidateByPositionId(positionId: string): Promise<void> {
    try {
      // 查询使用该职位的所有员工
      const employeesWithPosition = await this.db
        .select({ id: employees.id })
        .from(employees)
        .where(eq(employees.positionId, positionId))
        .all()

      if (employeesWithPosition.length > 0) {
        // 并行失效所有相关员工的缓存
        await Promise.all(
          employeesWithPosition.map(emp => this.invalidateByEmployeeId(emp.id))
        )
        Logger.info('[PermissionCache] Invalidated sessions for position', { 
          positionId, 
          employeeCount: employeesWithPosition.length 
        })
      }
    } catch (error) {
      Logger.warn('[PermissionCache] InvalidateByPositionId failed:', error)
    }
  }

  /**
   * 根据部门ID失效所有相关缓存
   * 当部门模块权限变更时调用
   * @param orgDepartmentId 部门ID
   */
  async invalidateByDepartmentId(orgDepartmentId: string): Promise<void> {
    try {
      // 查询该部门的所有员工
      const employeesInDept = await this.db
        .select({ id: employees.id })
        .from(employees)
        .where(eq(employees.orgDepartmentId, orgDepartmentId))
        .all()

      if (employeesInDept.length > 0) {
        // 并行失效所有相关员工的缓存
        await Promise.all(
          employeesInDept.map(emp => this.invalidateByEmployeeId(emp.id))
        )
        Logger.info('[PermissionCache] Invalidated sessions for department', { 
          orgDepartmentId, 
          employeeCount: employeesInDept.length 
        })
      }
    } catch (error) {
      Logger.warn('[PermissionCache] InvalidateByDepartmentId failed:', error)
    }
  }

  /**
   * 刷新员工的权限缓存
   * 重新从数据库加载权限信息并更新缓存
   * @param employeeId 员工ID
   */
  async refreshByEmployeeId(employeeId: string): Promise<void> {
    try {
      // 获取该员工的所有活跃会话
      const activeSessions = await this.db
        .select({ id: sessions.id, expiresAt: sessions.expiresAt })
        .from(sessions)
        .where(eq(sessions.employeeId, employeeId))
        .all()

      if (activeSessions.length === 0) {
        return
      }

      // 获取最新的用户上下文
      const fullContext = await getUserFullContext(this.db, employeeId)
      if (!fullContext) {
        // 用户不存在，删除所有缓存
        await this.deleteMany(activeSessions.map(s => s.id))
        return
      }

      // 更新所有会话的缓存
      const now = Date.now()
      await Promise.all(
        activeSessions.map(async (session) => {
          if (!session.expiresAt || session.expiresAt <= now) {
            // 会话已过期，删除缓存
            await this.delete(session.id)
            return
          }

          const cacheData: PermissionCacheData = {
            session: {
              id: session.id,
              employeeId,
              expires_at: session.expiresAt,
            },
            ...fullContext,
          }

          // 计算剩余 TTL
          const ttl = Math.floor((session.expiresAt - now) / 1000)
          if (ttl > 0) {
            await this.set(session.id, cacheData, ttl)
          }
        })
      )

      Logger.info('[PermissionCache] Refreshed sessions for employee', { 
        employeeId, 
        sessionCount: activeSessions.length 
      })
    } catch (error) {
      Logger.warn('[PermissionCache] RefreshByEmployeeId failed:', error)
    }
  }
}

/**
 * 创建权限缓存实例
 */
export function createPermissionCache(
  kv: KVNamespace,
  db: DrizzleD1Database<typeof schema>
): PermissionCache {
  return new PermissionCache(kv, db)
}
