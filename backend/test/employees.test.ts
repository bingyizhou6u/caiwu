import { env } from 'cloudflare:test'
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { drizzle } from 'drizzle-orm/d1'
import * as schema from '../src/db/schema.js'
import {
  employees,
  departments,
  orgDepartments,
  positions,
} from '../src/db/schema.js'
import { eq } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import schemaSql from '../src/db/schema.sql?raw'

// Mock auth middleware
const mockUserPosition = {
  id: 'pos-1',
  code: 'hq_admin',
  name: 'HQ Admin',
  function_role: 'admin',
  can_manage_subordinates: 1,
  permissions: {
    hr: { employee: ['read', 'create', 'update'] },
  },
}

const mockUserEmployee = {
  id: 'emp-1',
  orgDepartmentId: 'org-1',
  departmentId: 'dept-1',
}

vi.mock('../src/middleware.js', async () => {
  const actual = await vi.importActual('../src/middleware.js')
  return {
    ...actual,
    createAuthMiddleware: () => async (c: any, next: any) => {
      c.set('userId', 'user-1')
      c.set('userPosition', mockUserPosition)
      c.set('userEmployee', mockUserEmployee)
      await next()
    },
  }
})

vi.mock('../src/db/index.js', async () => {
  const actual = await vi.importActual<any>('../src/db/index.js')
  const { drizzle } = await import('drizzle-orm/d1')
  const schema = await import('../src/db/schema.js')

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
import app from '../src/index.js'

describe('Employees API', () => {
  let db: ReturnType<typeof drizzle<typeof schema>>

  beforeAll(async () => {
    // Apply schema
    const statements = schemaSql.split(';').filter(s => s.trim().length > 0)
    for (const statement of statements) {
      await env.DB.prepare(statement).run()
    }
    db = drizzle(env.DB, { schema })

    // Mock transaction for service in test env
    // @ts-ignore
    db.transaction = async cb => cb(db)
  })

  beforeEach(async () => {
    // Clean up tables
    await db.delete(employees).execute()
    await db.delete(orgDepartments).execute()
    await db.delete(departments).execute()
    await db.delete(positions).execute()

    // Seed initial data for the logged-in user
    await db
      .insert(departments)
      .values({
        id: 'dept-1',
        name: 'HQ Project',
        active: 1,
      })
      .execute()

    await db
      .insert(orgDepartments)
      .values({
        id: 'org-1',
        projectId: 'dept-1',
        name: 'HQ Org',
        active: 1,
      })
      .execute()

    await db
      .insert(positions)
      .values({
        id: 'pos-1',
        code: 'hq_admin',
        name: 'HQ Admin',
        active: 1,
      })
      .execute()

    await db
      .insert(employees)
      .values({
        id: 'emp-1',
        name: 'Admin',
        email: 'admin@example.com',
        departmentId: 'dept-1',
        orgDepartmentId: 'org-1',
        positionId: 'pos-1',
        status: 'regular',
        active: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      .execute()
  })

  it('GET /api/v2/employees should return list of employees', async () => {
    const res = await app.request('/api/v2/employees', {}, env)
    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    // V2 响应格式
    expect(body.success).toBe(true)
    expect(body.data.results.length).toBeGreaterThanOrEqual(1)
    expect(body.data.results[0].email).toBe('admin@example.com')
  })

  it.skip('POST /api/employees/create-from-user should create employee', async () => {
    // Create a new user to migrate
    const newUserId = uuid()
    const newUserEmail = 'new@example.com'
    await db
      .insert(employees)
      .values({
        id: newUserId,
        email: newUserEmail,
        name: 'New User',
        active: 1,
      })
      .execute()

    const payload = {
      user_id: newUserId,
      orgDepartmentId: 'org-1',
      positionId: 'pos-1',
      join_date: '2023-01-01',
      probation_salary_cents: 500000,
      regular_salary_cents: 600000,
      birthday: '1995-01-01',
    }

    const res = await app.request(
      '/api/employees/create-from-user',
      {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' },
      },
      env
    )

    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    expect(body.id).toBeDefined()

    // Verify employee created
    const emp = await db.select().from(employees).where(eq(employees.email, newUserEmail)).get()
    expect(emp).toBeDefined()
    expect(emp!.departmentId).toBe('dept-1')
  })

  it('PUT /api/employees/:id should update employee', async () => {
    const updateData = {
      name: 'Updated Name',
      departmentId: 'dept-1', // Keep same department
      positionId: 'pos-1',
    }

    const res = await app.request(
      '/api/employees/emp-1',
      {
        method: 'PUT',
        body: JSON.stringify(updateData),
        headers: { 'Content-Type': 'application/json' },
      },
      env
    )

    expect(res.status).toBe(200)

    const updatedEmp = await db.select().from(employees).where(eq(employees.id, 'emp-1')).get()
    expect(updatedEmp!.name).toBe('Updated Name')
  })
})
