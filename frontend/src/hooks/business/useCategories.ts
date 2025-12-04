import { useApiQuery } from '../../utils/useApiQuery'
import { api } from '../../config/api'
import { api as apiClient } from '../../api/http'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CACHE_TIME } from '../../config/cache'
import type { Category, SelectOption } from '../../types'

/**
 * 类别数据查询Hook
 * 
 * @param kind - 可选，按类型筛选 'income' | 'expense'
 * @returns 类别列表和查询状态
 */
export function useCategories(kind?: 'income' | 'expense') {
    return useApiQuery<Category[]>(
        ['categories', kind],
        api.categories,
        {
            select: (data: any) => {
                const list = Array.isArray(data) ? data : data?.results || []
                return kind ? list.filter((c: Category) => c.kind === kind) : list
            },
            staleTime: CACHE_TIME.MASTER_DATA,
        }
    )
}

/**
 * 类别选项查询Hook
 * 
 * @param kind - 可选，按类型筛选
 * @returns Select组件选项格式的类别列表
 */
export function useCategoryOptions(kind?: 'income' | 'expense') {
    return useApiQuery<SelectOption[]>(
        ['categories', 'options', kind],
        api.categories,
        {
            select: (data: any) => {
                const list = Array.isArray(data) ? data : data?.results || []
                const filtered = kind ? list.filter((c: any) => c.kind === kind) : list
                return filtered.map((c: any) => ({
                    value: c.id,
                    label: c.name,
                }))
            },
            staleTime: CACHE_TIME.MASTER_DATA,
        }
    )
}

export function useCreateCategory() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (data: any) => {
            await apiClient.post(api.categories, data)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['categories'] })
            queryClient.invalidateQueries({ queryKey: ['categories', 'options'] })
        }
    })
}

export function useUpdateCategory() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async ({ id, data }: { id: string, data: any }) => {
            await apiClient.put(api.categoriesById(id), data)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['categories'] })
            queryClient.invalidateQueries({ queryKey: ['categories', 'options'] })
        }
    })
}

export function useDeleteCategory() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (id: string) => {
            await apiClient.delete(api.categoriesById(id))
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['categories'] })
            queryClient.invalidateQueries({ queryKey: ['categories', 'options'] })
        }
    })
}
