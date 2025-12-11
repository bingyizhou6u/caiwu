import { DrizzleD1Database } from 'drizzle-orm/d1'
import { eq, and, isNotNull } from 'drizzle-orm'
import { employees, positions, userDepartments, departments, orgDepartments } from '../db/schema.js'
import * as schema from '../db/schema.js'
import { Errors } from '../utils/errors.js'

export class UserService {
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

    async getUserEmployeeId(userId: string): Promise<string | null> {
        const user = await this.getUserById(userId)
        if (!user?.email) return null

        const employee = await this.db.select({ id: employees.id })
            .from(employees)
            .where(and(
                eq(employees.personalEmail, user.email), // 使用个人邮箱进行查找
                eq(employees.active, 1)
            ))
            .get()

        return employee?.id || null
    }

    async getUserPosition(userId: string) {
        // 首先获取员工信息以找到其职位 ID
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

        // 然后获取职位详情
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
        // 检查 user_departments 表
        const result = await this.db.select({ isHq: departments.name })
            .from(userDepartments)
            .innerJoin(departments, eq(departments.id, userDepartments.departmentId))
            .where(and(
                eq(userDepartments.userId, userId),
                eq(departments.name, '总部')
            ))
            .get()

        if (result) return true

        // 回退机制：为了向后兼容（检查 user 表上的 department_id 字段）
        const user = await this.getUserById(userId)
        if (user?.departmentId) {
            const dept = await this.db.select({ name: departments.name })
                .from(departments)
                .where(eq(departments.id, user.departmentId))
                .get()

            return dept?.name === '总部'
        }

        return false
    }

    async getUserGroupId(userId: string): Promise<string | null> {
        const user = await this.getUserById(userId)
        if (!user?.email) return null

        // 获取员工的组织部门
        const employee = await this.db.select({ orgDepartmentId: employees.orgDepartmentId })
            .from(employees)
            .where(and(
                eq(employees.personalEmail, user.email), // 使用个人邮箱进行查找
                eq(employees.active, 1)
            ))
            .get()

        if (!employee?.orgDepartmentId) return null

        // 检查该部门是否是某个组的子部门（parent_id不为NULL）
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
        const user = await this.getUserById(userId)
        if (!user || !user.email) return null

        // 必须从员工记录获取org_department_id（员工记录是唯一权威来源）
        const employee = await this.db.select({ orgDepartmentId: employees.orgDepartmentId })
            .from(employees)
            .where(and(
                eq(employees.personalEmail, user.email), // 使用个人邮箱进行查找
                eq(employees.active, 1)
            ))
            .get()

        return employee?.orgDepartmentId || null
    }

    async getUserDepartmentIds(userId: string): Promise<string[]> {
        try {
            // 首先检查新的多项目关联表
            const userDepts = await this.db.select({ departmentId: userDepartments.departmentId })
                .from(userDepartments)
                .where(eq(userDepartments.userId, userId))
                .all()

            if (userDepts && userDepts.length > 0) {
                return userDepts.map(r => r.departmentId)
            }
        } catch (err: any) {
            // 如果表不存在，忽略错误，继续向后兼容逻辑
            console.warn('user_departments table may not exist:', err.message)
        }

        // 向后兼容：如果没有多项目关联，检查旧的department_id字段
        const user = await this.getUserById(userId)
        if (user?.departmentId) {
            return [user.departmentId]
        }

        return []
    }

    async getUserDepartmentId(userId: string): Promise<string | null> {
        const ids = await this.getUserDepartmentIds(userId)
        return ids.length > 0 ? ids[0] : null
    }
}
