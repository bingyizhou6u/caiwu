import { env } from 'cloudflare:test'
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { drizzle } from 'drizzle-orm/d1'
import * as schema from '../../../src/db/schema.js'
import { employees, sessions, positions, currencies, accounts } from '../../../src/db/schema.js'
import { v4 as uuid } from 'uuid'
import schemaSql from '../../../src/db/schema.sql?raw'
import bcrypt from 'bcryptjs'
import app from '../../../src/index.js'
import { authenticator } from 'otplib'
import { eq } from 'drizzle-orm'

describe('Batch Operations API', () => {
  let db: ReturnType<typeof drizzle<typeof schema>>
  let token: string
  let testEnv: any

  beforeAll(async () => {
    const statements = schemaSql.split(';').filter(s => s.trim().length > 0)
    for (const statement of statements) {
      await env.DB.prepare(statement).run()
    }
    db = drizzle(env.DB, { schema })
    testEnv = {
      ...env,
      AUTH_JWT_SECRET: 'test-secret-key-min-32-chars-for-security-reasons',
      INIT_ADMIN_PASSWORD_HASH: '$2b$10$8YHB2Aa4Kg6rUdl2GZcrNe67/Ux7Y3X84/RkWQoK94tIahkzgHJve',
    }
  })

  const tasks: Promise<any>[] = []
  const executionCtx = {
    waitUntil: (promise: Promise<any>) => {
      tasks.push(promise)
    },
    passThroughOnException: () => {},
  }

  beforeEach(async () => {
    await db.delete(employees).execute()
    await db.delete(sessions).execute()
    await db.delete(positions).execute()
    await db.delete(currencies).execute()
    await db.delete(accounts).execute()

    // Setup Admin User
    const email = 'admin@example.com'
    const password = 'password123'
    const hash = await bcrypt.hash(password, 10)
    const userId = uuid()
    const positionId = uuid()
    const totpSecret = 'secret'

    const permissions = JSON.stringify({
      system: {
        currency: ['create', 'read', 'update', 'delete'],
      },
    })

    await db
      .insert(positions)
      .values({
        id: positionId,
        code: 'ADMIN',
        name: 'Admin',
        level: 1,
        permissions,
      })
      .execute()

    await db
      .insert(employees)
      .values({
        id: userId,
        email,
        personalEmail: email,
        name: 'Admin User',
        positionId,
        active: 1,
        passwordHash: hash,
        totpSecret,
      })
      .execute()

    // Login
    const totp = authenticator.generate(totpSecret)
    const loginRes = await app.request(
      '/api/v2/auth/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, totp }),
      },
      testEnv as any,
      executionCtx as any
    )

    await Promise.all(tasks)

    const loginBody = (await loginRes.json()) as any
    token = loginBody.data.token
  })

  it('should batch create and then delete currencies', async () => {
    // Seed currencies manually
    await db
      .insert(currencies)
      .values([
        { code: 'USD', name: 'US Dollar', active: 1 },
        { code: 'EUR', name: 'Euro', active: 1 },
        { code: 'JPY', name: 'Japanese Yen', active: 1 },
      ])
      .execute()

    // Batch Delete USD and EUR
    const res = await app.request(
      '/api/v2/currencies/batch',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ids: ['USD', 'EUR'],
          operation: 'delete',
        }),
      },
      testEnv as any,
      executionCtx as any
    )

    await Promise.all(tasks)

    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    expect(body.success).toBe(true)
    expect(body.data.successCount).toBe(2)
    expect(body.data.failureCount).toBe(0)

    // Verify Deletion
    const remaining = await db.select().from(currencies).all()
    expect(remaining.length).toBe(1)
    expect(remaining[0].code).toBe('JPY')
  })

  it('should report failures when deleting used currency', async () => {
    // Seed currencies and account
    await db
      .insert(currencies)
      .values([
        { code: 'USD', name: 'US Dollar', active: 1 },
        { code: 'CNY', name: 'RMB', active: 1 },
      ])
      .execute()

    await db
      .insert(accounts)
      .values({
        id: uuid(),
        name: 'Test Account',
        type: 'cash',
        currency: 'USD',
        active: 1,
      })
      .execute()

    // Batch Delete USD (used) and CNY (unused)
    const res = await app.request(
      '/api/v2/currencies/batch',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ids: ['USD', 'CNY'],
          operation: 'delete',
        }),
      },
      testEnv as any,
      executionCtx as any
    )

    await Promise.all(tasks)

    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    expect(body.success).toBe(true)
    // USD fails, CNY succeeds
    expect(body.data.successCount).toBe(1)
    expect(body.data.failureCount).toBe(1)
    expect(body.data.failures[0].id).toBe('USD')
    expect(body.data.failures[0].reason).toContain('无法删除') // Match partial error message

    // Verify State
    const finalCurrencies = await db
      .select()
      .from(currencies)
      .where(eq(currencies.code, 'USD'))
      .all()
    expect(finalCurrencies.length).toBe(1) // USD still exists
  })

  it('should batch deactivate currencies', async () => {
    await db
      .insert(currencies)
      .values([{ code: 'USD', name: 'US Dollar', active: 1 }])
      .execute()

    const res = await app.request(
      '/api/v2/currencies/batch',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ids: ['USD'],
          operation: 'deactivate',
        }),
      },
      testEnv as any,
      executionCtx as any
    )

    await Promise.all(tasks)

    expect(res.status).toBe(200)
    const usd = await db.select().from(currencies).where(eq(currencies.code, 'USD')).get()
    expect(usd?.active).toBe(0)
  })
})
