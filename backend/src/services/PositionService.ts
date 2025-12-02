import { DrizzleD1Database } from 'drizzle-orm/d1'
import { eq, and, ne, desc } from 'drizzle-orm'
import * as schema from '../db/schema.js'
import { positions, employees, users } from '../db/schema.js'
import { Errors } from '../utils/errors.js'
import { v4 as uuid } from 'uuid'

export class PositionService {
    constructor(private db: DrizzleD1Database<typeof schema>) { }

    async getPositions() {
        // Return all positions, ordered by sort_order and name
        const results = await this.db.select().from(positions)
            .orderBy(positions.sortOrder, positions.name)
            .all()

        return results.map(row => ({
            ...row,
            permissions: typeof row.permissions === 'string' ? JSON.parse(row.permissions) : row.permissions
        }))
    }

    async getPosition(id: string) {
        const row = await this.db.query.positions.findFirst({
            where: eq(positions.id, id)
        })
        if (!row) throw Errors.NOT_FOUND('职位')

        return {
            ...row,
            permissions: typeof row.permissions === 'string' ? JSON.parse(row.permissions) : row.permissions
        }
    }

    async createPosition(data: {
        code: string
        name: string
        level: number
        function_role: string
        permissions: any
        description?: string
        sort_order?: number
    }) {
        const existing = await this.db.query.positions.findFirst({
            where: eq(positions.code, data.code)
        })
        if (existing) throw Errors.DUPLICATE('职位代码')

        const id = uuid()
        const now = Date.now()
        const permissionsJson = JSON.stringify(data.permissions)

        await this.db.insert(positions).values({
            id,
            code: data.code,
            name: data.name,
            level: data.level,
            functionRole: data.function_role,
            permissions: permissionsJson,
            description: data.description,
            sortOrder: data.sort_order || 0,
            active: 1,
            createdAt: now,
            updatedAt: now
        }).execute()

        return { id, ...data }
    }

    async updatePosition(id: string, data: {
        code?: string
        name?: string
        level?: number
        function_role?: string
        permissions?: any
        description?: string
        sort_order?: number
        active?: number
    }) {
        const existing = await this.db.query.positions.findFirst({
            where: eq(positions.id, id)
        })
        if (!existing) throw Errors.NOT_FOUND('职位')

        if (data.code && data.code !== existing.code) {
            const codeExists = await this.db.query.positions.findFirst({
                where: and(eq(positions.code, data.code), ne(positions.id, id))
            })
            if (codeExists) throw Errors.DUPLICATE('职位代码')
        }

        const updates: any = { updatedAt: Date.now() }
        if (data.code !== undefined) updates.code = data.code
        if (data.name !== undefined) updates.name = data.name
        if (data.level !== undefined) updates.level = data.level
        if (data.function_role !== undefined) updates.functionRole = data.function_role
        if (data.permissions !== undefined) updates.permissions = JSON.stringify(data.permissions)
        if (data.description !== undefined) updates.description = data.description
        if (data.sort_order !== undefined) updates.sortOrder = data.sort_order
        if (data.active !== undefined) updates.active = data.active

        await this.db.update(positions).set(updates).where(eq(positions.id, id)).execute()

        return { id, ...data }
    }

    async deletePosition(id: string) {
        // Check employees
        const employeeCount = await this.db.$count(employees, and(eq(employees.positionId, id), eq(employees.active, 1)))
        if (employeeCount > 0) throw Errors.BUSINESS_ERROR('无法删除，该职位已分配给员工')

        // Check users
        const userCount = await this.db.$count(users, and(eq(users.positionId, id), eq(users.active, 1)))
        if (userCount > 0) throw Errors.BUSINESS_ERROR('无法删除，该职位已分配给用户')

        // Soft delete
        await this.db.update(positions).set({
            active: 0,
            updatedAt: Date.now()
        }).where(eq(positions.id, id)).execute()

        return { ok: true }
    }
}
