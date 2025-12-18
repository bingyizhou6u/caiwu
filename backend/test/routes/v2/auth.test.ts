import { env } from 'cloudflare:test'
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { drizzle } from 'drizzle-orm/d1'
import * as schema from '../../../src/db/schema.js'
import { employees, sessions, positions } from '../../../src/db/schema.js'
import { v4 as uuid } from 'uuid'
import schemaSql from '../../../src/db/schema.sql?raw'
import bcrypt from 'bcryptjs'
import app from '../../../src/index.js'
import { authenticator } from 'otplib'
import { createTestEnv } from '../../test-constants.js'

describe('Auth API V2', () => {
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

  it('POST /api/v2/auth/login should return success response with token', async () => {
    const email = 'test@example.com'
    const password = 'password123'
    const hash = await bcrypt.hash(password, 10)
    const userId = uuid()
    const positionId = uuid()
    const totpSecret = 'secret'

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
        totpSecret,
      })
      .execute()

    const testEnv = {
      ...env,
      ...createTestEnv(),
    }

    const tasks: Promise<any>[] = []
    const executionCtx = {
      waitUntil: (promise: Promise<any>) => {
        tasks.push(promise)
      },
      passThroughOnException: () => {},
    }

    const totp = authenticator.generate(totpSecret)

    const res = await app.request(
      '/api/v2/auth/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, totp }),
      },
      testEnv,
      executionCtx as any
    )

    await Promise.all(tasks)

    if (res.status !== 200) {
      const text = await res.text()
      console.error('Login failed status:', res.status)
      console.error('Login failed body:', text)
      expect(res.status).toBe(200)
    }

    const body = (await res.json()) as any

    // V2 Response Check
    expect(body.success).toBe(true)
    expect(body.data).toBeDefined()
    expect(body.data.token).toBeDefined()
    expect(body.data.user).toBeDefined()
    expect(body.data.user.email).toBe(email)
  })

  it('GET /api/v2/auth/me should return user info in unified format', async () => {
    // First login to get token
    const email = 'test@example.com'
    const password = 'password123'
    const hash = await bcrypt.hash(password, 10)
    const userId = uuid()
    const positionId = uuid()
    const totpSecret = 'secret'

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
        totpSecret,
      })
      .execute()

    const testEnv = {
      ...env,
      ...createTestEnv(),
    }

    const tasks: Promise<any>[] = []
    const executionCtx = {
      waitUntil: (promise: Promise<any>) => {
        tasks.push(promise)
      },
      passThroughOnException: () => {},
    }

    const totp = authenticator.generate(totpSecret)

    const loginRes = await app.request(
      '/api/v2/auth/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, totp }),
      },
      testEnv,
      executionCtx as any
    )

    await Promise.all(tasks)

    const loginBody = (await loginRes.json()) as any
    const token = loginBody.data.token // Access token from data property for V2

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
    const body = (await res.json()) as any

    // V2 Response Check
    expect(body.success).toBe(true)
    expect(body.data).toBeDefined()
    expect(body.data.user).toBeDefined()
    expect(body.data.user.email).toBe(email)
  })
})
