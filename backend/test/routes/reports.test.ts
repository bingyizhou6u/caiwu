import { env } from 'cloudflare:test'
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { v4 as uuid } from 'uuid'
import { drizzle } from 'drizzle-orm/d1'
import * as schema from '../../src/db/schema.js'
import {
  cashFlows,
  projects,
  orgDepartments,
  arApDocs,
} from '../../src/db/schema.js'
import schemaSql from '../../src/db/schema.sql?raw'
import app from '../../src/index.js'

// Mock middleware
vi.mock('../../src/middleware.js', async () => {
  const actual = await vi.importActual<any>('../../src/middleware.js')
  return {
    ...actual,
    createAuthMiddleware: () => async (c: any, next: any) => {
      c.set('userId', 'user-admin')
      c.set('userPosition', {
        id: 'pos-admin',
        permissions: {
          report: {
            dashboard: ['read'],
            cash_flow: ['read'],
            ar_ap: ['read'],
          },
        },
      })
      await next()
    },
  }
})

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
    await db.delete(projects).execute()
    await db.delete(arApDocs).execute()
  })

  it('GET /api/v2/reports/dashboard/stats should return stats', async () => {
    const deptId = uuid()
    // Use projects table instead of departments
    await db.insert(projects).values({
      id: deptId,
      code: 'TEST-DEPT',
      name: 'Test Dept',
      active: 1
    }).execute()

    const today = new Date().toISOString().slice(0, 10)
    await db
      .insert(cashFlows)
      .values([
        {
          id: uuid(),
          bizDate: today,
          type: 'income',
          amountCents: 1000,
          projectId: deptId,
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

  it('GET /api/v2/reports/department-cash should return cash flow', async () => {
    const deptId = uuid()
    await db.insert(projects).values({
      id: deptId,
      code: 'TEST-DEPT-2',
      name: 'Test Dept 2',
      active: 1
    }).execute()

    const today = new Date().toISOString().slice(0, 10)
    await db
      .insert(cashFlows)
      .values([
        {
          id: uuid(),
          bizDate: today,
          type: 'income',
          amountCents: 2000,
          projectId: deptId,
          accountId: uuid(),
        },
      ])
      .execute()

    const res = await app.request(
      `/api/v2/reports/department-cash?departmentId=${deptId}&startDate=${today}&endDate=${today}`,
      {},
      env
    )
    expect(res.status).toBe(200)
    const response = (await res.json()) as any
    expect(response.success).toBe(true)
    expect(response.data.income).toBe(2000)
  })

  it('GET /api/v2/reports/ar-summary should return AR summary', async () => {
    const deptId = uuid()
    await db.insert(projects).values({
      id: deptId,
      code: 'TEST-DEPT-3',
      name: 'Test Dept 3',
      active: 1
    }).execute()

    await db
      .insert(arApDocs)
      .values([
        {
          id: uuid(),
          kind: 'AR',
          amountCents: 5000,
          projectId: deptId,
          status: 'open',
          dueDate: new Date().toISOString(),
        },
      ])
      .execute()

    const res = await app.request(`/api/v2/reports/ar-summary?departmentId=${deptId}`, {}, env)
    expect(res.status).toBe(200)
    const response = (await res.json()) as any
    expect(response.success).toBe(true)
    expect(response.data.totalAmount).toBe(5000)
  })
})
