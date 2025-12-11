import { env } from 'cloudflare:test'
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { drizzle } from 'drizzle-orm/d1'
import * as schema from '../../src/db/schema.js'
import {  employees, sessions, positions } from '../../src/db/schema.js'
import { AuthService } from '../../src/services/AuthService.js'
import { v4 as uuid } from 'uuid'
import schemaSql from '../../src/db/schema.sql?raw'
import bcrypt from 'bcryptjs'

// Mock verifyTotp
vi.mock('../../src/utils/auth.js', async () => {
    const actual = await vi.importActual<any>('../../src/utils/auth.js')
    return {
        ...actual,
        verifyTotp: () => true
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
        service = new AuthService(db, env.SESSIONS_KV, mockSystemConfigService)
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

        await db.insert(positions).values({ id: positionId, code: 'P01', name: 'Dev', level: 1, functionRole: 'developer' }).execute()
        await db.insert(employees).values({
            id: userId,
            email,
            personalEmail: email,
            name: 'Test User',
            positionId,
            active: 1,
            passwordHash: hash
        }).execute()

        const result = await service.login(email, password)
        expect(result.status).toBe('success')
    })

    it('should login successfully with TOTP', async () => {
        const email = 'test@example.com'
        const password = 'password123'
        const hash = await bcrypt.hash(password, 10)
        const userId = uuid()
        const positionId = uuid()

        await db.insert(positions).values({ id: positionId, code: 'P01', name: 'Dev', level: 1, functionRole: 'developer' }).execute()
        await db.insert(employees).values({
            id: userId,
            email,
            personalEmail: email,
            name: 'Test User',
            positionId,
            active: 1,
            passwordHash: hash,
            totpSecret: 'secret'
        }).execute()

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

        await db.insert(positions).values({ id: positionId, code: 'P01', name: 'Dev', level: 1, functionRole: 'developer' }).execute()
        await db.insert(employees).values({
            id: userId,
            email,
            personalEmail: email,
            name: 'Test User',
            positionId,
            active: 1,
            passwordHash: hash,
            totpSecret: 'secret'
        }).execute()

        const result = await service.login(email, password)
        expect(result.status).toBe('success')
    })

    it('should fail login with wrong password', async () => {
        const email = 'test@example.com'
        const password = 'password123'
        const hash = await bcrypt.hash(password, 10)
        const userId = uuid()
        const positionId = uuid()

        await db.insert(positions).values({ id: positionId, code: 'P01', name: 'Dev', level: 1, functionRole: 'developer' }).execute()
        await db.insert(employees).values({
            id: userId,
            email,
            personalEmail: email,
            name: 'Test User',
            positionId,
            active: 1,
            passwordHash: hash
        }).execute()

        await expect(service.login(email, 'wrong')).rejects.toThrow('用户名或密码错误')
    })

})
