
import { env } from 'cloudflare:test'
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { drizzle } from 'drizzle-orm/d1'
import { AuthService } from '../../src/services/AuthService.js'
import { EmployeeService } from '../../src/services/EmployeeService.js'
import { SystemConfigService } from '../../src/services/SystemConfigService.js'
import { employees, departments, orgDepartments, positions } from '../../src/db/schema.js'
import { eq } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import schemaSql from '../../src/db/schema.sql?raw'
import * as schema from '../../src/db/schema.js'

describe('Password Reset Flow', () => {
    let authService: AuthService
    let employeeService: EmployeeService
    let db: ReturnType<typeof drizzle<typeof schema>>

    beforeAll(async () => {
        const statements = schemaSql.split(';').filter(s => s.trim().length > 0)
        for (const statement of statements) {
            await env.DB.prepare(statement).run()
        }
        db = drizzle(env.DB, { schema })
        // @ts-ignore
        db.transaction = async (cb) => cb(db)

        const systemConfigService = new SystemConfigService(db)
        const mockEmailService = {
            sendActivationEmail: vi.fn(),
            sendLoginNotificationEmail: vi.fn(),
            sendPasswordResetLinkEmail: vi.fn(),
            sendPasswordChangedNotificationEmail: vi.fn(),
            sendTotpResetEmail: vi.fn(),
            sendEmail: vi.fn()
        } as any

        employeeService = new EmployeeService(db, mockEmailService)
        const mockSystemConfigService = { get: async () => ({ value: 'false' }) } as any
        const mockAuditService = { log: async () => { } } as any
        authService = new AuthService(db, env.SESSIONS_KV, mockSystemConfigService, mockAuditService, mockEmailService)
    })

    beforeEach(async () => {
        await db.delete(employees).execute()
        await db.delete(orgDepartments).execute()
        await db.delete(schema.systemConfig).execute()
        await db.insert(schema.systemConfig).values({
            key: '2fa_enabled',
            value: 'false',
            description: 'Disable 2FA for test',
            updatedAt: Date.now(),
            updatedBy: 'system'
        }).run()
        await db.delete(departments).execute()
        await db.delete(positions).execute()

        // Setup initial data for user
        const orgDeptId = uuid()
        await db.insert(orgDepartments).values({
            id: orgDeptId,
            name: 'Test Dept',
            projectId: 'test_project',
            createdAt: Date.now()
        }).run()

        const posId = uuid()
        await db.insert(positions).values({
            id: posId,
            name: 'Test Pos',
            code: 'test_pos',
            level: 3,
            functionRole: 'employee',
            createdAt: Date.now()
        }).run()

        await employeeService.create({
            name: 'Reset User',
            personalEmail: 'reset@example.com',
            orgDepartmentId: orgDeptId,
            positionId: posId,
            joinDate: '2023-01-01',
            annualLeaveCycleMonths: 12,
            annualLeaveDays: 5
        }, env as any)

        // Activate the user first so they have a password and are active
        const user = await db.select().from(employees).where(eq(employees.personalEmail, 'reset@example.com')).get()
        await authService.activateAccount(user!.activationToken!, 'oldPassword123')
    })

    it('should request password reset key flow', async () => {
        // 1. Request Reset
        const result = await authService.requestPasswordReset('reset@example.com', env as any)
        expect(result.status).toBe('success')

        // Verify DB
        const user = await db.select().from(employees).where(eq(employees.personalEmail, 'reset@example.com')).get()
        expect(user!.resetToken).toBeDefined()
        expect(user!.resetToken).toHaveLength(64) // 32 chars * 2 uuids (stripped of - ?) 
        // uuid is 36 chars. remove - is 32. 2 of them is 64.
        expect(user!.resetExpiresAt).toBeGreaterThan(Date.now())

        // 2. Verify Token
        const verifyResult = await authService.verifyResetToken(user!.resetToken!)
        expect(verifyResult.valid).toBe(true)
        // verifyResult returns user.email which is company email
        expect(verifyResult.email).toContain('@cloudflarets.com')

        // 3. Reset Password
        const newPassword = 'newPassword456'
        const resetResult = await authService.resetPassword(user!.resetToken!, newPassword)

        // Should login automatically (returns session, not token - token is generated in route)
        expect(resetResult.status).toBe('success')
        expect((resetResult as any).session).toBeDefined()

        // Verify Login with new password
        const loginResult = await authService.login('reset@example.com', newPassword)
        expect(loginResult.status).toBe('success')

        // Verify Login with old password fails
        await expect(authService.login('reset@example.com', 'oldPassword123')).rejects.toThrow('用户名或密码错误')
        // AuthService.login throws if user not found, but returns various statuses.
        // Actually, standard login implementation throws on invalid password often?
        // Let's check AuthService.login logic: 
        // const ok = await bcrypt.compare(password, user.passwordHash!)
        // if (!ok) throw Errors.UNAUTHORIZED('用户名或密码错误')
        await expect(authService.login('reset@example.com', 'oldPassword123')).rejects.toThrow('用户名或密码错误')
    })

    it('should fail with invalid token', async () => {
        await expect(authService.verifyResetToken('invalid_token')).rejects.toThrow('无效的重置链接')
    })

    it('should fail if token expired', async () => {
        // Manually expire token
        await authService.requestPasswordReset('reset@example.com', env as any)
        const user = await db.select().from(employees).where(eq(employees.personalEmail, 'reset@example.com')).get()

        await db.update(employees)
            .set({ resetExpiresAt: Date.now() - 1000 })
            .where(eq(employees.id, user!.id))
            .run()

        await expect(authService.verifyResetToken(user!.resetToken!)).rejects.toThrow('重置链接已过期')
    })
})
