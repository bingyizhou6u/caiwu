import { useApiQuery } from '../../utils/useApiQuery'
import { api } from '../../config/api'
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
