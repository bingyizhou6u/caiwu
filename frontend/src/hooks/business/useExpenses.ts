import { useApiQuery } from '../../utils/useApiQuery'
import { api } from '../../config/api'
import { api as apiClient } from '../../api/http'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { CreateExpenseDTO, UpdateExpenseDTO, ApproveExpenseDTO } from '../../types'

export interface ExpenseReimbursement {
    id: string
    employeeId: string
    employeeName?: string
    departmentId?: string
    departmentName?: string
    expenseType: string
    amountCents: number
    expenseDate: string
    description: string
    currencyId?: string
    currencyCode?: string
    currencyName?: string
    accountId?: string
    accountName?: string
    voucherUrl?: string
    status: 'pending' | 'approved' | 'rejected' | 'paid'
    memo?: string
    approvedBy?: string
    approverName?: string
    approvedAt?: number
    paidAt?: number
    createdBy?: string
    creatorName?: string
    createdAt: number
}

export function useExpenses() {
    return useApiQuery<ExpenseReimbursement[]>(
        ['expenses'],
        api.expenseReimbursements,
        {
            staleTime: 5 * 60 * 1000,
        }
    )
}

export function useCreateExpense() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (data: CreateExpenseDTO) => {
            await apiClient.post(api.expenseReimbursements, data)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['expenses'] })
        }
    })
}

export function useUpdateExpense() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async ({ id, data }: { id: string, data: UpdateExpenseDTO }) => {
            await apiClient.put(api.expenseReimbursementsById(id), data)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['expenses'] })
        }
    })
}

export function useDeleteExpense() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (id: string) => {
            await apiClient.delete(api.expenseReimbursementsById(id))
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['expenses'] })
        }
    })
}

export function useApproveExpense() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async ({ id, ...data }: { id: string } & ApproveExpenseDTO) => {
            await apiClient.post(api.expenseReimbursementsApprove(id), data)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['expenses'] })
        }
    })
}

export function usePayExpense() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (id: string) => {
            await apiClient.post(api.expenseReimbursementsPay(id), {})
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['expenses'] })
        }
    })
}
