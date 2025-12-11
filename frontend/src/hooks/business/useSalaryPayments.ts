import { useApiQuery } from '../../utils/useApiQuery'
import { api } from '../../config/api'
import { api as apiClient } from '../../api/http'
import { useMutation, useQueryClient } from '@tanstack/react-query'

export interface SalaryPayment {
    id: string
    employeeId: string
    employeeName: string
    departmentId: string
    departmentName?: string
    year: number
    month: number
    salary_cents: number
    status: 'pending_employee_confirmation' | 'pending_finance_approval' | 'pending_payment' | 'pending_payment_confirmation' | 'completed'
    allocation_status?: 'pending' | 'requested' | 'approved'
    accountId?: string
    accountName?: string
    account_currency?: string
    employee_confirmed_at?: number
    employee_confirmed_by?: string
    employee_confirmed_by_name?: string
    finance_approved_at?: number
    finance_approved_by?: string
    finance_approved_by_name?: string
    payment_transferred_at?: number
    payment_transferred_by?: string
    payment_transferred_by_name?: string
    payment_voucher_path?: string
    payment_confirmed_at?: number
    payment_confirmed_by?: string
    payment_confirmed_by_name?: string
    memo?: string
    allocations?: Array<{
        id: string
        currencyId: string
        currencyName?: string
        amountCents: number
        accountId?: string
        accountName?: string
        status: 'pending' | 'approved' | 'rejected'
        requested_by?: string
        requested_by_name?: string
        approved_by?: string
        approved_by_name?: string
    }>
}

interface SalaryPaymentParams {
    year?: number
    month?: number
    status?: string
}

export function useSalaryPayments(params: SalaryPaymentParams) {
    const queryParams = new URLSearchParams()
    if (params.year) queryParams.append('year', params.year.toString())
    if (params.month) queryParams.append('month', params.month.toString())
    if (params.status) queryParams.append('status', params.status)

    return useApiQuery<SalaryPayment[]>(
        ['salaryPayments', params],
        `${api.salaryPayments}?${queryParams.toString()}`,
        {
            select: (data: any) => data.results ?? [],
            staleTime: 5 * 60 * 1000,
        }
    )
}

export function useGenerateSalaryPayments() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (data: { year: number, month: number }) => {
            const result = await apiClient.post<any>(api.salaryPaymentsGenerate, data)
            return result
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['salaryPayments'] })
        }
    })
}

export function useEmployeeConfirmSalary() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (id: string) => {
            await apiClient.post(api.salaryPaymentsEmployeeConfirm(id), {})
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['salaryPayments'] })
        }
    })
}

export function useFinanceApproveSalary() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (id: string) => {
            await apiClient.post(api.salaryPaymentsFinanceApprove(id), {})
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['salaryPayments'] })
        }
    })
}

export function usePaymentTransferSalary() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async ({ id, accountId }: { id: string, accountId: string }) => {
            await apiClient.post(api.salaryPaymentsPaymentTransfer(id), { accountId })
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['salaryPayments'] })
        }
    })
}

export function useRequestAllocationSalary() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async ({ id, allocations }: { id: string, allocations: any[] }) => {
            await apiClient.post(api.salaryPaymentsAllocations(id), { allocations })
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['salaryPayments'] })
        }
    })
}

export function useApproveAllocationSalary() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async ({ id, approve_all }: { id: string, approve_all: boolean }) => {
            await apiClient.post(api.salaryPaymentsAllocationsApprove(id), { approve_all })
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['salaryPayments'] })
        }
    })
}

export function useConfirmPaymentSalary() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async ({ id, payment_voucher_path }: { id: string, payment_voucher_path: string }) => {
            await apiClient.post(api.salaryPaymentsPaymentConfirm(id), { payment_voucher_path })
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['salaryPayments'] })
        }
    })
}
