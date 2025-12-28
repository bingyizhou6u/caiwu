/**
 * 员工-项目关联服务
 */

import { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from '../../db/schema.js'
import { employeeProjects, projects, employees } from '../../db/schema.js'
import { eq, and, inArray } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'

export class EmployeeProjectService {
    constructor(private db: DrizzleD1Database<typeof schema>) { }

    /**
     * 获取员工的所有项目关联
     */
    async getEmployeeProjects(employeeId: string) {
        const rows = await this.db
            .select({
                id: employeeProjects.id,
                employeeId: employeeProjects.employeeId,
                projectId: employeeProjects.projectId,
                role: employeeProjects.role,
                isPrimary: employeeProjects.isPrimary,
                createdAt: employeeProjects.createdAt,
                projectName: projects.name,
                projectCode: projects.code,
            })
            .from(employeeProjects)
            .leftJoin(projects, eq(projects.id, employeeProjects.projectId))
            .where(eq(employeeProjects.employeeId, employeeId))
            .all()

        return rows
    }

    /**
     * 添加员工的项目关联
     */
    async addEmployeeProject(data: {
        employeeId: string
        projectId: string
        role?: string
        isPrimary?: boolean
    }) {
        // 检查是否已存在关联
        const existing = await this.db
            .select({ id: employeeProjects.id })
            .from(employeeProjects)
            .where(
                and(
                    eq(employeeProjects.employeeId, data.employeeId),
                    eq(employeeProjects.projectId, data.projectId)
                )
            )
            .get()

        if (existing) {
            return { success: false, message: '该项目关联已存在' }
        }

        // 如果设置为主项目，先将其他关联设为非主
        if (data.isPrimary) {
            await this.db
                .update(employeeProjects)
                .set({ isPrimary: 0 })
                .where(eq(employeeProjects.employeeId, data.employeeId))
        }

        const id = uuid()
        const now = Date.now()

        await this.db.insert(employeeProjects).values({
            id,
            employeeId: data.employeeId,
            projectId: data.projectId,
            role: data.role || null,
            isPrimary: data.isPrimary ? 1 : 0,
            createdAt: now,
        })

        // 同步更新 employees.projectId（如果是主项目）
        if (data.isPrimary) {
            await this.db
                .update(employees)
                .set({ projectId: data.projectId })
                .where(eq(employees.id, data.employeeId))
        }

        return { success: true, id }
    }

    /**
     * 移除员工的项目关联
     */
    async removeEmployeeProject(employeeId: string, projectId: string) {
        const association = await this.db
            .select({ id: employeeProjects.id, isPrimary: employeeProjects.isPrimary })
            .from(employeeProjects)
            .where(
                and(
                    eq(employeeProjects.employeeId, employeeId),
                    eq(employeeProjects.projectId, projectId)
                )
            )
            .get()

        if (!association) {
            return { success: false, message: '关联不存在' }
        }

        await this.db
            .delete(employeeProjects)
            .where(eq(employeeProjects.id, association.id))

        // 如果删除的是主项目，清除 employees.projectId
        if (association.isPrimary === 1) {
            await this.db
                .update(employees)
                .set({ projectId: null })
                .where(eq(employees.id, employeeId))
        }

        return { success: true }
    }

    /**
     * 设置主项目
     */
    async setPrimaryProject(employeeId: string, projectId: string) {
        // 先将所有关联设为非主
        await this.db
            .update(employeeProjects)
            .set({ isPrimary: 0 })
            .where(eq(employeeProjects.employeeId, employeeId))

        // 设置指定项目为主
        await this.db
            .update(employeeProjects)
            .set({ isPrimary: 1 })
            .where(
                and(
                    eq(employeeProjects.employeeId, employeeId),
                    eq(employeeProjects.projectId, projectId)
                )
            )

        // 同步 employees.projectId
        await this.db
            .update(employees)
            .set({ projectId: projectId })
            .where(eq(employees.id, employeeId))

        return { success: true }
    }
}
