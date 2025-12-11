import { useApiQuery } from '../../utils/useApiQuery'
import { api } from '../../config/api'
import { api as apiClient } from '../../api/http'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AccountTransfer } from '../../types/business'

export function useAccountTransfers(dateRange?: [string, string]) {
    const params = new URLSearchParams()
    if (dateRange) {
        params.append('startDate', dateRange[0])
        params.append('endDate', dateRange[1])
    }

    const queryString = params.toString()
    const url = queryString ? `${api.accountTransfers}?${queryString}` : api.accountTransfers

    return useApiQuery<AccountTransfer[]>(
        ['account-transfers', dateRange ? `${dateRange[0]}-${dateRange[1]}` : 'all'],
        url,
        {
            select: (data: any) => data.results ?? [],
            staleTime: 5 * 60 * 1000,
        }
    )
}

export function useCreateAccountTransfer() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (data: any) => {
            await apiClient.post(api.accountTransfers, data)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['account-transfers'] })
            queryClient.invalidateQueries({ queryKey: ['accounts'] }) // Update account balances
        }
    })
}
