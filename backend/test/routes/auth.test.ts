import { env } from 'cloudflare:test'
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { drizzle } from 'drizzle-orm/d1'
import * as schema from '../../src/db/schema.js'
import { employees, sessions, positions } from '../../src/db/schema.js'
import { v4 as uuid } from 'uuid'
import schemaSql from '../../src/db/schema.sql?raw'
import bcrypt from 'bcryptjs'
import app from '../../src/index.js'

// Mock verifyTotp
vi.mock('../../src/utils/auth.js', async () => {
  const actual = await vi.importActual<any>('../../src/utils/auth.js')
  return {
    ...actual,
    verifyTotp: () => true,
  }
})

describe('Auth API', () => {
  let db: ReturnType<typeof drizzle<typeof schema>>

  beforeAll(async () => {
    const statements = schemaSql.split(';').filter(s => s.trim().length > 0)
    for (const statement of statements) {
      await env.DB.prepare(statement).run()
    }
    db = drizzle(env.DB, { schema })
  })

  beforeEach(async () => {
    await db.delete(employees).execute()
    await db.delete(sessions).execute()
    await db.delete(positions).execute()
  })

  it('POST /api/auth/login should return token', async () => {
    const email = 'test@example.com'
    const password = 'password123'
    const hash = await bcrypt.hash(password, 10)
    const userId = uuid()
    const positionId = uuid()

    await db
      .insert(positions)
      .values({ id: positionId, code: 'P01', name: 'Dev', level: 1, functionRole: 'developer' })
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

    const testEnv = {
      ...env,
      AUTH_JWT_SECRET: 'test-secret-key-min-32-chars-for-security-reasons',
    }

    const tasks: Promise<any>[] = []
    const executionCtx = {
      waitUntil: (promise: Promise<any>) => {
        tasks.push(promise)
      },
      passThroughOnException: () => {},
    }

    const res = await app.request(
      '/api/v2/auth/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, totp: '123456' }),
      },
      testEnv,
      executionCtx as any
    )

    await Promise.all(tasks)

    expect(res.status).toBe(200)
    const response = (await res.json()) as any
    // V2 响应格式
    expect(response.success).toBe(true)
    expect(response.data.token).toBeDefined()
    expect(response.data.user.email).toBe(email)
  })

  it('GET /api/auth/me should return user info', async () => {
    // First login to get token
    const email = 'test@example.com'
    const password = 'password123'
    const hash = await bcrypt.hash(password, 10)
    const userId = uuid()
    const positionId = uuid()

    await db
      .insert(positions)
      .values({ id: positionId, code: 'P01', name: 'Dev', level: 1, functionRole: 'developer' })
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

    const testEnv = {
      ...env,
      AUTH_JWT_SECRET: 'test-secret-key-min-32-chars-for-security-reasons',
    }

    const tasks: Promise<any>[] = []
    const executionCtx = {
      waitUntil: (promise: Promise<any>) => {
        tasks.push(promise)
      },
      passThroughOnException: () => {},
    }

    const loginRes = await app.request(
      '/api/v2/auth/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, totp: '123456' }),
      },
      testEnv,
      executionCtx as any
    )

    await Promise.all(tasks)

    const loginBody = (await loginRes.json()) as any
    const token = loginBody.token

    // Then call /me
    const tasks2: Promise<any>[] = []
    const executionCtx2 = {
      waitUntil: (promise: Promise<any>) => {
        tasks2.push(promise)
      },
      passThroughOnException: () => {},
    }

    const res = await app.request(
      '/api/v2/auth/me',
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      },
      testEnv,
      executionCtx2 as any
    )

    await Promise.all(tasks2)

    expect(res.status).toBe(200)
    const response = (await res.json()) as any
    // V2 响应格式
    expect(response.success).toBe(true)
    expect(response.data.user).toBeDefined()
    expect(response.data.user.email).toBe(email)
  })
})
