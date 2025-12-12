import { useApiQuery } from '../../utils/useApiQuery'
import { api } from '../../config/api'
import { api as apiClient } from '../../api/http'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Borrowing } from '../../types/business'

import { keepPreviousData } from '@tanstack/react-query'

export function useBorrowings(page: number = 1, pageSize: number = 20) {
    return useApiQuery<{ total: number, list: Borrowing[] }>(
        ['borrowings', page, pageSize],
        `${api.borrowings}?page=${page}&pageSize=${pageSize}`,
        {
            select: (data: any) => ({
                total: data.total ?? 0,
                list: data.results ?? []
            }),
            staleTime: 5 * 60 * 1000,
            placeholderData: keepPreviousData
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
