import { useApiQuery } from '../../utils/useApiQuery'
import { api } from '../../config/api'
import { api as apiClient } from '../../api/http'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { RentalPayableBill } from '../../types/rental'

export interface RentalPayableBillFilters {
    propertyId?: string
    status?: string
    year?: number
    month?: number
}

export function useRentalPayableBills(filters?: RentalPayableBillFilters) {
    const queryParams = new URLSearchParams()
    if (filters?.propertyId) queryParams.append('propertyId', filters.propertyId)
    if (filters?.status) queryParams.append('status', filters.status)
    if (filters?.year) queryParams.append('year', filters.year.toString())
    if (filters?.month) queryParams.append('month', filters.month.toString())

    return useApiQuery<RentalPayableBill[]>(
        ['rentalPayableBills', filters],
        `${api.rentalPayableBills}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`,
        {
            select: (data: any) => data.results ?? [],
            staleTime: 5 * 60 * 1000,
        }
    )
}

export function useGeneratePayableBills() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (data: { propertyId?: string; year?: number; month?: number }) => {
            const result = await apiClient.post<any>(api.rentalPayableBillsGenerate, data)
            return result
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rentalPayableBills'] })
            queryClient.invalidateQueries({ queryKey: ['rentalProperties'] })
        },
    })
}

export function useMarkBillPaid() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async ({ id, paymentId }: { id: string; paymentId: string }) => {
            await apiClient.post(api.rentalPayableBillsMarkPaid(id), { paymentId })
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rentalPayableBills'] })
            queryClient.invalidateQueries({ queryKey: ['rentalPayments'] })
        },
    })
}

