import { useApiQuery } from '../../utils/useApiQuery'
import { api } from '../../config/api'
import { api as apiClient } from '../../api/http'
import { useMutation, useQueryClient } from '@tanstack/react-query'

export interface AllowancePayment {
    id: string
    employee_id: string
    employee_name: string
    department_id?: string
    department_name?: string
    year: number
    month: number
    allowance_type: 'living' | 'housing' | 'transportation' | 'meal' | 'birthday'
    currency_id: string
    currency_name?: string
    amount_cents: number
    payment_date: string
    payment_method: 'cash' | 'transfer'
    voucher_url?: string
    memo?: string
    created_by?: string
    created_by_name?: string
    created_at: number
    updated_at: number
}

interface AllowanceFilter {
    year?: number
    month?: number
    allowance_type?: string
    employee_id?: string
}

export function useAllowances(filter: AllowanceFilter) {
    const params = new URLSearchParams()
    if (filter.year) params.append('year', filter.year.toString())
    if (filter.month) params.append('month', filter.month.toString())
    if (filter.allowance_type) params.append('allowance_type', filter.allowance_type)
    if (filter.employee_id) params.append('employee_id', filter.employee_id)

    return useApiQuery<AllowancePayment[]>(
        ['allowances', filter],
        `${api.allowancePayments}?${params.toString()}`,
        {
            select: (data: any) => data.results ?? [],
            staleTime: 5 * 60 * 1000,
        }
    )
}

export function useCreateAllowance() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (data: any) => {
            await apiClient.post(api.allowancePayments, data)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['allowances'] })
        }
    })
}

export function useUpdateAllowance() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async ({ id, data }: { id: string, data: any }) => {
            await apiClient.put(api.allowancePaymentsById(id), data)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['allowances'] })
        }
    })
}

export function useDeleteAllowance() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (id: string) => {
            await apiClient.delete(api.allowancePaymentsById(id))
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['allowances'] })
        }
    })
}

export function useGenerateAllowances() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (data: any) => {
            return await apiClient.post<any>(api.allowancePaymentsGenerate, data)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['allowances'] })
        }
    })
}
