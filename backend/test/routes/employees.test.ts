import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { Hono } from 'hono'
import { env } from 'cloudflare:test'
import { drizzle } from 'drizzle-orm/d1'
import { createDb } from '../../src/utils/db.js'
import { employeesRoutes } from '../../src/routes/v2/employees.js'
import { EmployeeService } from '../../src/services/EmployeeService.js'
import { PermissionService } from '../../src/services/PermissionService.js'
import * as schema from '../../src/db/schema.js'
import schemaSql from '../../src/db/schema.sql?raw'
import { v4 as uuid } from 'uuid'

// Mock permissions utils specifically for the route handlers that import them directly
vi.mock('../../src/utils/permissions.js', async () => {
  const actual = await vi.importActual<any>('../../src/utils/permissions.js')
  return {
    ...actual,
    hasPermission: () => true,
    // Mock getUserPosition to return a high-level position
    getUserPosition: () => ({
      id: 'pos-admin',
      level: 1, // Admin level sees all
      permissions: {},
    }),
    getUserEmployee: () => ({
      id: 'emp-admin',
      departmentId: 'dept-1',
      orgDepartmentId: 'org-dept-1',
    }),
  }
})

describe('Employees API Integration', () => {
  let app: Hono<any>
  let db: ReturnType<typeof drizzle<typeof schema>>
  let service: EmployeeService
  let permissionService: PermissionService

  beforeAll(async () => {
    const statements = schemaSql.split(';').filter(s => s.trim().length > 0)
    for (const statement of statements) {
      await env.DB.prepare(statement).run()
    }
    db = createDb(env.DB)

    const mockEmailService = {
      sendActivationEmail: vi.fn().mockResolvedValue({ success: true }),
      sendLoginNotificationEmail: vi.fn().mockResolvedValue({ success: true }),
      sendPasswordResetLinkEmail: vi.fn().mockResolvedValue({ success: true }),
      sendPasswordChangedNotificationEmail: vi.fn().mockResolvedValue({ success: true }),
      sendTotpResetEmail: vi.fn().mockResolvedValue({ success: true }),
      sendEmail: vi.fn().mockResolvedValue({ success: true }),
    } as any

    service = new EmployeeService(db, mockEmailService)
    permissionService = new PermissionService(db)
  })

  beforeEach(async () => {
    await db.delete(schema.employees).execute()
    await db.delete(schema.departments).execute()
    await db.delete(schema.positions).execute()
    await db.delete(schema.orgDepartments).execute()

    app = new Hono()

    // Inject services and user context
    app.use('*', async (c, next) => {
      c.set('services', {
        employee: service,
        permission: permissionService,
        auth: { requestPasswordReset: vi.fn() }, // Mock auth service for reset-password route
      })
      // Mock user employee and position in context for middlewares/handlers that check c.get() directly
      c.set('userEmployee', {
        id: 'emp-admin',
        departmentId: 'dept-1',
        orgDepartmentId: 'org-dept-1',
      })
      c.set('userPosition', {
        id: 'pos-admin',
        level: 1,
      })
      c.set('db', db)
      await next()
    })

    app.route('/api', employeesRoutes)
  })

  it('POST /employees should create an employee', async () => {
    // Setup dependencies
    const projectId = uuid()
    await db
      .insert(schema.departments)
      .values({ id: projectId, name: 'Proj 1', active: 1 })
      .execute()
    const orgDeptId = uuid()
    await db
      .insert(schema.orgDepartments)
      .values({ id: orgDeptId, name: 'HR', projectId, active: 1 })
      .execute()
    const positionId = uuid()
    await db
      .insert(schema.positions)
      .values({
        id: positionId,
        name: 'Dev',
        code: 'DEV',
        level: 3,
        functionRole: 'tech',
        active: 1,
      })
      .execute()

    const res = await app.request('/api/v2/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test New',
        personalEmail: 'new@test.com',
        orgDepartmentId: orgDeptId,
        departmentId: projectId,
        positionId: positionId,
        joinDate: '2023-01-01',
        workSchedule: 'standard',
        probationMonths: 3,
        annualLeaveCycleMonths: 12,
      }),
    })

    expect(res.status).toBe(200)
    const response = (await res.json()) as any
    // V2 响应格式
    expect(response.success).toBe(true)
    expect(response.data.id).toBeDefined()
    expect(response.data.personalEmail).toBe('new@test.com')

    const inDb = await service.getById(response.data.id)
    expect(inDb).toBeDefined()
  })

  it('GET /employees should list employees', async () => {
    // Create an employee first
    const projectId = uuid()
    await db
      .insert(schema.departments)
      .values({ id: projectId, name: 'Proj 1', active: 1 })
      .execute()
    const orgDeptId = uuid()
    await db
      .insert(schema.orgDepartments)
      .values({ id: orgDeptId, name: 'HR', projectId, active: 1 })
      .execute()
    const positionId = uuid()
    await db
      .insert(schema.positions)
      .values({
        id: positionId,
        name: 'Dev',
        code: 'DEV',
        level: 3,
        functionRole: 'tech',
        active: 1,
      })
      .execute()

    await service.create({
      name: 'List Item',
      personalEmail: 'list@test.com',
      orgDepartmentId: orgDeptId,
      departmentId: projectId,
      positionId: positionId,
      joinDate: '2023-01-01',
    })

    const res = await app.request('/api/v2/employees', {
      method: 'GET',
    })

    expect(res.status).toBe(200)
    const response = (await res.json()) as any
    // V2 响应格式
    expect(response.success).toBe(true)
    const body = response.data
    expect(body.results.length).toBeGreaterThanOrEqual(1)
    expect(body.results[0].name).toBe('List Item')
  })

  it('GET /employees/:id should return employee details', async () => {
    const projectId = uuid()
    await db
      .insert(schema.departments)
      .values({ id: projectId, name: 'Proj 1', active: 1 })
      .execute()
    const orgDeptId = uuid()
    await db
      .insert(schema.orgDepartments)
      .values({ id: orgDeptId, name: 'HR', projectId, active: 1 })
      .execute()
    const positionId = uuid()
    await db
      .insert(schema.positions)
      .values({
        id: positionId,
        name: 'Dev',
        code: 'DEV',
        level: 3,
        functionRole: 'tech',
        active: 1,
      })
      .execute()

    const created = await service.create({
      name: 'Detail Item',
      personalEmail: 'detail@test.com',
      orgDepartmentId: orgDeptId,
      departmentId: projectId,
      positionId: positionId,
      joinDate: '2023-01-01',
    })

    const res = await app.request(`/api/v2/employees/${created.id}`, {
      method: 'GET',
    })

    expect(res.status).toBe(200)
    const response = (await res.json()) as any
    // V2 响应格式
    expect(response.success).toBe(true)
    const body = response.data
    expect(body.id).toBe(created.id)
    expect(body.name).toBe('Detail Item')
  })

  it('PUT /employees/:id should update employee', async () => {
    const projectId = uuid()
    await db
      .insert(schema.departments)
      .values({ id: projectId, name: 'Proj 1', active: 1 })
      .execute()
    const orgDeptId = uuid()
    await db
      .insert(schema.orgDepartments)
      .values({ id: orgDeptId, name: 'HR', projectId, active: 1 })
      .execute()
    const positionId = uuid()
    await db
      .insert(schema.positions)
      .values({
        id: positionId,
        name: 'Dev',
        code: 'DEV',
        level: 3,
        functionRole: 'tech',
        active: 1,
      })
      .execute()

    const created = await service.create({
      name: 'Old Name',
      personalEmail: 'update@test.com',
      orgDepartmentId: orgDeptId,
      departmentId: projectId,
      positionId: positionId,
      joinDate: '2023-01-01',
    })

    const res = await app.request(`/api/v2/employees/${created.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'New Name',
        personalEmail: 'update@test.com', // Required field in schema typically? or optional in update. Schema says personalEmail is optional in update but let's see.
        // UpdateEmployeeSchema usually makes most fields optional.
      }),
    })

    expect(res.status).toBe(200)
    const response = (await res.json()) as any
    // V2 响应格式
    expect(response.success).toBe(true)
    const body = response.data
    expect(body.id).toBe(created.id)
    // Service.update returns { id } only
    // expect(body.name).toBe('New Name')

    const updated = await service.getById(created.id)
    expect(updated?.name).toBe('New Name')
  })
})
