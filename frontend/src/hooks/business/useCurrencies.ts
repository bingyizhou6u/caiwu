import { useApiQuery } from '../../utils/useApiQuery'
import { api } from '../../config/api'
import { api as apiClient } from '../../api/http'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CACHE_TIME } from '../../config/cache'
import type { Currency, SelectOption } from '../../types'
import type { ListResponse } from '../../types/responses'

// API 响应类型
type CurrencyListResponse = Currency[] | ListResponse<Currency>

// 辅助函数
function extractCurrencies(data: CurrencyListResponse): Currency[] {
    return Array.isArray(data) ? data : data?.results || []
}

/**
 * 币种数据查询Hook
 * 封装币种列表的查询逻辑
 * 
 * @param activeOnly - 是否只查询启用的币种
 * @returns 币种列表和查询状态
 */
export function useCurrencies(activeOnly = false) {
    const params = new URLSearchParams()
    params.append('activeOnly', String(activeOnly))
    const url = `${api.currencies}?${params.toString()}`

    return useApiQuery<Currency[]>(
        ['currencies', activeOnly],
        url,
        {
            select: (data: CurrencyListResponse) => {
                const list = extractCurrencies(data)
                return activeOnly ? list.filter(c => c.active === 1) : list
            },
            staleTime: CACHE_TIME.MASTER_DATA,
        }
    )
}

/**
 * 币种选项查询Hook
 * 返回适用于Select组件的选项格式
 * 
 * @param activeOnly - 是否只包含启用的币种
 * @returns Select组件选项格式的币种列表
 */
export function useCurrencyOptions(activeOnly = true) {
    return useApiQuery<SelectOption[]>(
        ['currencies', 'options', activeOnly],
        api.currencies,
        {
            select: (data: CurrencyListResponse) => {
                const list = extractCurrencies(data)
                const filtered = activeOnly ? list.filter(c => c.active === 1) : list
                return filtered.map(c => ({
                    value: c.code,
                    label: `${c.code} - ${c.name}`
                }))
            },
            staleTime: CACHE_TIME.MASTER_DATA,
        }
    )
}

// 币种创建/更新数据类型
interface CreateCurrencyData {
    code: string
    name: string
    active?: number
}

interface UpdateCurrencyData {
    name?: string
    active?: number
}

export function useCreateCurrency() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (data: CreateCurrencyData) => {
            await apiClient.post(api.currencies, data)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['currencies'] })
            queryClient.invalidateQueries({ queryKey: ['currencies', 'options'] })
        }
    })
}

export function useUpdateCurrency() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async ({ code, data }: { code: string, data: UpdateCurrencyData }) => {
            await apiClient.put(api.currenciesByCode(code), data)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['currencies'] })
            queryClient.invalidateQueries({ queryKey: ['currencies', 'options'] })
        }
    })
}

export function useDeleteCurrency() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (code: string) => {
            await apiClient.delete(api.currenciesByCode(code))
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['currencies'] })
            queryClient.invalidateQueries({ queryKey: ['currencies', 'options'] })
        }
    })
}

export function useToggleCurrencyActive() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async ({ code, active }: { code: string, active: boolean }) => {
            await apiClient.put(api.currenciesByCode(code), { active: active ? 1 : 0 })
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['currencies'] })
            queryClient.invalidateQueries({ queryKey: ['currencies', 'options'] })
        }
    })
}

export function useBatchCurrencies() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async ({ ids, operation }: { ids: string[], operation: 'delete' | 'activate' | 'deactivate' }) => {
            await apiClient.post(`${api.currencies}/batch`, { ids, operation })
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['currencies'] })
            queryClient.invalidateQueries({ queryKey: ['currencies', 'options'] })
        }
    })
}
