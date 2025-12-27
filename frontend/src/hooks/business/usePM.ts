/**
 * PM 模块 Hooks
 * 项目、任务、工时管理
 */
import { useApiQuery } from '../../utils/useApiQuery'
import { api } from '../../config/api'
import { api as apiClient } from '../../api/http'
import { useMutation, useQueryClient } from '@tanstack/react-query'

// 类型定义
export interface Project {
    id: string
    code: string
    name: string
    description?: string
    projectId: string
    departmentName?: string
    managerId?: string
    managerName?: string
    status: string
    startDate?: string
    endDate?: string
    actualStartDate?: string
    actualEndDate?: string
    priority: string
    budgetCents?: number
    memo?: string
    createdBy?: string
    createdAt?: number
    updatedAt?: number
}

export interface Task {
    id: string
    code: string
    projectId: string
    projectName?: string
    requirementId?: string
    requirementTitle?: string
    parentTaskId?: string
    title: string
    description?: string
    type: string
    priority: string
    status: string
    estimatedHours?: number
    actualHours?: number
    startDate?: string
    dueDate?: string
    completedAt?: number
    assigneeId?: string
    assigneeName?: string
    reviewerId?: string
    reviewerName?: string
    testerId?: string
    testerName?: string
    sortOrder: number
    createdBy?: string
    createdAt?: number
    updatedAt?: number
}

export interface Timelog {
    id: string
    taskId: string
    taskTitle?: string
    employeeId: string
    employeeName?: string
    logDate: string
    hours: number
    description?: string
    createdAt?: number
    updatedAt?: number
}

export interface CreateProjectInput {
    code?: string
    name: string
    description?: string
    projectId: string
    managerId?: string
    status?: string
    startDate?: string
    endDate?: string
    priority?: string
    budgetCents?: number
    memo?: string
}

export interface CreateTaskInput {
    code?: string
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
    assigneeId?: string
    reviewerId?: string
    testerId?: string
}

export interface CreateTimelogInput {
    taskId: string
    logDate: string
    hours: number
    description?: string
}

// ============ 项目 Hooks ============

export function useProjects(filter?: { status?: string; projectId?: string }) {
    const params = new URLSearchParams()
    if (filter?.status) params.append('status', filter.status)
    if (filter?.projectId) params.append('projectId', filter.projectId)

    return useApiQuery<Project[]>(
        ['pm-projects', filter],
        `${api.pm.projects}?${params.toString()}`,
        {
            staleTime: 5 * 60 * 1000,
            select: (data: any) => Array.isArray(data) ? data : [],
        }
    )
}

export function useProject(id: string) {
    return useApiQuery<Project>(
        ['pm-project', id],
        api.pm.projectsById(id),
        {
            enabled: !!id,
            staleTime: 5 * 60 * 1000,
        }
    )
}

export function useCreateProject() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (data: CreateProjectInput) => {
            const result = await apiClient.post<Project>(api.pm.projects, data)
            return result
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pm-projects'] })
        },
    })
}

export function useUpdateProject() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async ({ id, data }: { id: string; data: Partial<CreateProjectInput> }) => {
            const result = await apiClient.patch<Project>(api.pm.projectsById(id), data)
            return result
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pm-projects'] })
            queryClient.invalidateQueries({ queryKey: ['pm-project'] })
        },
    })
}

export function useDeleteProject() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (id: string) => {
            await apiClient.delete(api.pm.projectsById(id))
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pm-projects'] })
        },
    })
}

// ============ 任务 Hooks ============

export function useTasks(filter?: { projectId?: string; status?: string; assigneeId?: string }) {
    const params = new URLSearchParams()
    if (filter?.projectId) params.append('projectId', filter.projectId)
    if (filter?.status) params.append('status', filter.status)
    if (filter?.assigneeId) params.append('assigneeId', filter.assigneeId)

    return useApiQuery<Task[]>(
        ['pm-tasks', filter],
        `${api.pm.tasks}?${params.toString()}`,
        {
            enabled: !!filter?.projectId,
            staleTime: 2 * 60 * 1000,
            select: (data: any) => Array.isArray(data) ? data : [],
        }
    )
}

// 获取单个任务
export function useTask(id: string) {
    return useApiQuery<Task>(
        ['pm-task', id],
        api.pm.tasksById(id),
        {
            enabled: !!id,
            staleTime: 2 * 60 * 1000,
        }
    )
}

export function useKanbanTasks(projectId: string) {
    return useApiQuery<Record<string, Task[]>>(
        ['pm-kanban', projectId],
        `${api.pm.tasksKanban}?projectId=${projectId}`,
        {
            enabled: !!projectId,
            staleTime: 1 * 60 * 1000,
        }
    )
}

