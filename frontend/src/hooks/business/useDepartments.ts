import { useApiQuery } from '../../utils/useApiQuery'
import { api } from '../../config/api'
import { api as apiClient } from '../../api/http'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Department, SelectOption } from '../../types'
import type { ListResponse } from '../../types/responses'

// 类型别名：Project = Department（向后兼容）
export type Project = Department

// API 响应类型
type ProjectListResponse = Project[] | ListResponse<Project>

// 辅助函数
function extractProjects(data: ProjectListResponse): Project[] {
    return Array.isArray(data) ? data : data?.results || []
}

/**
 * 项目数据查询Hook（原 useDepartments）
 * 封装项目列表的查询逻辑
 * 
 * @returns 项目列表和查询状态
 * 
 * @example
 * ```tsx
 * const { data: projects, isLoading } = useProjects()
 * ```
 */
export function useProjects() {
    return useApiQuery<Project[]>(
        ['departments'], // 保持查询键兼容
        api.departments,
        {
            select: (data: ProjectListResponse) => extractProjects(data),
            staleTime: 60 * 60 * 1000, // 1小时缓存 - Master Data
        }
    )
}

/**
 * 项目选项查询Hook（原 useDepartmentOptions）
 * 返回适用于Select组件的选项格式
 * 
 * @param includeHQ - 是否包含总部选项
 * @returns Select组件选项格式的项目列表
 */
export function useProjectOptions(includeHQ = true) {
    return useApiQuery<SelectOption[]>(
        ['departments', 'options', includeHQ],
        api.departments,
        {
            select: (data: ProjectListResponse) => {
                const rawList = extractProjects(data)
                const options = rawList.map(d => ({
                    value: d.id,
                    label: d.name
                }))

                return options
            },
            staleTime: 60 * 60 * 1000, // 1小时缓存
        }
    )
}

export function useCreateProject() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (data: Partial<Project>) => {
            const result = await apiClient.post<Project>(api.departments, data)
            return result
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['departments'] })
        },
    })
}

export function useUpdateProject() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async ({ id, data }: { id: string; data: Partial<Project> }) => {
            const result = await apiClient.put<Project>(`${api.departments}/${id}`, data)
            return result
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['departments'] })
        },
    })
}

export function useDeleteProject() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (id: string) => {
            await apiClient.delete(`${api.departments}/${id}`)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['departments'] })
        },
    })
}


