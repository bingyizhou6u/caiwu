import { useApiQuery } from '../../utils/useApiQuery'
import { api } from '../../config/api'
import { api as apiClient } from '../../api/http'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { RentalProperty } from '../../types/rental'

export interface RentalPropertyFilters {
    propertyType?: string
    status?: string
    departmentId?: string
}

export function useRentalProperties(filters?: RentalPropertyFilters) {
    const queryParams = new URLSearchParams()
    if (filters?.propertyType) queryParams.append('propertyType', filters.propertyType)
    if (filters?.status) queryParams.append('status', filters.status)
    if (filters?.departmentId) queryParams.append('departmentId', filters.departmentId)

    return useApiQuery<RentalProperty[]>(
        ['rentalProperties', filters],
        `${api.rentalProperties}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`,
        {
            select: (data: any) => data.results ?? [],
            staleTime: 5 * 60 * 1000,
        }
    )
}

export function useRentalProperty(id: string) {
    return useApiQuery<RentalProperty>(
        ['rentalProperty', id],
        api.rentalPropertiesById(id),
        {
            enabled: !!id,
            staleTime: 5 * 60 * 1000,
        }
    )
}

export function useCreateRentalProperty() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (data: any) => {
            const result = await apiClient.post<any>(api.rentalProperties, data)
            return result
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rentalProperties'] })
        },
    })
}

export function useUpdateRentalProperty() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async ({ id, data }: { id: string; data: any }) => {
            const result = await apiClient.put<any>(api.rentalPropertiesById(id), data)
            return result
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['rentalProperties'] })
            queryClient.invalidateQueries({ queryKey: ['rentalProperty', variables.id] })
        },
    })
}

export function useDeleteRentalProperty() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (id: string) => {
            await apiClient.delete(api.rentalPropertiesById(id))
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rentalProperties'] })
        },
    })
}

