import { useApiQuery } from '../../utils/useApiQuery'
import { api } from '../../config/api'
import { api as apiClient } from '../../api/http'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CACHE_TIME } from '../../config/cache'

export interface SiteConfig {
    id: string
    config_key: string
    config_value: string
    description: string | null
    is_encrypted: boolean
    created_at: number
    updated_at: number
}

/**
 * 站点配置查询Hook
 */
export function useSiteConfig() {
    return useApiQuery<SiteConfig[]>(
        ['siteConfig'],
        api.siteConfig,
        {
            staleTime: CACHE_TIME.MASTER_DATA,
        }
    )
}

/**
 * 站点配置更新Hook
 */
export function useUpdateSiteConfig() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (values: Record<string, any>) => {
            await apiClient.put(api.siteConfig, values)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['siteConfig'] })
        }
    })
}
