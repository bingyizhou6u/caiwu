import { useApiQuery } from '../../utils/useApiQuery'
import { api } from '../../config/api'
import { api as apiClient } from '../../api/http'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { CreateExpenseDTO, UpdateExpenseDTO, ApproveExpenseDTO } from '../../types'

export interface ExpenseReimbursement {
    id: string
    employee_id: string
    employee_name?: string
    department_id?: string
    department_name?: string
    expense_type: string
    amount_cents: number
    expense_date: string
    description: string
    currency_id?: string
    currency_code?: string
    currency_name?: string
    account_id?: string
    account_name?: string
    voucher_url?: string
    status: 'pending' | 'approved' | 'rejected' | 'paid'
    memo?: string
    approved_by?: string
    approver_name?: string
    approved_at?: number
    paid_at?: number
    created_by?: string
    creator_name?: string
    created_at: number
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
