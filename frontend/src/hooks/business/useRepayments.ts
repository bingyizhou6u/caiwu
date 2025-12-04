import { useApiQuery } from '../../utils/useApiQuery'
import { api } from '../../config/api'
import { api as apiClient } from '../../api/http'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Repayment } from '../../types/business'

export function useRepayments() {
    return useApiQuery<Repayment[]>(
        ['repayments'],
        api.repayments,
        {
            select: (data: any) => data.results ?? [],
            staleTime: 5 * 60 * 1000,
        }
    )
}

export function useCreateRepayment() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (data: any) => {
            await apiClient.post(api.repayments, data)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['repayments'] })
            queryClient.invalidateQueries({ queryKey: ['borrowings'] }) // Update borrowing status
            queryClient.invalidateQueries({ queryKey: ['accounts'] }) // Update account balance
        }
    })
}
