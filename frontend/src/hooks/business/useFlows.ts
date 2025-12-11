import { useApiQuery } from '../../utils/useApiQuery'
import { api } from '../../config/api'
import { api as apiClient } from '../../api/http'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CACHE_TIME } from '../../config/cache'
import type { Flow } from '../../types/business'

export function useFlows() {
    return useApiQuery<Flow[]>(
        ['flows'],
        api.flows,
        {
            select: (data: any) => {
                const list = Array.isArray(data) ? data : (data.results ?? [])
                return list.map((flow: any) => {
                    if (!flow.voucherUrls && flow.voucherUrl) {
                        flow.voucherUrls = [flow.voucherUrl]
                    } else if (!flow.voucherUrls) {
                        flow.voucherUrls = []
                    }
                    return flow
                })
            },
            staleTime: CACHE_TIME.TRANSACTION_DATA,
        }
    )
}

export function useCreateFlow() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (data: any) => {
            await apiClient.post(api.flows, data)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['flows'] })
            queryClient.invalidateQueries({ queryKey: ['accounts'] })
        }
    })
}

export function useUpdateFlowVoucher() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async ({ id, voucherUrls }: { id: string, voucherUrls: string[] }) => {
            await apiClient.put(`${api.flows}/${id}/voucher`, { voucherUrls })
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['flows'] })
        }
    })
}

export async function fetchNextVoucherNo(date: string) {
    const response = await apiClient.get<any>(`${api.flowsNextVoucher}?date=${date}`)
    return response.voucherNo
}

export function useBatchDeleteFlow() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (ids: string[]) => {
            await Promise.all(ids.map(id => apiClient.delete(`${api.flows}/${id}`)))
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['flows'] })
        }
    })
}
