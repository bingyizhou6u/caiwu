import { env } from 'cloudflare:test'
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { drizzle } from 'drizzle-orm/d1'
import * as schema from '../../src/db/schema.js'
import { departments, cashFlows, arApDocs } from '../../src/db/schema.js'
import { v4 as uuid } from 'uuid'
import schemaSql from '../../src/db/schema.sql?raw'

// Mock auth middleware
vi.mock('../../src/middleware.js', async () => {
  const actual = await vi.importActual('../../src/middleware.js')
  return {
    ...actual,
    createAuthMiddleware: () => async (c: any, next: any) => {
      c.set('userId', 'user-1')
      c.set('userPosition', { id: 'p1', level: 1, permissions: { report: { finance: ['view'] } } }) // Mock permissions if needed
      await next()
    },
  }
})

vi.mock('../../src/db/index.js', async () => {
  const actual = await vi.importActual<any>('../../src/db/index.js')
  const schema = await import('../../src/db/schema.js')
  const { drizzle } = await import('drizzle-orm/d1')

  return {
    ...actual,
    createDb: (d1: any) => {
      const db = drizzle(d1, { schema })
      // @ts-ignore
      db.transaction = async cb => cb(db)
      return db
    },
  }
})

// Import app after mocking
import app from '../../src/index.js'

describe('Reports API', () => {
  let db: ReturnType<typeof drizzle<typeof schema>>

  beforeAll(async () => {
    const statements = schemaSql.split(';').filter(s => s.trim().length > 0)
    for (const statement of statements) {
      await env.DB.prepare(statement).run()
    }
    db = drizzle(env.DB, { schema })
  })

  beforeEach(async () => {
    await db.delete(cashFlows).execute()
    await db.delete(departments).execute()
    await db.delete(arApDocs).execute()
  })

  it('GET /api/dashboard/stats should return stats', async () => {
    const deptId = uuid()
    await db.insert(departments).values({ id: deptId, name: 'Test Dept', active: 1 }).execute()

    const today = new Date().toISOString().slice(0, 10)
    await db
      .insert(cashFlows)
      .values([
        {
          id: uuid(),
          bizDate: today,
          type: 'income',
          amountCents: 1000,
          departmentId: deptId,
          accountId: uuid(),
        },
      ])
      .execute()

    const res = await app.request(`/api/v2/reports/dashboard/stats?departmentId=${deptId}`, {}, env)
    expect(res.status).toBe(200)
    const response = (await res.json()) as any
    // V2 响应格式
    expect(response.success).toBe(true)
    expect(response.data.today.incomeCents).toBe(1000)
  })

  it('GET /api/department-cash should return cash flow', async () => {
    const deptId = uuid()
    await db.insert(departments).values({ id: deptId, name: 'Test Dept', active: 1 }).execute()

    const today = new Date().toISOString().slice(0, 10)
    await db
      .insert(cashFlows)
      .values([
        {
          id: uuid(),
          bizDate: today,
          type: 'income',
          amountCents: 2000,
          departmentId: deptId,
          accountId: uuid(),
        },
      ])
      .execute()

    const res = await app.request(
      `/api/v2/reports/department-cash?start=${today}&end=${today}&departmentIds=${deptId}`,
      {},
      env
    )
    expect(res.status).toBe(200)
    const response = (await res.json()) as any
    // V2 响应格式
    expect(response.success).toBe(true)
    expect(response.data).toHaveLength(1)
    expect(response.data[0].incomeCents).toBe(2000)
  })

  it('GET /api/ar-ap/summary should return summary', async () => {
    const deptId = uuid()
    const today = new Date().toISOString().slice(0, 10)

    await db
      .insert(arApDocs)
      .values([
        {
          id: uuid(),
          kind: 'AR',
          amountCents: 1000,
          status: 'open',
          issueDate: today,
          departmentId: deptId,
          partyId: uuid(),
        },
      ])
      .execute()

    const res = await app.request(
      `/api/v2/reports/ar-summary?start=${today}&end=${today}&departmentId=${deptId}`,
      {},
      env
    )
    expect(res.status).toBe(200)
    const response = (await res.json()) as any
    // V2 响应格式
    expect(response.success).toBe(true)
    const body = response.data
    expect(body.totalCents).toBe(1000)
  })
})
