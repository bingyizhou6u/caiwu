import { env } from 'cloudflare:test'
import { describe, it, expect, beforeEach, beforeAll } from 'vitest'
import { UserService } from '../../src/services/UserService'
import * as schema from '../../src/db/schema'
import { uuid, createDb } from '../../src/utils/db'
import schemaSql from '../../src/db/schema.sql?raw'

describe('UserService', () => {
  let userService: UserService

  beforeAll(async () => {
    // Split schema into statements and execute them one by one
    const statements = schemaSql.split(';').filter((s: string) => s.trim().length > 0)
    for (const statement of statements) {
      await env.DB.prepare(statement).run()
    }
  })

  beforeEach(async () => {
    const db = createDb(env.DB)
    await db.delete(schema.employees).run()
    await db.delete(schema.userDepartments).run()
    userService = new UserService(db)
  })

  it('should get user by id', async () => {
    const id = uuid()
    const email = 'test@example.com'
    const db = createDb(env.DB)
    await db
      .insert(schema.employees)
      .values({
        id,
        email,
        name: 'Test User',
        active: 1,
      })
      .run()

    const user = await userService.getUserById(id)
    expect(user).toBeDefined()
    expect(user?.email).toBe(email)
  })

  it('should return null for non-existent user', async () => {
    const user = await userService.getUserById('non-existent-id')
    expect(user).toBeNull()
  })

  it('should get user department id', async () => {
    const userId = uuid()
    const deptId = uuid()
    const email = 'dept@example.com'
    const email2 = 'dept2@example.com'
    const db = createDb(env.DB)

    // Setup: Create user and employee record linked to department
    await db
      .insert(schema.employees)
      .values({
        id: userId,
        email,
        name: 'User 2',
        active: 1,
      })
      .run()

    await db
      .insert(schema.employees)
      .values({
        id: uuid(),
        email: email2,
        departmentId: deptId,
        name: 'Dept Employee',
        active: 1,
      })
      .run()

    // Also insert into user_departments as UserService checks this
    await db
      .insert(schema.userDepartments)
      .values({
        id: uuid(),
        userId,
        departmentId: deptId,
        createdAt: Date.now(),
      })
      .run()

    const resultDeptId = await userService.getUserDepartmentId(userId)
    expect(resultDeptId).toBe(deptId)
  })
})
