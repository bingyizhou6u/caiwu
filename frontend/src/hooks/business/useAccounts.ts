import { useApiQuery } from '../../utils/useApiQuery'
import { api } from '../../config/api'
import { api as apiClient } from '../../api/http'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CACHE_TIME } from '../../config/cache'
import type { Account, SelectOption } from '../../types'

/**
 * 账户数据查询Hook
 * 封装账户列表的查询逻辑
 * 
 * @param filters - 可选的查询过滤条件
 * @returns 账户列表和查询状态
 */
export function useAccounts(filters?: {
    activeOnly?: boolean
    currency?: string
    accountType?: string
    search?: string
}) {
    const params = new URLSearchParams()

    if (filters?.activeOnly) {
        params.append('active', '1')
    }

    if (filters?.currency) {
        params.append('activeOnly', String(filters.activeOnly))
    }

    if (filters?.accountType) {
        params.append('accountType', filters.accountType)
    }

    if (filters?.search) {
        params.append('search', filters.search)
    }

    const url = `${api.accounts}${params.toString() ? `?${params.toString()}` : ''}`

    return useApiQuery<Account[]>(
        ['accounts', filters],
        url,
        {
            select: (data: any) => Array.isArray(data) ? data : data?.results || [],
            staleTime: CACHE_TIME.BUSINESS_DATA,
        }
    )
}

/**
 * 账户选项查询Hook
 * 返回适用于Select组件的选项格式，可按币种过滤
 * 
 * @param currency - 可选的币种过滤
 * @returns Select组件选项格式的账户列表
 */
export function useAccountOptions(currency?: string) {
    return useApiQuery<SelectOption[]>(
        ['accounts', 'options', currency],
        api.accounts,
        {
            select: (data: any) => {
                const list = Array.isArray(data) ? data : data?.results || []
                const filtered = currency
                    ? list.filter((a: any) => a.currency === currency)
                    : list

                return filtered.map((a: any) => ({
                    value: a.id,
                    label: `${a.name} (${a.currency})`,
                    currency: a.currency, // 额外信息，用于进一步过滤
                }))
            },
            staleTime: CACHE_TIME.BUSINESS_DATA,
        }
    )
}

export function useCreateAccount() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (data: Partial<Account>) => {
            const result = await apiClient.post<Account>(api.accounts, data)
            return result
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['accounts'] })
        },
    })
}

export function useUpdateAccount() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async ({ id, data }: { id: string; data: Partial<Account> }) => {
            const result = await apiClient.put<Account>(api.accountsById(id), data)
            return result
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['accounts'] })
        },
    })
}

export function useDeleteAccount() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (id: string) => {
            await apiClient.delete(api.accountsById(id))
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['accounts'] })
        },
    })
}

export function useBatchDeleteAccount() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (ids: string[]) => {
            await Promise.all(ids.map(id => apiClient.delete(api.accountsById(id))))
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['accounts'] })
        }
    })
}
