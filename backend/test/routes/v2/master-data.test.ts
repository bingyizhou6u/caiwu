import { env } from 'cloudflare:test'
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { drizzle } from 'drizzle-orm/d1'
import * as schema from '../../../src/db/schema.js'
import { employees, sessions, positions, currencies } from '../../../src/db/schema.js'
import { v4 as uuid } from 'uuid'
import schemaSql from '../../../src/db/schema.sql?raw'
import bcrypt from 'bcryptjs'
import app from '../../../src/index.js'
import { authenticator } from 'otplib'

describe('MasterData API V2', () => {
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
    await db.delete(currencies).execute()
  })

  it('should allow creating and listing currencies with unified response format', async () => {
    // 1. Setup User with Permissions
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

    const testEnv = {
      ...env,
      AUTH_JWT_SECRET: 'test-secret-key-min-32-chars-for-security-reasons',
      INIT_ADMIN_PASSWORD_HASH: '$2b$10$8YHB2Aa4Kg6rUdl2GZcrNe67/Ux7Y3X84/RkWQoK94tIahkzgHJve',
    }

    const tasks: Promise<any>[] = []
    const executionCtx = {
      waitUntil: (promise: Promise<any>) => {
        tasks.push(promise)
      },
      passThroughOnException: () => {},
    }

    // 2. Login to get token
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

    expect(loginRes.status).toBe(200)
    const loginBody = (await loginRes.json()) as any
    const token = loginBody.data.token
    expect(token).toBeDefined()

    // 3. Create Currency (V2)
    const createRes = await app.request(
      '/api/v2/currencies',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code: 'CNY', name: 'Chinese Yuan' }),
      },
      testEnv as any,
      executionCtx as any
    )

    await Promise.all(tasks)

    expect(createRes.status).toBe(200)
    const createBody = (await createRes.json()) as any
    expect(createBody.success).toBe(true)
    expect(createBody.data).toBeDefined()
    expect(createBody.data.code).toBe('CNY')
    expect(createBody.data.name).toBe('Chinese Yuan')

    // 4. List Currencies (V2)
    const listRes = await app.request(
      '/api/v2/currencies',
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      testEnv as any,
      executionCtx as any
    )

    await Promise.all(tasks)

    expect(listRes.status).toBe(200)
    const listBody = (await listRes.json()) as any
    expect(listBody.success).toBe(true)
    expect(listBody.data).toBeDefined()
    expect(listBody.data.results).toBeInstanceOf(Array)
    expect(listBody.data.results.length).toBeGreaterThan(0)
    const found = listBody.data.results.find((c: any) => c.code === 'CNY')
    expect(found).toBeDefined()
    expect(found.name).toBe('Chinese Yuan')
  })
})
