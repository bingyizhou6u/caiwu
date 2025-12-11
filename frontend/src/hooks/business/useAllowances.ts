import { useApiQuery } from '../../utils/useApiQuery'
import { api } from '../../config/api'
import { api as apiClient } from '../../api/http'
import { useMutation, useQueryClient } from '@tanstack/react-query'

export interface AllowancePayment {
    id: string
    employeeId: string
    employeeName: string
    departmentId?: string
    departmentName?: string
    year: number
    month: number
    allowanceType: 'living' | 'housing' | 'transportation' | 'meal' | 'birthday'
    currencyId: string
    currencyName?: string
    amountCents: number
    paymentDate: string
    paymentMethod: 'cash' | 'transfer'
    voucherUrl?: string
    memo?: string
    createdBy?: string
    createdBy_name?: string
    createdAt: number
    updatedAt: number
}

interface AllowanceFilter {
    year?: number
    month?: number
    allowanceType?: string
    employeeId?: string
}

export function useAllowances(filter: AllowanceFilter) {
    const params = new URLSearchParams()
    if (filter.year) params.append('year', filter.year.toString())
    if (filter.month) params.append('month', filter.month.toString())
    if (filter.allowanceType) params.append('allowanceType', filter.allowanceType)
    if (filter.employeeId) params.append('employeeId', filter.employeeId)

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
