import { DrizzleD1Database } from 'drizzle-orm/d1'
import { eq, and, ne } from 'drizzle-orm'
import * as schema from '../db/schema.js'
import { positions, employees, sessions } from '../db/schema.js'
import { Errors } from '../utils/errors.js'
import { v4 as uuid } from 'uuid'

export class PositionService {
    constructor(
        private db: DrizzleD1Database<typeof schema>,
        private kv?: KVNamespace
    ) { }

    async getPositions() {
        // 返回所有职位，按排序顺序和名称排序
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
        functionRole: string
        permissions?: any
        description?: string
        sortOrder?: number
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
            functionRole: data.functionRole,
            permissions: permissionsJson,
            description: data.description,
            sortOrder: data.sortOrder || 0,
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
        functionRole?: string
        permissions?: any
        description?: string
        sortOrder?: number
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
        if (data.functionRole !== undefined) updates.functionRole = data.functionRole
        if (data.permissions !== undefined) updates.permissions = JSON.stringify(data.permissions)
        if (data.description !== undefined) updates.description = data.description
        if (data.sortOrder !== undefined) updates.sortOrder = data.sortOrder
        if (data.active !== undefined) updates.active = data.active

        await this.db.update(positions).set(updates).where(eq(positions.id, id)).execute()

        // 如果更新了权限，需要清除受影响用户的 Session 缓存
        if (data.permissions !== undefined && this.kv) {
            await this.invalidateSessionsForPosition(id)
        }

        return { id, ...data }
    }

    /**
     * 清除使用该职位的所有用户的 Session 缓存
     * 强制用户下次请求时重新加载权限
     */
    private async invalidateSessionsForPosition(positionId: string) {
        if (!this.kv) return

        try {
            // 1. 查找使用该职位的所有员工
            const affectedEmployees = await this.db.select({ email: employees.email })
                .from(employees)
                .where(and(eq(employees.positionId, positionId), eq(employees.active, 1)))
                .all()

            if (affectedEmployees.length === 0) return

            // 2. 通过邮箱找到对应的用户
            const emails = affectedEmployees.map(e => e.email).filter(Boolean)
            if (emails.length === 0) return

            // 3. 查找这些用户的所有活跃 Session
            for (const email of emails) {
                const user = await this.db.select({ id: employees.id })
                    .from(employees)
                    .where(eq(employees.personalEmail, email!))
                    .get()

                if (!user) continue

                const userSessions = await this.db.select({ id: sessions.id })
                    .from(sessions)
                    .where(eq(sessions.userId, user.id))
                    .all()

                // 4. 删除 KV 中的 Session 缓存
                for (const session of userSessions) {
                    await this.kv.delete(`session:${session.id}`)
                }
            }

            console.log(`Invalidated sessions for position ${positionId}, affected ${emails.length} users`)
        } catch (error) {
            console.error('Failed to invalidate sessions:', error)
            // 不抛出错误，权限更新成功但缓存清除失败不应该影响主流程
        }
    }

    async deletePosition(id: string) {
        // 检查员工
        const employeeCount = await this.db.$count(employees, and(eq(employees.positionId, id), eq(employees.active, 1)))
        if (employeeCount > 0) throw Errors.BUSINESS_ERROR('无法删除，该职位已分配给员工')

        // 软删除
        await this.db.update(positions).set({
            active: 0,
            updatedAt: Date.now()
        }).where(eq(positions.id, id)).execute()

        return { ok: true }
    }
}
