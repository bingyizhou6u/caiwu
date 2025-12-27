/**
 * 项目管理服务
 * 负责项目的 CRUD 和成员管理
 */
import { DrizzleD1Database } from 'drizzle-orm/d1'
import { eq, and, desc, like, sql, inArray } from 'drizzle-orm'
import { projects, employees } from '../../db/schema.js'
import { getBusinessDate } from '../../utils/timezone.js'
import { DBPerformanceTracker } from '../../utils/db-performance.js'

// 类型定义
export interface ProjectFilter {
    status?: string
    departmentId?: string
    managerId?: string
    search?: string
}

export interface CreateProjectInput {
    code: string
    name: string
    description?: string
    departmentId: string
    managerId?: string
    status?: string
    startDate?: string
    endDate?: string
    priority?: string
    budgetCents?: number
    memo?: string
}

export interface UpdateProjectInput {
    name?: string
    description?: string
    departmentId?: string
    managerId?: string
    status?: string
    startDate?: string
    endDate?: string
    actualStartDate?: string
    actualEndDate?: string
    priority?: string
    budgetCents?: number
    memo?: string
}

export class ProjectService {
    constructor(private db: DrizzleD1Database<any>) { }

    /**
     * 获取项目列表
     */
    async list(filter?: ProjectFilter) {
        return DBPerformanceTracker.track(
            'ProjectService.list',
            async () => {
                let query = this.db
                    .select()
                    .from(projects)
                    .where(eq(projects.active, 1))
                    .orderBy(desc(projects.createdAt))

                // 使用顺序查询获取关联数据
                const projectList = await query.all()

                // 批量获取关联的部门和项目经理信息
                const departmentIds = [...new Set(projectList.map(p => p.departmentId).filter(Boolean))] as string[]
                const managerIds = [...new Set(projectList.map(p => p.managerId).filter(Boolean))] as string[]

                const departmentMap = new Map<string, { id: string; name: string }>()
                const managerMap = new Map<string, { id: string; name: string | null }>()

                if (departmentIds.length > 0) {
                    const depts = await this.db
                        .select({ id: projects.id, name: projects.name })
                        .from(projects)
                        .where(inArray(projects.id, departmentIds))
                        .all()
                    depts.forEach(d => departmentMap.set(d.id, d))
                }

                if (managerIds.length > 0) {
                    const managers = await this.db
                        .select({ id: employees.id, name: employees.name })
                        .from(employees)
                        .where(inArray(employees.id, managerIds))
                        .all()
                    managers.forEach(m => managerMap.set(m.id, m))
                }

                // 组装结果
                return projectList.map(p => ({
                    ...p,
                    departmentName: p.departmentId ? departmentMap.get(p.departmentId)?.name : null,
                    managerName: p.managerId ? managerMap.get(p.managerId)?.name : null,
                }))
            }
        )
    }

    /**
     * 获取单个项目详情
     */
    async getById(id: string) {
        return DBPerformanceTracker.track(
            'ProjectService.getById',
            async () => {
                const project = await this.db
                    .select()
                    .from(projects)
                    .where(and(eq(projects.id, id), eq(projects.active, 1)))
                    .get()

                if (!project) return null

                // 顺序查询获取关联数据
                const department = project.departmentId
                    ? await this.db.select().from(projects).where(eq(projects.id, project.departmentId)).get()
                    : null

                const manager = project.managerId
                    ? await this.db.select({ id: employees.id, name: employees.name }).from(employees).where(eq(employees.id, project.managerId)).get()
                    : null

                return {
                    ...project,
                    departmentName: department?.name,
                    managerName: manager?.name,
                }
            }
        )
    }

    /**
     * 创建项目
     */
    async create(data: CreateProjectInput, createdBy: string) {
        return DBPerformanceTracker.track(
            'ProjectService.create',
            async () => {
                const id = crypto.randomUUID()
                const now = Date.now()

                await this.db.insert(projects).values({
                    id,
                    code: data.code,
                    name: data.name,
                    description: data.description,
                    departmentId: data.departmentId,
                    managerId: data.managerId,
                    status: data.status || 'active',
                    startDate: data.startDate,
                    endDate: data.endDate,
                    priority: data.priority || 'medium',
                    budgetCents: data.budgetCents,
                    memo: data.memo,
                    createdBy,
                    createdAt: now,
                    updatedAt: now,
                    active: 1,
                })

                return this.getById(id)
            }
        )
    }

    /**
     * 更新项目
     */
    async update(id: string, data: UpdateProjectInput) {
        return DBPerformanceTracker.track(
            'ProjectService.update',
            async () => {
                await this.db
                    .update(projects)
                    .set({
                        ...data,
                        updatedAt: Date.now(),
                    })
                    .where(eq(projects.id, id))

                return this.getById(id)
            }
        )
    }

    /**
     * 删除项目（软删除）
     */
    async delete(id: string) {
        return DBPerformanceTracker.track(
            'ProjectService.delete',
            async () => {
                await this.db
                    .update(projects)
                    .set({ active: 0, updatedAt: Date.now() })
                    .where(eq(projects.id, id))
            }
        )
    }

    /**
     * 生成下一个项目编号
     */
    async getNextCode() {
        return DBPerformanceTracker.track(
            'ProjectService.getNextCode',
            async () => {
                const lastProject = await this.db
                    .select({ code: projects.code })
                    .from(projects)
                    .orderBy(desc(projects.createdAt))
                    .limit(1)
                    .get()

                if (!lastProject || !lastProject.code) {
                    return 'PRJ-001'
                }

                const match = lastProject.code.match(/PRJ-(\d+)/)
                if (match) {
                    const nextNum = parseInt(match[1], 10) + 1
                    return `PRJ-${String(nextNum).padStart(3, '0')}`
                }

                return 'PRJ-001'
            }
        )
    }
}
