import { useApiQuery } from '../../utils/useApiQuery'
import { api } from '../../config/api'
import { api as apiClient } from '../../api/http'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Department, SelectOption } from '../../types'

/**
 * 部门数据查询Hook
 * 封装部门列表的查询逻辑
 * 
 * @returns 部门列表和查询状态
 * 
 * @example
 * ```tsx
 * const { data: departments, isLoading } = useDepartments()
 * ```
 */
export function useDepartments() {
    return useApiQuery<Department[]>(
        ['departments'],
        api.departments,
        {
            select: (data: any) => {
                const rawList = Array.isArray(data) ? data : data?.results || []
                return rawList
            },
            staleTime: 60 * 60 * 1000, // 1小时缓存 - Master Data
        }
    )
}

/**
 * 部门选项查询Hook
 * 返回适用于Select组件的选项格式
 * 
 * @param includeHQ - 是否包含总部选项
 * @returns Select组件选项格式的部门列表
 */
export function useDepartmentOptions(includeHQ = true) {
    return useApiQuery<SelectOption[]>(
        ['departments', 'options', includeHQ],
        api.departments,
        {
            select: (data: any) => {
                const rawList = Array.isArray(data) ? data : data?.results || []
                const options = rawList.map((d: any) => ({
                    value: d.id,
                    label: d.name
                }))

                // 添加总部选项
                if (includeHQ) {
                    const hasHQ = options.some((o: SelectOption) => o.value === 'hq')
                    if (!hasHQ) {
                        options.unshift({ value: 'hq', label: '总部' })
                    }
                }

                return options
            },
            staleTime: 60 * 60 * 1000, // 1小时缓存
        }
    )
}

export function useCreateDepartment() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (data: Partial<Department>) => {
            const result = await apiClient.post<Department>(api.departments, data)
            return result
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['departments'] })
        },
    })
}

export function useUpdateDepartment() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async ({ id, data }: { id: string; data: Partial<Department> }) => {
            const result = await apiClient.put<Department>(`${api.departments}/${id}`, data)
            return result
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['departments'] })
        },
    })
}

export function useDeleteDepartment() {
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
