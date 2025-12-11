import { useApiQuery } from '../../utils/useApiQuery'
import { api } from '../../config/api'
import { api as apiClient } from '../../api/http'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CACHE_TIME } from '../../config/cache'

export interface IPWhitelist {
    id: string
    ip_address: string
    description?: string
    cloudflare_rule_id?: string
    createdAt: number
    updatedAt: number
}

export interface RuleStatus {
    enabled: boolean
    ruleId?: string
    rulesetId?: string
}

/**
 * IP白名单数据查询Hook
 */
export function useIPWhitelist() {
    return useApiQuery<IPWhitelist[]>(
        ['ipWhitelist'],
        api.ipWhitelist,
        {
            select: (data: any) => {
                // Backend returns array directly, but some APIs wrap in results
                if (Array.isArray(data)) return data
                return data.results ?? data.data ?? []
            },
            staleTime: CACHE_TIME.TRANSACTION_DATA,
        }
    )
}

/**
 * IP白名单规则状态查询Hook
 */
export function useIPRuleStatus() {
    return useApiQuery<RuleStatus>(
        ['ipWhitelistRule'],
        api.ipWhitelistRule,
        {
            select: (data: any) => {
                return data.data || data.results?.[0] || { enabled: false }
            },
            staleTime: CACHE_TIME.REALTIME, // 实时性要求高，不缓存
        }
    )
}

export function useCreateIPRule() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async () => {
            await apiClient.post(api.ipWhitelistRuleCreate, {})
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ipWhitelistRule'] })
        }
    })
}

export function useToggleIPRule() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (enabled: boolean) => {
            await apiClient.post(api.ipWhitelistRuleToggle, { enabled })
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ipWhitelistRule'] })
        }
    })
}

export function useAddIP() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (data: any) => {
            await apiClient.post(api.ipWhitelist, data)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ipWhitelist'] })
        }
    })
}

export function useDeleteIP() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (id: string) => {
            await apiClient.delete(api.ipWhitelistById(id))
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ipWhitelist'] })
        }
    })
}

export function useBatchAddIP() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (ips: any[]) => {
            const result = await apiClient.post<any>(api.ipWhitelistBatch, { ips })
            if (!result.success) {
                throw new Error(result.errors?.map((e: any) => e.error).join(', ') || '未知错误')
            }
            return result
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ipWhitelist'] })
        }
    })
}

export function useBatchDeleteIP() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (ids: string[]) => {
            const result = await apiClient.get<any>(api.ipWhitelistBatch, {
                method: 'DELETE',
                body: JSON.stringify({ ids }),
            })
            const data = result.data || result
            if (!data.success) {
                throw new Error('批量删除失败')
            }
            return data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ipWhitelist'] })
        }
    })
}

export function useSyncIPWhitelist() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async () => {
            return await apiClient.post<any>(api.ipWhitelistSync, {})
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ipWhitelist'] })
        }
    })
}
