import { useApiQuery } from '../../utils/useApiQuery'
import { api } from '../../config/api'
import { api as apiClient } from '../../api/http'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Borrowing } from '../../types/business'

export function useBorrowings() {
    return useApiQuery<Borrowing[]>(
        ['borrowings'],
        api.borrowings,
        {
            select: (data: any) => data.results ?? [],
            staleTime: 5 * 60 * 1000,
        }
    )
}

export function useCreateBorrowing() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (data: any) => {
            await apiClient.post(api.borrowings, data)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['borrowings'] })
            queryClient.invalidateQueries({ queryKey: ['accounts'] })
        }
    })
}
