import { env } from 'cloudflare:test'
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { drizzle } from 'drizzle-orm/d1'
import { EmployeeService } from '../../src/services/hr/EmployeeService.js'
import { employees, projects, orgDepartments, positions } from '../../src/db/schema.js'
import { eq } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import schemaSql from '../../src/db/schema.sql?raw'
import * as schema from '../../src/db/schema.js'

describe('EmployeeService', () => {
  let service: EmployeeService
  let db: ReturnType<typeof drizzle<typeof schema>>

  beforeAll(async () => {
    // Apply schema
    const statements = schemaSql.split(';').filter(s => s.trim().length > 0)
    for (const statement of statements) {
      await env.DB.prepare(statement).run()
    }
    db = drizzle(env.DB, { schema })
    // Mock transaction for test environment limitation
    // @ts-ignore
    db.transaction = async cb => cb(db)
    const mockEmailService = {
      sendActivationEmail: vi.fn(),
      sendLoginNotificationEmail: vi.fn(),
      sendPasswordResetLinkEmail: vi.fn(),
      sendPasswordChangedNotificationEmail: vi.fn(),
      sendTotpResetEmail: vi.fn(),
      sendEmail: vi.fn(),
    } as any
    service = new EmployeeService(db, mockEmailService)
  })

  beforeEach(async () => {
    // Clean up tables
    await db.delete(employees).execute()
    await db.delete(orgDepartments).execute()
    await db.delete(projects).execute()
    await db.delete(positions).execute()
  })

  it('should create a new employee', async () => {
    const projectId = uuid()
    await db
      .insert(projects)
      .values({ id: projectId, code: 'PRJ1', name: 'Test Project', active: 1 })
      .execute()

    const orgDeptId = uuid()
    await db
      .insert(orgDepartments)
      .values({ id: orgDeptId, projectId: projectId, name: 'Test Org Dept', active: 1 })
      .execute()

    const positionId = uuid()
    await db
      .insert(positions)
      .values({
        id: positionId,
        code: 'dev',
        name: 'Developer',
        active: 1,
      })
      .execute()

    const employeeData = {
      name: 'New Employee',
      personalEmail: 'new@example.com',
      orgDepartmentId: orgDeptId,
      positionId: positionId,
      joinDate: '2023-01-01',
      workSchedule: 'standard',
      probationMonths: 3,
      annualLeaveCycleMonths: 12,
    }

    const result = await service.create(employeeData)

    expect(result.id).toBeDefined()

    const stored = await db.select().from(employees).where(eq(employees.id, result.id)).get()
    expect(stored!.projectId).toBe(projectId) // Derived from orgDept
  })

  it('should update an existing employee', async () => {
    const id = uuid()
    await db
      .insert(employees)
      .values({
        id,
        name: 'Old Name',
        email: 'test@example.com',
        personalEmail: 'test@example.com',
      } as any)
      .execute()

    const updated = await service.update(id, { name: 'New Name' })
    expect(updated.id).toBe(id)

    const stored = await db.select().from(employees).where(eq(employees.id, id)).get()
    expect(stored!.name).toBe('New Name')
  })

  it('should get employee by id', async () => {
    const id = uuid()
    await db
      .insert(employees)
      .values({
        id,
        name: 'John Doe',
        email: 'john@example.com',
        personalEmail: 'john@example.com',
      } as any)
      .execute()

    const result = await service.getById(id)
    expect(result!.id).toBe(id)
    expect(result!.name).toBe('John Doe')
  })

  it('should list employees with filters', async () => {
    const id1 = uuid()
    await db
      .insert(employees)
      .values({
        id: id1,
        name: 'Alice',
        email: 'alice@example.com',
        personalEmail: 'alice@example.com',
        status: 'regular',
        active: 1,
      } as any)
      .execute()

    const id2 = uuid()
    await db
      .insert(employees)
      .values({
        id: id2,
        name: 'Bob',
        email: 'bob@example.com',
        personalEmail: 'bob@example.com',
        status: 'left',
        active: 0,
      } as any)
      .execute()

    const results = await service.getAll({ status: 'regular' })
    expect(results.length).toBeGreaterThanOrEqual(1)
    expect(results.find((e: any) => e.id === id1)).toBeDefined()
    expect(results.find((e: any) => e.id === id2)).toBeUndefined()
  })

  it('should migrate user to employee', async () => {
    // 1. Setup Data
    const userId = uuid()
    const userEmail = 'test@example.com'
    await db
      .insert(employees)
      .values({
        id: userId,
        email: userEmail,
        name: 'User One',
        active: 1,
      } as any)
      .execute()

    const projectId = uuid()
    await db
      .insert(projects)
      .values({
        id: projectId,
        name: 'Test Project',
        code: 'PRJ1',
        active: 1,
      })
      .execute()

    const orgDeptId = uuid()
    await db
      .insert(orgDepartments)
      .values({
        id: orgDeptId,
        projectId: projectId,
        name: 'Test Org Dept',
        active: 1,
      })
      .execute()

    const positionId = uuid()
    await db
      .insert(positions)
      .values({
        id: positionId,
        code: 'dev',
        name: 'Developer',
        active: 1,
      })
      .execute()

    // 2. Run Migration
    const result = await service.migrateFromUser(userId, {
      orgDepartmentId: orgDeptId,
      positionId: positionId,
      joinDate: '2023-01-01',
      // Salary data now managed via employee_salaries table
      birthday: '1990-01-01',
    })

    expect(result.id).toBeDefined()

    // 3. Verify Employee Created
    const employee = await db.select().from(employees).where(eq(employees.id, result.id)).get()
    expect(employee).toBeDefined()
    expect(employee!.email).toBe(userEmail)
    expect(employee!.projectId).toBe(projectId)
    expect(employee!.positionId).toBe(positionId)

    // 4. Verify User Updated
    const updatedUser = await db.select().from(employees).where(eq(employees.id, userId)).get()
    expect(updatedUser!.positionId).toBe(positionId)
    expect(updatedUser!.projectId).toBe(projectId)
    expect(updatedUser!.orgDepartmentId).toBe(orgDeptId)
  })
})
