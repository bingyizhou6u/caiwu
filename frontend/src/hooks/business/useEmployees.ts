import { useApiQuery } from '../../utils/useApiQuery'
import { api } from '../../config/api'
import { api as apiClient } from '../../api/http'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type {
    Employee,
    RegularizeEmployeeDTO,
    LeaveEmployeeDTO,
    RejoinEmployeeDTO,
    UpdateEmployeeSalariesDTO,
    UpdateEmployeeAllowancesDTO
} from '../../types'

interface EmployeeFilter {
    status?: string
    activeOnly?: boolean
    search?: string
}

export function useEmployees(filter?: EmployeeFilter) {
    const params = new URLSearchParams()
    if (filter?.status) params.append('status', filter.status)
    if (filter?.activeOnly) params.append('activeOnly', 'true')
    if (filter?.search) params.append('search', filter.search)

    return useApiQuery<Employee[]>(
        ['employees', filter],
        `${api.employees}?${params.toString()}`,
        {
            staleTime: 5 * 60 * 1000,
            select: (data: any) => Array.isArray(data) ? data : data?.results || [],
        }
    )
}

export function useRegularizeEmployee() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async ({ id, data }: { id: string, data: RegularizeEmployeeDTO }) => {
            await apiClient.post(api.employeesRegularize(id), data)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['employees'] })
        }
    })
}

export function useLeaveEmployee() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async ({ id, data }: { id: string, data: LeaveEmployeeDTO }) => {
            await apiClient.post(api.employeesLeave(id), data)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['employees'] })
        }
    })
}

export function useRejoinEmployee() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async ({ id, data }: { id: string, data: RejoinEmployeeDTO }) => {
            await apiClient.post(api.employeesRejoin(id), data)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['employees'] })
        }
    })
}

export function useUpdateEmployeeSalaries() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (data: UpdateEmployeeSalariesDTO) => {
            await apiClient.put(api.employeeSalariesBatch, data)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['employees'] })
        }
    })
}

export function useUpdateEmployeeAllowances() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (data: UpdateEmployeeAllowancesDTO) => {
            await apiClient.put(api.employeeAllowancesBatch, data)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['employees'] })
        }
    })
}

export function useDeleteEmployee() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (id: string) => {
            await apiClient.delete(api.employeesById(id))
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['employees'] })
        }
    })
}

export function useBatchDeleteEmployee() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (ids: string[]) => {
            await apiClient.post(api.employeesBatch, { ids })
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['employees'] })
        }
    })
}

export function useResetUserPassword() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (id: string) => {
            await apiClient.post(api.employeesResetPassword(id), {})
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['employees'] })
        }
    })
}

export function useToggleUserActive() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async ({ id, active }: { id: string, active: boolean }) => {
            await apiClient.put(api.employeesById(id), { active: active ? 1 : 0 })
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['employees'] })
        }
    })
}


