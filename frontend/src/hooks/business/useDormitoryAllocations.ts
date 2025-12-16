import { useApiQuery } from '../../utils/useApiQuery'
import { api } from '../../config/api'
import { api as apiClient } from '../../api/http'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { DormitoryAllocation } from '../../types/rental'

export interface DormitoryAllocationFilters {
    propertyId?: string
    employeeId?: string
    returned?: boolean
}

export function useDormitoryAllocations(filters?: DormitoryAllocationFilters) {
    const queryParams = new URLSearchParams()
    if (filters?.propertyId) queryParams.append('propertyId', filters.propertyId)
    if (filters?.employeeId) queryParams.append('employeeId', filters.employeeId)
    if (filters?.returned !== undefined) queryParams.append('returned', filters.returned ? 'true' : 'false')

    return useApiQuery<DormitoryAllocation[]>(
        ['dormitoryAllocations', filters],
        `${api.rentalPropertiesAllocations}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`,
        {
            select: (data: any) => data.results ?? [],
            staleTime: 5 * 60 * 1000,
        }
    )
}

export function useAllocateDormitory() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async ({ propertyId, data }: { propertyId: string; data: any }) => {
            const result = await apiClient.post<any>(api.rentalPropertiesAllocateDormitory(propertyId), data)
            return result
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['dormitoryAllocations'] })
            queryClient.invalidateQueries({ queryKey: ['rentalProperties'] })
        },
    })
}

export function useReturnDormitory() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async ({ allocationId, data }: { allocationId: string; data: any }) => {
            await apiClient.post(api.rentalPropertiesAllocationReturn(allocationId), data)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['dormitoryAllocations'] })
            queryClient.invalidateQueries({ queryKey: ['rentalProperties'] })
        },
    })
}

