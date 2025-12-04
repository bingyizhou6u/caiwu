import { useApiQuery } from '../../utils/useApiQuery'
import { api } from '../../config/api'
import { api as apiClient } from '../../api/http'
import { useMutation, useQueryClient } from '@tanstack/react-query'

export interface EmployeeLeave {
    id: string
    employee_id: string
    employee_name?: string
    department_id?: string
    department_name?: string
    leave_type: string
    start_date: string
    end_date: string
    days: number
    status: 'pending' | 'approved' | 'rejected'
    reason?: string
    memo?: string
    approved_by?: string
    approver_name?: string
    approved_at?: number
    created_by?: string
    created_at: number
}

/**
 * 请假记录查询Hook
 */
export function useLeaves() {
    return useApiQuery<EmployeeLeave[]>(
        ['leaves'],
        api.employeeLeaves,
        {
            select: (data: any) => data.results ?? [],
            staleTime: 5 * 60 * 1000,
        }
    )
}

/**
 * 创建请假Hook
 */
export function useCreateLeave() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (data: any) => {
            await apiClient.post(api.employeeLeaves, data)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['leaves'] })
        }
    })
}

/**
 * 更新请假Hook
 */
export function useUpdateLeave() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ id, data }: { id: string, data: any }) => {
            await apiClient.put(api.employeeLeavesById(id), data)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['leaves'] })
        }
    })
}

/**
 * 删除请假Hook
 */
export function useDeleteLeave() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (id: string) => {
            await apiClient.delete(api.employeeLeavesById(id))
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['leaves'] })
        }
    })
}

/**
 * 审批请假Hook
 */
export function useApproveLeave() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ id, status, memo }: { id: string, status: string, memo?: string }) => {
            await apiClient.post(api.employeeLeavesApprove(id), { status, memo })
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['leaves'] })
        }
    })
}
