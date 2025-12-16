import { useApiQuery } from '../../utils/useApiQuery'
import { api } from '../../config/api'
import { api as apiClient } from '../../api/http'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Vendor, SelectOption } from '../../types'

/**
 * 供应商数据查询Hook
 * 封装供应商列表的查询逻辑
 * 
 * @param activeOnly - 是否只查询启用的供应商
 * @returns 供应商列表和查询状态
 */
export function useVendors(params?: { activeOnly?: boolean; search?: string }) {
    const queryParams = new URLSearchParams()
    if (params?.activeOnly) queryParams.append('active', '1')
    if (params?.search) queryParams.append('search', params.search)

    return useApiQuery<Vendor[]>(
        ['vendors', params],
        `${api.vendors}?${queryParams.toString()}`,
        {
            select: (data: any) => Array.isArray(data) ? data : data?.results || [],
            staleTime: 5 * 60 * 1000, // 5分钟缓存
        }
    )
}

/**
 * 供应商选项查询Hook
 * 返回适用于Select组件的选项格式
 * 
 * @param options - 查询选项
 * @param options.activeOnly - 是否只包含启用的供应商
 * @returns Select组件选项格式的供应商列表
 */
export function useVendorOptions(options: { activeOnly?: boolean } = {}) {
    const params = new URLSearchParams();
    params.append('activeOnly', String(options.activeOnly ?? true));

    return useApiQuery<SelectOption[]>(
        ['vendors', 'options', options.activeOnly],
        `${api.vendors}?${params.toString()}`,
        {
            select: (data: any) => {
                const list = Array.isArray(data) ? data : data?.results || []
                return list.map((v: any) => ({
                    value: v.id,
                    label: v.name,
                }))
            },
            staleTime: 5 * 60 * 1000,
        }
    )
}

export function useCreateVendor() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (data: Partial<Vendor>) => {
            const result = await apiClient.post<Vendor>(api.vendors, data)
            return result
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['vendors'] })
        },
    })
}

export function useUpdateVendor() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async ({ id, data }: { id: string; data: Partial<Vendor> }) => {
            const result = await apiClient.put<Vendor>(`${api.vendors}/${id}`, data)
            return result
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['vendors'] })
        },
    })
}

export function useDeleteVendor() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (id: string) => {
            await apiClient.delete(`${api.vendors}/${id}`)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['vendors'] })
        },
    })
}

export function useBatchDeleteVendor() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (ids: string[]) => {
            await Promise.all(ids.map(id => apiClient.delete(`${api.vendors}/${id}`)))
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['vendors'] })
        }
    })
}
