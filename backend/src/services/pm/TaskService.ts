/**
 * 任务管理服务
 * 负责任务的 CRUD、状态管理和看板排序
 */
import { DrizzleD1Database } from 'drizzle-orm/d1'
import { eq, and, desc, inArray, sql } from 'drizzle-orm'
import { tasks, employees, projects, requirements } from '../../db/schema.js'
import { DBPerformanceTracker } from '../../utils/db-performance.js'

// 类型定义
export interface TaskFilter {
    projectId?: string
    requirementId?: string
    status?: string
    assigneeId?: string
    type?: string
}

export interface CreateTaskInput {
    code: string
    projectId: string
    requirementId?: string
    parentTaskId?: string
    title: string
    description?: string
    type?: string
    priority?: string
    estimatedHours?: number
    startDate?: string
    dueDate?: string
    assigneeIds?: string[]
    reviewerIds?: string[]
    testerIds?: string[]
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
    assigneeIds?: string[]
    reviewerIds?: string[]
    testerIds?: string[]
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

                // 辅助函数：解析 JSON 数组
                const parseIds = (json: string | null): string[] => {
                    if (!json) return []
                    try {
                        const parsed = JSON.parse(json)
                        return Array.isArray(parsed) ? parsed : []
                    } catch {
                        return []
                    }
                }

                // 批量获取关联数据 - 收集所有人员 ID
                const allPersonIds = new Set<string>()
                const projectIds = new Set<string>()

                taskList.forEach(t => {
                    parseIds(t.assigneeIds).forEach(id => allPersonIds.add(id))
                    parseIds(t.reviewerIds).forEach(id => allPersonIds.add(id))
                    parseIds(t.testerIds).forEach(id => allPersonIds.add(id))
                    // 兼容旧数据
                    if (t.assigneeId) allPersonIds.add(t.assigneeId)
                    if (t.reviewerId) allPersonIds.add(t.reviewerId)
                    if (t.testerId) allPersonIds.add(t.testerId)
                    if (t.projectId) projectIds.add(t.projectId)
                })

                const personMap = new Map<string, { id: string; name: string | null }>()
                const projectMap = new Map<string, { id: string; name: string }>()

                if (allPersonIds.size > 0) {
                    const persons = await this.db
                        .select({ id: employees.id, name: employees.name })
                        .from(employees)
                        .where(inArray(employees.id, [...allPersonIds]))
                        .all()
                    persons.forEach(p => personMap.set(p.id, p))
                }

                if (projectIds.size > 0) {
                    const prjs = await this.db
                        .select({ id: projects.id, name: projects.name })
                        .from(projects)
                        .where(inArray(projects.id, [...projectIds]))
                        .all()
                    prjs.forEach(p => projectMap.set(p.id, p))
                }

                // 辅助函数：获取人员名称列表
                const getNames = (ids: string[]): string[] => {
                    return ids.map(id => personMap.get(id)?.name || '').filter(Boolean)
                }

                return taskList.map(t => {
                    const assigneeIdList = parseIds(t.assigneeIds) || (t.assigneeId ? [t.assigneeId] : [])
                    const reviewerIdList = parseIds(t.reviewerIds) || (t.reviewerId ? [t.reviewerId] : [])
                    const testerIdList = parseIds(t.testerIds) || (t.testerId ? [t.testerId] : [])

                    return {
                        ...t,
                        assigneeIds: assigneeIdList,
                        reviewerIds: reviewerIdList,
                        testerIds: testerIdList,
                        assigneeNames: getNames(assigneeIdList),
                        reviewerNames: getNames(reviewerIdList),
                        testerNames: getNames(testerIdList),
                        projectName: t.projectId ? projectMap.get(t.projectId)?.name : null,
                    }
                })
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

                // 辅助函数：解析 JSON 数组
                const parseIds = (json: string | null): string[] => {
                    if (!json) return []
                    try {
                        const parsed = JSON.parse(json)
                        return Array.isArray(parsed) ? parsed : []
                    } catch {
                        return []
                    }
                }

                // 解析人员 ID 数组（兼容旧数据）
                const assigneeIdList = parseIds(task.assigneeIds).length > 0 ? parseIds(task.assigneeIds) : (task.assigneeId ? [task.assigneeId] : [])
                const reviewerIdList = parseIds(task.reviewerIds).length > 0 ? parseIds(task.reviewerIds) : (task.reviewerId ? [task.reviewerId] : [])
                const testerIdList = parseIds(task.testerIds).length > 0 ? parseIds(task.testerIds) : (task.testerId ? [task.testerId] : [])
                const allPersonIds = [...new Set([...assigneeIdList, ...reviewerIdList, ...testerIdList])]

                // 顺序查询获取关联数据
                const project = task.projectId
                    ? await this.db.select({ id: projects.id, name: projects.name }).from(projects).where(eq(projects.id, task.projectId)).get()
                    : null

                const personMap = new Map<string, string | null>()
                if (allPersonIds.length > 0) {
                    const persons = await this.db
                        .select({ id: employees.id, name: employees.name })
                        .from(employees)
                        .where(inArray(employees.id, allPersonIds))
                        .all()
                    persons.forEach(p => personMap.set(p.id, p.name))
                }

                const requirement = task.requirementId
                    ? await this.db.select({ id: requirements.id, title: requirements.title }).from(requirements).where(eq(requirements.id, task.requirementId)).get()
                    : null

                const getNames = (ids: string[]) => ids.map(id => personMap.get(id) || '').filter(Boolean)

                return {
                    ...task,
                    assigneeIds: assigneeIdList,
                    reviewerIds: reviewerIdList,
                    testerIds: testerIdList,
                    assigneeNames: getNames(assigneeIdList),
                    reviewerNames: getNames(reviewerIdList),
                    testerNames: getNames(testerIdList),
                    projectName: project?.name,
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
                    // 使用 JSON 数组存储多选人员
                    assigneeIds: data.assigneeIds?.length ? JSON.stringify(data.assigneeIds) : null,
                    reviewerIds: data.reviewerIds?.length ? JSON.stringify(data.reviewerIds) : null,
                    testerIds: data.testerIds?.length ? JSON.stringify(data.testerIds) : null,
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

                // 转换数组为 JSON 字符串
                if (data.assigneeIds !== undefined) {
                    updateData.assigneeIds = data.assigneeIds?.length ? JSON.stringify(data.assigneeIds) : null
                }
                if (data.reviewerIds !== undefined) {
                    updateData.reviewerIds = data.reviewerIds?.length ? JSON.stringify(data.reviewerIds) : null
                }
                if (data.testerIds !== undefined) {
                    updateData.testerIds = data.testerIds?.length ? JSON.stringify(data.testerIds) : null
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
    async getNextCode(projectId: string) {
        return DBPerformanceTracker.track(
            'TaskService.getNextCode',
            async () => {
                // 获取项目前缀
                const project = await this.db.select({ code: projects.code }).from(projects).where(eq(projects.id, projectId)).get()
                const prefix = project?.code ? `TASK-${project.code}` : 'TASK'

                const lastTask = await this.db
                    .select({ code: tasks.code })
                    .from(tasks)
                    .where(eq(tasks.projectId, projectId))
                    .orderBy(desc(tasks.createdAt))
                    .limit(1)
                    .get()

                if (!lastTask || !lastTask.code) {
                    return `${prefix}-001`
                }

                const match = lastTask.code.match(/(\d+)$/)
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
