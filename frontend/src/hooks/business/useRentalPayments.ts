import { useApiQuery } from '../../utils/useApiQuery'
import { api } from '../../config/api'
import { api as apiClient } from '../../api/http'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { RentalPayment } from '../../types/rental'

export interface RentalPaymentFilters {
    propertyId?: string
    year?: number
    month?: number
}

export function useRentalPayments(filters?: RentalPaymentFilters) {
    const queryParams = new URLSearchParams()
    if (filters?.propertyId) queryParams.append('propertyId', filters.propertyId)
    if (filters?.year) queryParams.append('year', filters.year.toString())
    if (filters?.month) queryParams.append('month', filters.month.toString())

    return useApiQuery<RentalPayment[]>(
        ['rentalPayments', filters],
        `${api.rentalPayments}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`,
        {
            select: (data: any) => data.results ?? [],
            staleTime: 5 * 60 * 1000,
        }
    )
}

export function useCreateRentalPayment() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (data: any) => {
            const result = await apiClient.post<any>(api.rentalPayments, data)
            return result
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rentalPayments'] })
            queryClient.invalidateQueries({ queryKey: ['rentalProperties'] })
        },
    })
}

export function useUpdateRentalPayment() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async ({ id, data }: { id: string; data: any }) => {
            const result = await apiClient.put<any>(api.rentalPaymentsById(id), data)
            return result
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rentalPayments'] })
            queryClient.invalidateQueries({ queryKey: ['rentalProperties'] })
        },
    })
}

