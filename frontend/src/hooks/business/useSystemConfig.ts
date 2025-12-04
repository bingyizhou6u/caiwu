import { useApiQuery } from '../../utils/useApiQuery'
import { api } from '../../config/api'
import { api as apiClient } from '../../api/http'
import { useMutation, useQueryClient } from '@tanstack/react-query'

export interface SystemConfig {
    key: string
    value: string | boolean
    description?: string
}

/**
 * 系统配置查询Hook
 * @param key 配置键
 */
export function useSystemConfig(key: string) {
    return useApiQuery<SystemConfig>(
        ['systemConfig', key],
        `${api.systemConfig}/${key}`,
        {
            staleTime: 5 * 60 * 1000, // 5分钟缓存
        }
    )
}

/**
 * 系统配置更新Hook
 */
export function useUpdateSystemConfig() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ key, value, description }: SystemConfig) => {
            await apiClient.put(`${api.systemConfig}/${key}`, { value, description })
        },
        onSuccess: (_, { key }) => {
            queryClient.invalidateQueries({ queryKey: ['systemConfig', key] })
        }
    })
}