export function useMyTasks() {
    return useApiQuery<Task[]>(
        ['pm-my-tasks'],
        api.pm.tasksMy,
        {
            staleTime: 2 * 60 * 1000,
            select: (data: any) => Array.isArray(data) ? data : [],
        }
    )
}

export function useCreateTask() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (data: CreateTaskInput) => {
            const result = await apiClient.post<Task>(api.pm.tasks, data)
            return result
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pm-tasks'] })
            queryClient.invalidateQueries({ queryKey: ['pm-kanban'] })
            queryClient.invalidateQueries({ queryKey: ['pm-my-tasks'] })
        },
    })
}

export function useUpdateTask() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async ({ id, data }: { id: string; data: Partial<CreateTaskInput & { status?: string; sortOrder?: number }> }) => {
            const result = await apiClient.patch<Task>(api.pm.tasksById(id), data)
            return result
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pm-tasks'] })
            queryClient.invalidateQueries({ queryKey: ['pm-task'] })
            queryClient.invalidateQueries({ queryKey: ['pm-kanban'] })
            queryClient.invalidateQueries({ queryKey: ['pm-my-tasks'] })
        },
    })
}

export function useUpdateTaskStatus() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async ({ id, status, sortOrder }: { id: string; status: string; sortOrder?: number }) => {
            const result = await apiClient.patch<Task>(api.pm.tasksStatus(id), { status, sortOrder: sortOrder || 0 })
            return result
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pm-tasks'] })
            queryClient.invalidateQueries({ queryKey: ['pm-kanban'] })
            queryClient.invalidateQueries({ queryKey: ['pm-my-tasks'] })
        },
    })
}

export function useDeleteTask() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (id: string) => {
            await apiClient.delete(api.pm.tasksById(id))
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pm-tasks'] })
            queryClient.invalidateQueries({ queryKey: ['pm-kanban'] })
            queryClient.invalidateQueries({ queryKey: ['pm-my-tasks'] })
        },
    })
}

// ============ 工时 Hooks ============

export function useTimelogs(filter?: { taskId?: string; employeeId?: string }) {
    const params = new URLSearchParams()
    if (filter?.taskId) params.append('taskId', filter.taskId)
    if (filter?.employeeId) params.append('employeeId', filter.employeeId)

    return useApiQuery<Timelog[]>(
        ['pm-timelogs', filter],
        `${api.pm.timelogs}?${params.toString()}`,
        {
            staleTime: 2 * 60 * 1000,
            select: (data: any) => Array.isArray(data) ? data : [],
        }
    )
}

export function useMyTimelogs(startDate?: string, endDate?: string) {
    const params = new URLSearchParams()
    if (startDate) params.append('startDate', startDate)
    if (endDate) params.append('endDate', endDate)

    return useApiQuery<Timelog[]>(
        ['pm-my-timelogs', startDate, endDate],
        `${api.pm.timelogsMy}?${params.toString()}`,
        {
            staleTime: 2 * 60 * 1000,
            select: (data: any) => Array.isArray(data) ? data : [],
        }
    )
}

export function useTeamWorkloadSummary(projectId: string, startDate?: string, endDate?: string) {
    const params = new URLSearchParams()
    params.append('projectId', projectId)
    if (startDate) params.append('startDate', startDate)
    if (endDate) params.append('endDate', endDate)

    return useApiQuery<Array<{ employeeId: string; employeeName: string; totalHours: number }>>(
        ['pm-team-workload', projectId, startDate, endDate],
        `${api.pm.timelogsTeamSummary}?${params.toString()}`,
        {
            enabled: !!projectId,
            staleTime: 5 * 60 * 1000,
        }
    )
}

export function useCreateTimelog() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (data: CreateTimelogInput) => {
            const result = await apiClient.post<Timelog>(api.pm.timelogs, data)
            return result
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pm-timelogs'] })
            queryClient.invalidateQueries({ queryKey: ['pm-my-timelogs'] })
            queryClient.invalidateQueries({ queryKey: ['pm-team-workload'] })
            queryClient.invalidateQueries({ queryKey: ['pm-tasks'] }) // 更新任务的实际工时
        },
    })
}

export function useDeleteTimelog() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (id: string) => {
            await apiClient.delete(api.pm.timelogsById(id))
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pm-timelogs'] })
            queryClient.invalidateQueries({ queryKey: ['pm-my-timelogs'] })
            queryClient.invalidateQueries({ queryKey: ['pm-team-workload'] })
            queryClient.invalidateQueries({ queryKey: ['pm-tasks'] })
        },
    })
}
