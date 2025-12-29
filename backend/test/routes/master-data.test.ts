import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Hono } from 'hono'
import { env } from 'cloudflare:test'
import { DrizzleD1Database } from 'drizzle-orm/d1'
import { createDb } from '../../src/utils/db.js'
import { MasterDataService } from '../../src/services/system/MasterDataService.js'
import { masterDataRoutes } from '../../src/routes/v2/master-data.js'
import * as schema from '../../src/db/schema.js'
import { AppVariables, Env } from '../../src/types/index.js'
import schemaSql from '../../src/db/schema.sql?raw'

describe('MasterData Routes', () => {
  let app: Hono<{ Bindings: Env; Variables: AppVariables }>
  let db: DrizzleD1Database<typeof schema>
  let service: MasterDataService

  beforeEach(async () => {
    // Apply schema
    const statements = schemaSql.split(';').filter(s => s.trim().length > 0)
    for (const statement of statements) {
      await env.DB.prepare(statement).run()
    }

    db = createDb(env.DB)
    service = new MasterDataService(db)

    // Cleanup
    await db.delete(schema.projects).execute()
    await db.delete(schema.sites).execute()
    await db.delete(schema.accounts).execute()
    await db.delete(schema.vendors).execute()
    await db.delete(schema.currencies).execute()
    await db.delete(schema.categories).execute()
    await db.delete(schema.positions).execute()
    await db.delete(schema.orgDepartments).execute()
    await db.delete(schema.headquarters).execute()

    app = new Hono()

    // Mock middleware to inject service and permissions
    app.use('*', async (c, next) => {
      // @ts-ignore
      c.set('services', {
        masterData: service,
        auth: {} as any,
        user: {} as any,
        salaryPayment: {} as any,
        systemConfig: {} as any,
        finance: {} as any,
        employee: {} as any,
        import: {} as any,
        report: {} as any,
      })
      // Mock permissions
      // @ts-ignore
      c.set('userPosition', {
        id: 'pos1',
        code: 'ADMIN',
        name: 'Admin',
        function_role: 'admin',
        can_manage_subordinates: 1,
        permissions: {
          system: {
            headquarters: ['create', 'read', 'update', 'delete'],
            department: ['create', 'read', 'update', 'delete'],
            site: ['create', 'read', 'update', 'delete'],
            account: ['create', 'read', 'update', 'delete'],
            currency: ['create', 'read', 'update', 'delete'],
            category: ['create', 'read', 'update', 'delete'],
            position: ['create', 'read', 'update', 'delete'],
            org_department: ['create', 'read', 'update', 'delete'],
            vendor: ['create', 'read', 'update', 'delete'],
          },
        },
      })
      await next()
    })

    app.route('/api/v2/master-data', masterDataRoutes)
  })

  describe('Departments', () => {
    it('GET /api/master-data/departments should return departments', async () => {
      await service.createDepartment({ name: 'Dept 1' })

      const tasks: Promise<any>[] = []
      const executionCtx = {
        waitUntil: (promise: Promise<any>) => {
          tasks.push(promise)
        },
        passThroughOnException: () => { },
      }

      const res = await app.request(
        '/api/v2/master-data/departments',
        {
          method: 'GET',
        },
        env,
        executionCtx as any
      )

      await Promise.all(tasks)

      expect(res.status).toBe(200)
      const response = (await res.json()) as any
      // V2 响应格式
      expect(response.success).toBe(true)
      expect(response.data.results.length).toBe(1)
      expect(response.data.results[0].name).toBe('Dept 1')
    })

    it('POST /api/master-data/departments should create department', async () => {
      const tasks: Promise<any>[] = []
      const executionCtx = {
        waitUntil: (promise: Promise<any>) => {
          tasks.push(promise)
        },
        passThroughOnException: () => { },
      }

      const res = await app.request(
        '/api/v2/master-data/departments',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'New Dept', code: 'ND' }),
        },
        env,
        executionCtx as any
      )

      await Promise.all(tasks)

      expect(res.status).toBe(200)
      const response = (await res.json()) as any
      // V2 响应格式
      expect(response.success).toBe(true)
      expect(response.data.name).toBe('New Dept')

      const list = await service.getDepartments()
      expect(list.length).toBe(1)
    })
  })

  describe('Currencies', () => {
    it('POST /api/master-data/currencies should create currency', async () => {
      const tasks: Promise<any>[] = []
      const executionCtx = {
        waitUntil: (promise: Promise<any>) => {
          tasks.push(promise)
        },
        passThroughOnException: () => { },
      }

      const res = await app.request(
        '/api/v2/master-data/currencies',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: 'USD', name: 'Dollar' }),
        },
        env,
        executionCtx as any
      )

      await Promise.all(tasks)

      expect(res.status).toBe(200)
      const response = (await res.json()) as any
      // V2 响应格式
      expect(response.success).toBe(true)
      expect(response.data.code).toBe('USD')
    })
  })

  describe('Vendors', () => {
    it('POST /api/master-data/vendors should create vendor', async () => {
      const res = await app.request('/api/v2/master-data/vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Vendor A' }),
      })

      expect(res.status).toBe(200)
      const response = (await res.json()) as any
      // V2 响应格式
      expect(response.success).toBe(true)
      expect(response.data.name).toBe('Vendor A')
    })
  })
})
