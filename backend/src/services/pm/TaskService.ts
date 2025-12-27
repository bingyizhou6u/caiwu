/**
 * 任务管理服务
 * 负责任务的 CRUD、状态管理和看板排序
 */
import { DrizzleD1Database } from 'drizzle-orm/d1'
import { eq, and, desc, inArray, sql } from 'drizzle-orm'
import { tasks, employees, departments, requirements } from '../../db/schema.js'
import { DBPerformanceTracker } from '../../utils/db-performance.js'

// 类型定义
export interface TaskFilter {
    projectId?: string // 兼容旧字段
    departmentId?: string // 新字段
    requirementId?: string
    status?: string
    assigneeId?: string
    type?: string
}

export interface CreateTaskInput {
    code: string
    projectId?: string // 兼容旧字段
    departmentId?: string // 新字段
    requirementId?: string
    parentTaskId?: string
    title: string
    description?: string
    type?: string
    priority?: string
    estimatedHours?: number
    startDate?: string
    dueDate?: string
    assigneeId?: string
}

export interface UpdateTaskInput {
    title?: string
    description?: string
    type?: string
    priority?: string
    status?: string
    estimatedHours?: number
    startDate?: string
    dueDate?: string
    assigneeId?: string
    sortOrder?: number
}

export class TaskService {
    constructor(private db: DrizzleD1Database<any>) { }

    /**
     * 获取任务列表
     */
    async list(filter?: TaskFilter) {
        return DBPerformanceTracker.track(
            'TaskService.list',
            async () => {
                // 构建基础查询
                const conditions = []
                if (filter?.projectId) {
                    conditions.push(eq(tasks.projectId, filter.projectId))
                }
                if (filter?.departmentId) {
                    conditions.push(eq(tasks.departmentId, filter.departmentId))
                }
                if (filter?.requirementId) {
                    conditions.push(eq(tasks.requirementId, filter.requirementId))
                }
                if (filter?.status) {
                    conditions.push(eq(tasks.status, filter.status))
                }
                if (filter?.assigneeId) {
                    conditions.push(eq(tasks.assigneeId, filter.assigneeId))
                }

                const taskList = await this.db
                    .select()
                    .from(tasks)
                    .where(conditions.length > 0 ? and(...conditions) : undefined)
                    .orderBy(tasks.sortOrder, desc(tasks.createdAt))
                    .all()

                // 批量获取关联数据
                const assigneeIds = [...new Set(taskList.map(t => t.assigneeId).filter(Boolean))] as string[]
                const departmentIds = [...new Set(taskList.map(t => t.departmentId).filter(Boolean))] as string[]

                const assigneeMap = new Map<string, { id: string; name: string | null }>()
                const departmentMap = new Map<string, { id: string; name: string }>()

                if (assigneeIds.length > 0) {
                    const assignees = await this.db
                        .select({ id: employees.id, name: employees.name })
                        .from(employees)
                        .where(inArray(employees.id, assigneeIds))
                        .all()
                    assignees.forEach(a => assigneeMap.set(a.id, a))
                }

                if (departmentIds.length > 0) {
                    const depts = await this.db
                        .select({ id: departments.id, name: departments.name })
                        .from(departments)
                        .where(inArray(departments.id, departmentIds))
                        .all()
                    depts.forEach(d => departmentMap.set(d.id, d))
                }

                return taskList.map(t => ({
                    ...t,
                    assigneeName: t.assigneeId ? assigneeMap.get(t.assigneeId)?.name : null,
                    projectName: t.departmentId ? departmentMap.get(t.departmentId)?.name : null,
                }))
            }
        )
    }

    /**
     * 获取看板视图数据（按状态分组）
     */
    async getKanbanData(projectId: string) {
        return DBPerformanceTracker.track(
            'TaskService.getKanbanData',
            async () => {
                const taskList = await this.list({ projectId })

                // 按状态分组
                const kanban: Record<string, typeof taskList> = {
                    todo: [],
                    in_progress: [],
                    review: [],
                    completed: [],
                    blocked: [],
                }

                taskList.forEach(task => {
                    const status = task.status || 'todo'
                    if (kanban[status]) {
                        kanban[status].push(task)
                    } else {
                        kanban.todo.push(task)
                    }
                })

                // 每个列按 sortOrder 排序
                Object.keys(kanban).forEach(status => {
                    kanban[status].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
                })

                return kanban
            }
        )
    }

