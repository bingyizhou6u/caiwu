import { env } from 'cloudflare:test'
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { drizzle } from 'drizzle-orm/d1'
import * as schema from '../../../src/db/schema.js'
import { employees, sessions, positions, currencies, accounts } from '../../../src/db/schema.js'
import { v4 as uuid } from 'uuid'
import schemaSql from '../../../src/db/schema.sql?raw'
import app from '../../../src/index.js'
import { eq } from 'drizzle-orm'

// Mock middleware globally
vi.mock('../../../src/middleware.js', async () => {
  const actual = await vi.importActual<any>('../../../src/middleware.js')
  return {
    ...actual,
    createAuthMiddleware: () => async (c: any, next: any) => {
      c.set('userId', 'user-admin')
      c.set('userPosition', {
        id: 'pos-admin',
        permissions: {
          system: {
            currency: ['create', 'read', 'update', 'delete'],
          },
        },
      })
      await next()
    },
  }
})

describe('Batch Operations API', () => {
  let db: ReturnType<typeof drizzle<typeof schema>>
  let testEnv: any

  beforeAll(async () => {
    const statements = schemaSql.split(';').filter(s => s.trim().length > 0)
    for (const statement of statements) {
      await env.DB.prepare(statement).run()
    }
    db = drizzle(env.DB, { schema })
    testEnv = {
      ...env,
      AUTH_JWT_SECRET: 'test-secret-key',
    }
  })

  const tasks: Promise<any>[] = []
  const executionCtx = {
    waitUntil: (promise: Promise<any>) => {
      tasks.push(promise)
    },
    passThroughOnException: () => { },
  }

  beforeEach(async () => {
    await db.delete(employees).execute()
    await db.delete(sessions).execute()
    await db.delete(positions).execute()
    await db.delete(currencies).execute()
    await db.delete(accounts).execute()

    // Setup Admin User
    const userId = 'user-admin'
    const positionId = 'pos-admin'

    await db
      .insert(positions)
      .values({
        id: positionId,
        code: 'ADMIN',
        name: 'Admin',
        active: 1,
      })
      .execute()

    await db
      .insert(employees)
      .values({
        id: userId,
        email: 'admin@example.com',
        personalEmail: 'admin@example.com',
        name: 'Admin User',
        positionId,
        active: 1,
      })
      .execute()
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
