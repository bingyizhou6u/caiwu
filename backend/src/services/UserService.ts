import { DrizzleD1Database } from 'drizzle-orm/d1'
import { eq, and, isNotNull } from 'drizzle-orm'
import { employees, positions, userDepartments, departments, orgDepartments } from '../db/schema.js'
import * as schema from '../db/schema.js'
import { Errors } from '../utils/errors.js'

export class UserService {
    /**
     * Helper service to lookup employee information based on Auth User ID.
     * Note: The standalone 'users' table has been deprecated.
     * In the current architecture, the Auth User ID is the Employee ID.
     */
    constructor(private db: DrizzleD1Database<typeof schema>) { }

    async getUserById(id: string) {
        const user = await this.db.select()
            .from(employees)
            .where(eq(employees.id, id))
            .get()
        return user || null
    }

    async getUserByEmail(email: string) {
        const user = await this.db.select()
            .from(employees)
            .where(eq(employees.personalEmail, email))
            .get()
        return user || null
    }



    async getUserPosition(userId: string) {
        const employee = await this.db.select({
            positionId: employees.positionId
        })
            .from(employees)
            .where(and(
                eq(employees.id, userId),
                eq(employees.active, 1)
            ))
            .get()

        if (!employee?.positionId) return null

        const result = await this.db.select({
            id: positions.id,
            code: positions.code,
            name: positions.name,
            level: positions.level,
            functionRole: positions.functionRole,
            canManageSubordinates: positions.canManageSubordinates,
            permissions: positions.permissions
        })
            .from(positions)
            .where(and(
                eq(positions.id, employee.positionId),
                eq(positions.active, 1)
            ))
            .get()

        if (!result) return null

        let permissions = {}
        try {
            permissions = JSON.parse(result.permissions || '{}')
        } catch (err) {
            console.error('Failed to parse permissions JSON:', err)
        }

        return {
            id: result.id,
            code: result.code,
            name: result.name,
            level: result.level,
            functionRole: result.functionRole,
            canManageSubordinates: result.canManageSubordinates,
            permissions
        }
    }

    async isHQUser(userId: string): Promise<boolean> {
        // Check user_departments table
        const result = await this.db.select({ isHq: departments.name })
            .from(userDepartments)
            .innerJoin(departments, eq(departments.id, userDepartments.departmentId))
            .where(and(
                eq(userDepartments.userId, userId),
                eq(departments.name, '总部')
            ))
            .get()

        return !!result
    }

    async getUserGroupId(userId: string): Promise<string | null> {
        const employee = await this.getUserById(userId)
        if (!employee?.orgDepartmentId) return null

        const group = await this.db.select({ id: orgDepartments.id })
            .from(orgDepartments)
            .where(and(
                eq(orgDepartments.id, employee.orgDepartmentId),
                isNotNull(orgDepartments.parentId)
            ))
            .get()

        return group?.id || null
    }

    async getUserOrgDepartmentId(userId: string): Promise<string | null> {
        const employee = await this.getUserById(userId)
        return employee?.orgDepartmentId || null
    }

    async getUserDepartmentIds(userId: string): Promise<string[]> {
        // Only check new user_departments mapping table
        const userDepts = await this.db.select({ departmentId: userDepartments.departmentId })
            .from(userDepartments)
            .where(eq(userDepartments.userId, userId))
            .all()

        return userDepts.map(r => r.departmentId)
    }

    async getUserDepartmentId(userId: string): Promise<string | null> {
        const ids = await this.getUserDepartmentIds(userId)
        return ids.length > 0 ? ids[0] : null
    }
}