    /**
     * 获取单个任务详情
     */
    async getById(id: string) {
        return DBPerformanceTracker.track(
            'TaskService.getById',
            async () => {
                const task = await this.db.select().from(tasks).where(eq(tasks.id, id)).get()
                if (!task) return null

                // 顺序查询获取关联数据
                const department = task.departmentId
                    ? await this.db.select({ id: departments.id, name: departments.name }).from(departments).where(eq(departments.id, task.departmentId)).get()
                    : null

                const assignee = task.assigneeId
                    ? await this.db.select({ id: employees.id, name: employees.name }).from(employees).where(eq(employees.id, task.assigneeId)).get()
                    : null

                const requirement = task.requirementId
                    ? await this.db.select({ id: requirements.id, title: requirements.title }).from(requirements).where(eq(requirements.id, task.requirementId)).get()
                    : null

                return {
                    ...task,
                    projectName: department?.name,
                    assigneeName: assignee?.name,
                    requirementTitle: requirement?.title,
                }
            }
        )
    }

    /**
     * 创建任务
     */
    async create(data: CreateTaskInput, createdBy: string) {
        return DBPerformanceTracker.track(
            'TaskService.create',
            async () => {
                const id = crypto.randomUUID()
                const now = Date.now()

                await this.db.insert(tasks).values({
                    id,
                    code: data.code,
                    projectId: data.projectId,
                    departmentId: data.departmentId,
                    requirementId: data.requirementId,
                    parentTaskId: data.parentTaskId,
                    title: data.title,
                    description: data.description,
                    type: data.type || 'dev',
                    priority: data.priority || 'medium',
                    status: 'todo',
                    estimatedHours: data.estimatedHours,
                    startDate: data.startDate,
                    dueDate: data.dueDate,
                    assigneeId: data.assigneeId,
                    sortOrder: 0,
                    version: 1,
                    createdBy,
                    createdAt: now,
                    updatedAt: now,
                })

                return this.getById(id)
            }
        )
    }

    /**
     * 更新任务
     */
    async update(id: string, data: UpdateTaskInput, version?: number) {
        return DBPerformanceTracker.track(
            'TaskService.update',
            async () => {
                const updateData: Record<string, unknown> = {
                    ...data,
                    updatedAt: Date.now(),
                }

                // 如果状态变为 completed，记录完成时间
                if (data.status === 'completed') {
                    updateData.completedAt = Date.now()
                }

                // 如果提供了 version，使用乐观锁
                if (version !== undefined) {
                    updateData.version = version + 1
                    await this.db
                        .update(tasks)
                        .set(updateData)
                        .where(and(eq(tasks.id, id), eq(tasks.version, version)))
                } else {
                    await this.db.update(tasks).set(updateData).where(eq(tasks.id, id))
                }

                return this.getById(id)
            }
        )
    }

    /**
     * 更新任务状态（用于看板拖拽）
     */
    async updateStatus(id: string, status: string, sortOrder: number) {
        return this.update(id, { status, sortOrder })
    }

    /**
     * 删除任务
     */
    async delete(id: string) {
        return DBPerformanceTracker.track(
            'TaskService.delete',
            async () => {
                await this.db.delete(tasks).where(eq(tasks.id, id))
            }
        )
    }

    /**
     * 生成下一个任务编号
     */
    async getNextCode(departmentId: string) {
        return DBPerformanceTracker.track(
            'TaskService.getNextCode',
            async () => {
                // 获取项目前缀
                const dept = await this.db.select({ code: departments.code }).from(departments).where(eq(departments.id, departmentId)).get()
                const prefix = dept?.code ? `TASK-${dept.code}` : 'TASK'

                const lastTask = await this.db
                    .select({ code: tasks.code })
                    .from(tasks)
                    .where(eq(tasks.departmentId, departmentId))
                    .orderBy(desc(tasks.createdAt))
                    .limit(1)
                    .get()

                if (!lastTask || !lastTask.code) {
                    return `${prefix}-001`
                }

                const match = lastTask.code.match(/-(\d+)$/)
                if (match) {
                    const nextNum = parseInt(match[1], 10) + 1
                    return `${prefix}-${String(nextNum).padStart(3, '0')}`
                }

                return `${prefix}-001`
            }
        )
    }

    /**
     * 获取我的任务
     */
    async getMyTasks(employeeId: string) {
        return this.list({ assigneeId: employeeId })
    }
}
