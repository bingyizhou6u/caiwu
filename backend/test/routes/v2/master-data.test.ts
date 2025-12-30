import { env } from 'cloudflare:test'
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { drizzle } from 'drizzle-orm/d1'
import * as schema from '../../../src/db/schema.js'
import { employees, sessions, positions, currencies } from '../../../src/db/schema.js'
import { v4 as uuid } from 'uuid'
import schemaSql from '../../../src/db/schema.sql?raw'
import app from '../../../src/index.js'

// Mock middleware globally
vi.mock('../../../src/middleware.js', async () => {
  const actual = await vi.importActual<any>('../../../src/middleware.js')
  return {
    ...actual,
    createAuthMiddleware: () => async (c: any, next: any) => {
      c.set('userId', 'user-admin')
      c.set('employeeId', 'user-admin')
      c.set('userPosition', {
        id: 'pos-admin',
        code: 'ADMIN',
        name: 'Admin',
        canManageSubordinates: 1,
        dataScope: 'all',
        permissions: {
          system: {
            currency: ['view', 'create', 'update', 'delete'],
          },
        },
      })
      c.set('userEmployee', {
        id: 'user-admin',
        orgDepartmentId: null,
        projectId: null,
      })
      c.set('departmentModules', ['*'])
      await next()
    },
  }
})

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

    const testEnv = {
      ...env,
      AUTH_JWT_SECRET: 'test-secret-key',
    }

    const tasks: Promise<any>[] = []
    const executionCtx = {
      waitUntil: (promise: Promise<any>) => {
        tasks.push(promise)
      },
      passThroughOnException: () => { },
    }

    // 2. Create Currency (V2)
    const createRes = await app.request(
      '/api/v2/currencies',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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

    // 3. List Currencies (V2)
    const listRes = await app.request(
      '/api/v2/currencies',
      {
        method: 'GET',
        headers: {},
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
