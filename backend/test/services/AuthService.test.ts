import { env } from 'cloudflare:test'
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import * as schema from '../../src/db/schema.js'
import { employees, sessions, positions } from '../../src/db/schema.js'
import { AuthService } from '../../src/services/auth/AuthService.js'
import { AuditService } from '../../src/services/system/AuditService.js'
import { EmployeeService } from '../../src/services/hr/EmployeeService.js'
import { v4 as uuid } from 'uuid'
import schemaSql from '../../src/db/schema.sql?raw'
import bcrypt from 'bcryptjs'

// Mock verifyTotp
vi.mock('../../src/utils/auth.js', async () => {
  const actual = await vi.importActual<any>('../../src/utils/auth.js')
  return {
    ...actual,
    verifyTotp: () => true,
  }
})

describe('AuthService', () => {
  let db: ReturnType<typeof drizzle<typeof schema>>
  let service: AuthService

  beforeAll(async () => {
    const statements = schemaSql.split(';').filter(s => s.trim().length > 0)
    for (const statement of statements) {
      await env.DB.prepare(statement).run()
    }
    db = drizzle(env.DB, { schema })
    // Mock SystemConfigService
    const mockSystemConfigService = { get: async () => ({ value: 'false' }) } as any
    const auditService = new AuditService(db)
    const mockEmailService = {
      sendActivationEmail: vi.fn(),
      sendLoginNotificationEmail: vi.fn(),
      sendPasswordResetLinkEmail: vi.fn(),
      sendPasswordChangedNotificationEmail: vi.fn(),
      sendTotpResetEmail: vi.fn(),
      sendEmail: vi.fn(),
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

  it('should login successfully when 2FA is disabled', async () => {
    const email = 'test@example.com'
    const password = 'password123'
    const hash = await bcrypt.hash(password, 10)
    const userId = uuid()
    const positionId = uuid()

    await db
      .insert(positions)
      .values({ id: positionId, code: 'P01', name: 'Dev', level: 1 })
      .execute()
    await db
      .insert(employees)
      .values({
        id: userId,
        email,
        personalEmail: email,
        name: 'Test User',
        positionId,
        active: 1,
        passwordHash: hash,
      })
      .execute()

    const result = await service.login(email, password)
    expect(result.status).toBe('success')
  })

  it('should login successfully with TOTP', async () => {
    const email = 'test@example.com'
    const password = 'password123'
    const hash = await bcrypt.hash(password, 10)
    const userId = uuid()
    const positionId = uuid()

    await db
      .insert(positions)
      .values({ id: positionId, code: 'P01', name: 'Dev', level: 1 })
      .execute()
    await db
      .insert(employees)
      .values({
        id: userId,
        email,
        personalEmail: email,
        name: 'Test User',
        positionId,
        active: 1,
        passwordHash: hash,
        totpSecret: 'secret',
      })
      .execute()

    const result = await service.login(email, password, '123456')
    expect(result.status).toBe('success')
    expect(result.user?.email).toBe(email)
    expect(result.session).toBeDefined()

    // Verify session in KV
    const session = await env.SESSIONS_KV.get(`session:${result.session?.id}`, 'json')
    expect(session).toBeDefined()
  })

  it('should login with TOTP secret even when 2FA disabled', async () => {
    const email = 'test@example.com'
    const password = 'password123'
    const hash = await bcrypt.hash(password, 10)
    const userId = uuid()
    const positionId = uuid()

    await db
      .insert(positions)
      .values({ id: positionId, code: 'P01', name: 'Dev', level: 1 })
      .execute()
    await db
      .insert(employees)
      .values({
        id: userId,
        email,
        personalEmail: email,
        name: 'Test User',
        positionId,
        active: 1,
        passwordHash: hash,
        totpSecret: 'secret',
      })
      .execute()

    const result = await service.login(email, password)
    expect(result.status).toBe('success')
  })

  it('should fail login with wrong password', async () => {
    const email = 'test@example.com'
    const password = 'password123'
    const hash = await bcrypt.hash(password, 10)
    const userId = uuid()
    const positionId = uuid()

    await db
      .insert(positions)
      .values({ id: positionId, code: 'P01', name: 'Dev', level: 1 })
      .execute()
    await db
      .insert(employees)
      .values({
        id: userId,
        email,
        personalEmail: email,
        name: 'Test User',
        positionId,
        active: 1,
        passwordHash: hash,
      })
      .execute()

    await expect(service.login(email, 'wrong')).rejects.toThrow('用户名或密码错误')
  })

  it('should logout successfully', async () => {
    const email = 'test@example.com'
    const password = 'password123'
    const hash = await bcrypt.hash(password, 10)
    const userId = uuid()
    const positionId = uuid()

    await db
      .insert(positions)
      .values({ id: positionId, code: 'P01', name: 'Dev', level: 1 })
      .execute()
    await db
      .insert(employees)
      .values({
        id: userId,
        email,
        personalEmail: email,
        name: 'Test User',
        positionId,
        active: 1,
        passwordHash: hash,
      })
      .execute()

    const loginResult = await service.login(email, password)
    const sessionId = loginResult.session!.id

    await service.logout(sessionId)

    const session = await service.getSession(sessionId)
    expect(session).toBeNull()
  })

  it('should request password reset', async () => {
    const email = 'test@example.com'
    const positionId = uuid()

    await db
      .insert(positions)
      .values({ id: positionId, code: 'P01', name: 'Dev', level: 1 })
      .execute()
    await db
      .insert(employees)
      .values({
        id: uuid(),
        email,
        personalEmail: email,
        name: 'Test User',
        positionId,
        active: 1,
      })
      .execute()

    await service.requestPasswordReset(email, {})
    // Check if email service was called (if mocked properly, but here we just check no error thrown)
  })

  it('should generate activation token and activate account', async () => {
    const email = 'newuser@example.com'
    const personalEmail = 'newuser@example.com'
    const positionId = uuid()
    const token = 'activation-token-123'
    const employeeId = uuid()

    await db
      .insert(positions)
      .values({ id: positionId, code: 'P01', name: 'Dev', level: 1 })
      .execute()

    await db
      .insert(employees)
      .values({
        id: employeeId,
        email,
        personalEmail,
        name: 'New User',
        positionId,
        active: 0,
        activationToken: token,
        activationExpiresAt: Date.now() + 86400000,
      })
      .execute()

    const verifyResult = await service.verifyActivationToken(token)
    expect(verifyResult.email).toBe(email)

    const newPassword = 'newPassword123'
    // We need to provide TOTP related params if 2FA is enabled (mocked to false in beforeAll? 'false' string)
    // In beforeAll: mockSystemConfigService.get returns { value: 'false' }
    // AuthService checks: const is2FaEnabled = twoFaConfig ? (twoFaConfig.value === true || twoFaConfig.value === 'true') : true
    // 'false' !== true && 'false' !== 'true', so is2FaEnabled should be false?
    // Wait, 'false' string evaluates to false in the logic: (v===true || v==='true').
    // So 2FA is disabled.

    const activateResult = await service.activateAccount(token, newPassword)

    expect(activateResult.status).toBe('success')

    // Verify password hash updated
    const emp = await db.select().from(employees).where(eq(employees.id, employeeId)).get()
    expect(emp?.passwordHash).toBeDefined()
    expect(emp?.active).toBe(1)
    expect(emp?.activationToken).toBeNull()
  })
})
