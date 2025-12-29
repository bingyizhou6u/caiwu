import { v4 as uuid } from 'uuid'
import { getUserFullContext } from '../../utils/db.js'
import { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from '../../db/schema.js'
import { eq } from 'drizzle-orm'
import { sessions } from '../../db/schema.js'
import { AuditService } from '../system/AuditService.js'
import { query } from '../../utils/query-helpers.js'
import { Logger } from '../../utils/logger.js'

/**
 * 认证服务
 * 
 * 负责会话管理。用户身份验证由 Cloudflare Access 处理。
 */
export class AuthService {
  constructor(
    private db: DrizzleD1Database<typeof schema>,
    private kv: KVNamespace,
    private auditService: AuditService
  ) { }

  /**
   * 创建会话
   * 
   * 由 CF Access 登录流程调用，创建应用内部会话
   */
  async createSession(
    employeeId: string,
    deviceInfo?: { ip?: string; userAgent?: string },
    context?: { executionCtx?: { waitUntil: (p: Promise<unknown>) => void } }
  ) {
    const id = uuid()
    const now = Date.now()
    const expires = now + 1000 * 60 * 60 * 24 * 7 // 7天过期

    // 单点登录：删除该用户的所有旧会话 (KV + DB)
    const oldSessions = await this.db
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.employeeId, employeeId))
      .all()

    if (oldSessions.length > 0) {
      // 并行删除所有旧会话的 KV 缓存
      await Promise.all([
        ...oldSessions.map(s => this.kv.delete(`session:${s.id}`)),
        this.db.delete(sessions).where(eq(sessions.employeeId, employeeId)).run(),
      ])
    }

    // 1. 异步写入 D1 (作为持久化备份和审计)
    const d1Promise = this.db
      .insert(sessions)
      .values({
        id,
        employeeId,
        expiresAt: expires,
        ipAddress: deviceInfo?.ip || null,
        userAgent: deviceInfo?.userAgent || null,
        createdAt: now,
        lastActiveAt: now,
      })
      .run()

    if (context?.executionCtx?.waitUntil) {
      context.executionCtx.waitUntil(d1Promise.catch((e: unknown) => Logger.error('Session D1 write failed', { error: e instanceof Error ? e.message : String(e) })))
    } else {
      d1Promise.catch((e: unknown) => Logger.error('Session D1 write failed', { error: e instanceof Error ? e.message : String(e) }))
    }

    // 2. 写入 KV (作为高性能缓存)
    const fullContext = await getUserFullContext(this.db, employeeId)
    if (fullContext) {
      const sessionData = {
        session: { id, employeeId: employeeId, expires_at: expires },
        ...fullContext,
      }
      // KV TTL 单位是秒
      await this.kv.put(`session:${id}`, JSON.stringify(sessionData), {
        expiration: Math.floor(expires / 1000),
      })
    }

    return { id, expires }
  }

  /**
   * 获取会话
   * 
   * 优先从 KV 缓存读取，降级到 D1
   */
  async getSession(sessionId: string) {
    // 优先从 KV 读取
    const cached = await this.kv.get(`session:${sessionId}`, 'json')
    if (cached) {
      return (cached as { session: { id: string; employeeId: string; expires_at: number } }).session
    }

    // 降级到 D1
    const s = await query(
      this.db,
      'AuthService.getSession.getSession',
      () => this.db.select().from(sessions).where(eq(sessions.id, sessionId)).get(),
      undefined
    )

    if (!s) { return null }
    if (s.expiresAt && s.expiresAt < Date.now()) { return null }

    return {
      id: s.id,
      employeeId: s.employeeId,
      expires_at: s.expiresAt,
    }
  }

  /**
   * 登出
   * 
   * 销毁会话（KV + D1）
   */
  async logout(sessionId: string) {
    const session = await this.getSession(sessionId)
    if (session) {
      await this.auditService.log(session.employeeId, 'logout', 'employee', session.employeeId)
    }
    await this.kv.delete(`session:${sessionId}`)
    await this.db.delete(sessions).where(eq(sessions.id, sessionId)).run()
  }
}
