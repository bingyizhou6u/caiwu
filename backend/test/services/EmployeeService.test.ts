import { env } from 'cloudflare:test'
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { drizzle } from 'drizzle-orm/d1'
import { EmployeeService } from '../../src/services/EmployeeService.js'
import {  employees, departments, orgDepartments, positions } from '../../src/db/schema.js'
import { eq } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import schemaSql from '../../src/db/schema.sql?raw'

import * as schema from '../../src/db/schema.js'

describe('EmployeeService', () => {
    let service: EmployeeService
    let db: ReturnType<typeof drizzle<typeof schema>>

    beforeAll(async () => {
        // Apply schema
        // Apply schema
        const statements = schemaSql.split(';').filter(s => s.trim().length > 0)
        for (const statement of statements) {
            await env.DB.prepare(statement).run()
        }
        db = drizzle(env.DB, { schema })
        // Mock transaction for test environment limitation
        // @ts-ignore
        db.transaction = async (cb) => cb(db)
        service = new EmployeeService(db)
    })

    beforeEach(async () => {
        // Clean up tables
        await db.delete(employees).execute()
        await db.delete(orgDepartments).execute()
        await db.delete(departments).execute()
        await db.delete(positions).execute()
    })

    it('should migrate user to employee', async () => {
        // 1. Setup Data
        const userId = uuid()
        const userEmail = 'test@example.com'
        await db.insert(employees).values({
            id: userId,
            email: userEmail,
            name: 'User One',
            active: 1
        }).execute()

        const projectId = uuid()
        await db.insert(departments).values({
            id: projectId,
            name: 'Test Project',
            active: 1
        }).execute()

        const orgDeptId = uuid()
        await db.insert(orgDepartments).values({
            id: orgDeptId,
            projectId: projectId,
            name: 'Test Org Dept',
            active: 1
        }).execute()

        const positionId = uuid()
        await db.insert(positions).values({
            id: positionId,
            code: 'dev',
            name: 'Developer',
            level: 3,
            functionRole: 'developer',
            active: 1
        }).execute()

        // 2. Run Migration
        const result = await service.migrateFromUser(userId, {
            orgDepartmentId: orgDeptId,
            positionId: positionId,
            joinDate: '2023-01-01',
            // Salary data now managed via employee_salaries table
            birthday: '1990-01-01'
        })

        expect(result.id).toBeDefined()

        // 3. Verify Employee Created
        const employee = await db.select().from(employees).where(eq(employees.id, result.id)).get()
        expect(employee).toBeDefined()
        expect(employee!.email).toBe(userEmail)
        expect(employee!.departmentId).toBe(projectId)
        expect(employee!.positionId).toBe(positionId)

        // 4. Verify User Updated
        const updatedUser = await db.select().from(employees).where(eq(employees.id, userId)).get()
        expect(updatedUser!.positionId).toBe(positionId)
        expect(updatedUser!.departmentId).toBe(projectId)
        expect(updatedUser!.orgDepartmentId).toBe(orgDeptId)
    })
})
