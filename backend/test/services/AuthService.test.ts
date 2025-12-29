import { env } from 'cloudflare:test'
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { drizzle } from 'drizzle-orm/d1'
import * as schema from '../../src/db/schema.js'
import { employees, sessions, positions } from '../../src/db/schema.js'
import { AuthService } from '../../src/services/auth/AuthService.js'
import { AuditService } from '../../src/services/system/AuditService.js'
import { EmployeeService } from '../../src/services/hr/EmployeeService.js'
import { v4 as uuid } from 'uuid'
import schemaSql from '../../src/db/schema.sql?raw'

describe('AuthService', () => {
  let db: ReturnType<typeof drizzle<typeof schema>>
  let service: AuthService

  beforeAll(async () => {
    const statements = schemaSql.split(';').filter(s => s.trim().length > 0)
    for (const statement of statements) {
      await env.DB.prepare(statement).run()
    }
    db = drizzle(env.DB, { schema })

    // Mock dependencies
    const mockSystemConfigService = { get: async () => ({ value: 'false' }) } as any
    const auditService = new AuditService(db)
    const mockEmailService = {
      sendEmail: () => Promise.resolve({ success: true }),
      sendApprovalNotificationEmail: () => Promise.resolve({ success: true }),
    } as any
    const employeeService = new EmployeeService(db, mockEmailService)

    service = new AuthService(
      db,
      env.SESSIONS_KV,
      mockSystemConfigService,
      auditService,
      mockEmailService,
      employeeService
    )
  })

  beforeEach(async () => {
    await db.delete(employees).execute()
    await db.delete(sessions).execute()
    await db.delete(positions).execute()
  })

  describe('Session Management', () => {
    it('should create and retrieve session', async () => {
      const userId = uuid()
      const positionId = uuid()

      await db
        .insert(positions)
        .values({ id: positionId, code: 'P01', name: 'Dev' })
        .execute()
      await db
        .insert(employees)
        .values({
          id: userId,
          email: 'test@cloudflarets.com',
          personalEmail: 'test@example.com',
          name: 'Test User',
          positionId,
          active: 1,
        })
        .execute()

      // 创建会话
      const session = await service.createSession(userId, {
        email: 'test@cloudflarets.com',
        name: 'Test User',
        positionId,
        cfSub: 'cf-sub-123',
      })

      expect(session).toBeDefined()
      expect(session.id).toBeDefined()
      expect(session.userId).toBe(userId)

      // 获取会话
      const retrieved = await service.getSession(session.id)
      expect(retrieved).toBeDefined()
      expect(retrieved?.userId).toBe(userId)
    })

    it('should logout and invalidate session', async () => {
      const userId = uuid()
      const positionId = uuid()

      await db
        .insert(positions)
        .values({ id: positionId, code: 'P01', name: 'Dev' })
        .execute()
      await db
        .insert(employees)
        .values({
          id: userId,
          email: 'test@cloudflarets.com',
          personalEmail: 'test@example.com',
          name: 'Test User',
          positionId,
          active: 1,
        })
        .execute()

      // 创建会话
      const session = await service.createSession(userId, {
        email: 'test@cloudflarets.com',
        name: 'Test User',
        positionId,
        cfSub: 'cf-sub-123',
      })

      // 登出
      await service.logout(session.id)

      // 验证会话已失效
      const retrieved = await service.getSession(session.id)
      expect(retrieved).toBeNull()
    })

    it('should return null for non-existent session', async () => {
      const session = await service.getSession('non-existent-session-id')
      expect(session).toBeNull()
    })
  })
})
