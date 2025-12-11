import { env } from 'cloudflare:test'
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { drizzle } from 'drizzle-orm/d1'
import { EmployeeService } from '../../src/services/EmployeeService.js'
import { AuthService } from '../../src/services/AuthService.js'
import { SystemConfigService } from '../../src/services/SystemConfigService.js'
import {  employees, departments, orgDepartments, positions } from '../../src/db/schema.js'
import { eq } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import schemaSql from '../../src/db/schema.sql?raw'
import * as schema from '../../src/db/schema.js'

describe('User Activation Flow', () => {
    let employeeService: EmployeeService
    let authService: AuthService
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

        employeeService = new EmployeeService(db)
        authService = new AuthService(db, env.SESSIONS_KV, systemConfigService)
    })

    beforeEach(async () => {
        await db.delete(employees).execute()
        await db.delete(orgDepartments).execute()
        await db.delete(departments).execute()
        await db.delete(positions).execute()
        await db.delete(schema.systemConfig).execute()

        await db.insert(schema.systemConfig).values({
            key: '2fa_enabled',
            value: 'false',
            description: 'Disable 2FA for test',
            updatedAt: Date.now(),
            updatedBy: 'system'
        }).run()
    })

    it('should create employee with activation token and verify flow', async () => {
        const orgDeptId = uuid()
        const projectId = uuid()
        await db.insert(orgDepartments).values({
            id: orgDeptId,
            name: 'Test Org Dept',
            projectId: projectId,
            createdAt: Date.now()
        }).run()

        await db.insert(departments).values({
            id: projectId,
            name: 'Test Project',
            createdAt: Date.now()
        }).run()

        // Mock HQ
        await db.insert(departments).values({
            id: uuid(),
            name: '总部',
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

        const name = 'Test User'
        const personalEmail = 'test.user@example.com'

        // Ensure env has EMAIL_SERVICE mocked via vitest config
        const testEnv = env as any

        const result = await employeeService.create({
            name,
            personalEmail,
            orgDepartmentId: orgDeptId,
            positionId: posId,
            joinDate: '2023-01-01',
            annualLeaveCycleMonths: 12,
            annualLeaveDays: 5
        }, testEnv)

        expect(result.personalEmail).toBe(personalEmail)
        expect(result.password).toBeUndefined()

        // Verify Database State
        const user = await db.select().from(employees).where(eq(employees.personalEmail, personalEmail)).get()
        expect(user).toBeDefined()
        expect(user!.activationToken).toBeDefined()
        expect(user!.activationToken).toHaveLength(64)
        expect(user!.passwordHash).toBeNull()
        expect(user!.active).toBe(1)
        expect(user!.mustChangePassword).toBe(0)

        // Verify Token
        const verifyResult = await authService.verifyActivationToken(user!.activationToken!)
        expect(verifyResult.valid).toBe(true)
        expect(verifyResult.email).toBe(personalEmail)

        // Activate Account
        const newPassword = 'newSecretPassword123!'
        const loginResult = await authService.activateAccount(user!.activationToken!, newPassword)

        expect(loginResult.status).toBe('success')
        expect((loginResult as any).user.email).toBe(personalEmail)

        // Verify Post-Activation State
        const activatedUser = await db.select().from(employees).where(eq(employees.id, user!.id)).get()
        expect(activatedUser!.activationToken).toBeNull()
        expect(activatedUser!.passwordHash).not.toBeNull()
        expect(activatedUser!.passwordChanged).toBe(1)

        // Verify Token Invalid
        await expect(authService.verifyActivationToken(user!.activationToken!)).rejects.toThrow()
    })
})
