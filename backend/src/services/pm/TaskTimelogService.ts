/**
 * 工时记录服务
 * 负责工时的 CRUD 和汇总统计
 */
import { DrizzleD1Database } from 'drizzle-orm/d1'
import { eq, and, desc, sql, inArray } from 'drizzle-orm'
import { taskTimelogs, tasks, employees } from '../../db/schema.js'
import { DBPerformanceTracker } from '../../utils/db-performance.js'

// 类型定义
export interface TimelogFilter {
    taskId?: string
    employeeId?: string
    startDate?: string
    endDate?: string
}

export interface CreateTimelogInput {
    taskId: string
    logDate: string
    hours: number
    description?: string
}

export interface UpdateTimelogInput {
    logDate?: string
    hours?: number
    description?: string
}

export class TaskTimelogService {
    constructor(private db: DrizzleD1Database<any>) { }

    /**
     * 获取工时列表
     */
    async list(filter?: TimelogFilter) {
        return DBPerformanceTracker.track(
            'TaskTimelogService.list',
            async () => {
                const conditions = []
                if (filter?.taskId) {
                    conditions.push(eq(taskTimelogs.taskId, filter.taskId))
                }
                if (filter?.employeeId) {
                    conditions.push(eq(taskTimelogs.employeeId, filter.employeeId))
                }

                const logs = await this.db
                    .select()
                    .from(taskTimelogs)
                    .where(conditions.length > 0 ? and(...conditions) : undefined)
                    .orderBy(desc(taskTimelogs.logDate), desc(taskTimelogs.createdAt))
                    .all()

                // 批量获取关联数据
                const taskIds = [...new Set(logs.map(l => l.taskId))]
                const employeeIds = [...new Set(logs.map(l => l.employeeId))]

                const taskMap = new Map<string, { id: string; title: string }>()
                const employeeMap = new Map<string, { id: string; name: string | null }>()

                if (taskIds.length > 0) {
                    const taskList = await this.db
                        .select({ id: tasks.id, title: tasks.title })
                        .from(tasks)
                        .where(inArray(tasks.id, taskIds))
                        .all()
                    taskList.forEach(t => taskMap.set(t.id, t))
                }

                if (employeeIds.length > 0) {
                    const empList = await this.db
                        .select({ id: employees.id, name: employees.name })
                        .from(employees)
                        .where(inArray(employees.id, employeeIds))
                        .all()
                    empList.forEach(e => employeeMap.set(e.id, e))
                }

                return logs.map(l => ({
                    ...l,
                    taskTitle: taskMap.get(l.taskId)?.title,
                    employeeName: employeeMap.get(l.employeeId)?.name,
                }))
            }
        )
    }

    /**
     * 创建工时记录
     */
    async create(data: CreateTimelogInput, employeeId: string) {
        return DBPerformanceTracker.track(
            'TaskTimelogService.create',
            async () => {
                const id = crypto.randomUUID()
                const now = Date.now()

                await this.db.insert(taskTimelogs).values({
                    id,
                    taskId: data.taskId,
                    employeeId,
                    logDate: data.logDate,
                    hours: data.hours,
                    description: data.description,
                    createdAt: now,
                    updatedAt: now,
                })

                // 更新任务的实际工时
                await this.updateTaskActualHours(data.taskId)

                return this.getById(id)
            }
        )
    }

    /**
     * 获取单个工时记录
     */
    async getById(id: string) {
        return DBPerformanceTracker.track(
            'TaskTimelogService.getById',
            async () => {
                return this.db.select().from(taskTimelogs).where(eq(taskTimelogs.id, id)).get()
            }
        )
    }

    /**
     * 更新工时记录
     */
    async update(id: string, data: UpdateTimelogInput) {
        return DBPerformanceTracker.track(
            'TaskTimelogService.update',
            async () => {
                const log = await this.getById(id)
                if (!log) return null

                await this.db
                    .update(taskTimelogs)
                    .set({ ...data, updatedAt: Date.now() })
                    .where(eq(taskTimelogs.id, id))

                // 更新任务的实际工时
                await this.updateTaskActualHours(log.taskId)

                return this.getById(id)
            }
        )
    }

    /**
     * 删除工时记录
     */
    async delete(id: string) {
        return DBPerformanceTracker.track(
            'TaskTimelogService.delete',
            async () => {
                const log = await this.getById(id)
                if (!log) return

                await this.db.delete(taskTimelogs).where(eq(taskTimelogs.id, id))

                // 更新任务的实际工时
                await this.updateTaskActualHours(log.taskId)
            }
        )
    }

    /**
     * 更新任务的实际工时（汇总）
     */
    private async updateTaskActualHours(taskId: string) {
        return DBPerformanceTracker.track(
            'TaskTimelogService.updateTaskActualHours',
            async () => {
                const result = await this.db
                    .select({ total: sql<number>`SUM(hours)` })
                    .from(taskTimelogs)
                    .where(eq(taskTimelogs.taskId, taskId))
                    .get()

                const actualHours = Math.round((result?.total || 0) * 10) / 10 // 保留一位小数

                await this.db
                    .update(tasks)
                    .set({ actualHours, updatedAt: Date.now() })
                    .where(eq(tasks.id, taskId))
            }
        )
    }

    /**
     * 获取我的工时
     */
    async getMyTimelogs(employeeId: string, startDate?: string, endDate?: string) {
        return this.list({ employeeId, startDate, endDate })
    }

    /**
     * 获取团队工时汇总
     */
    async getTeamWorkloadSummary(projectId: string, startDate?: string, endDate?: string) {
        return DBPerformanceTracker.track(
            'TaskTimelogService.getTeamWorkloadSummary',
            async () => {
                // 获取项目下所有任务
                const projectTasks = await this.db
                    .select({ id: tasks.id })
                    .from(tasks)
                    .where(eq(tasks.projectId, projectId))
                    .all()

                const taskIds = projectTasks.map(t => t.id)
                if (taskIds.length === 0) return []

                // 获取工时记录
                const logs = await this.db
                    .select()
                    .from(taskTimelogs)
                    .where(inArray(taskTimelogs.taskId, taskIds))
                    .all()

                // 按员工汇总
                const summary = new Map<string, number>()
                logs.forEach(log => {
                    const current = summary.get(log.employeeId) || 0
                    summary.set(log.employeeId, current + log.hours)
                })

                // 获取员工名称
                const employeeIds = [...summary.keys()]
                const empList = employeeIds.length > 0
                    ? await this.db.select({ id: employees.id, name: employees.name }).from(employees).where(inArray(employees.id, employeeIds)).all()
                    : []

                const empMap = new Map(empList.map(e => [e.id, e.name]))

                return Array.from(summary.entries()).map(([employeeId, hours]) => ({
                    employeeId,
                    employeeName: empMap.get(employeeId),
                    totalHours: Math.round(hours * 10) / 10,
                }))
            }
        )
    }
}
