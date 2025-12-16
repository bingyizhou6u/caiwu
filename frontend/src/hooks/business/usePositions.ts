import { useApiQuery } from '../../utils/useApiQuery'
import { api } from '../../config/api'
import { api as apiClient } from '../../api/http'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Position } from '../../types'

/**
 * 职位数据查询Hook
 * 
 * @returns 职位列表和查询状态
 */
export function usePositions() {
    return useApiQuery<Position[]>(
        ['positions'],
        api.positionPermissions,
        {
            staleTime: 60 * 60 * 1000, // 1小时缓存
            select: (data: any) => {
                if (Array.isArray(data)) return data
                // Handle standard response wrapper { code, data, msg }
                if (Array.isArray(data?.data)) return data.data
                // Handle DRF pagination { results: [] }
                if (Array.isArray(data?.results)) return data.results
                return []
            }
        }
    )
}

export function useUpdatePosition() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async ({ id, data }: { id: string; data: Partial<Position> }) => {
            const result = await apiClient.put<Position>(`${api.positions}/${id}`, data)
            return result
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['positions'] })
        },
    })
}
