import { useApiQuery } from '../../utils/useApiQuery'
import { api } from '../../config/api'
import { api as apiClient } from '../../api/http'
import { useMutation, useQueryClient } from '@tanstack/react-query'

/**
 * 审批记录
 */
export interface PendingLeave {
  id: string
  employeeId: string
  employeeName?: string | null
  departmentName?: string | null
  orgDepartmentName?: string | null
  leaveType: string
  startDate: string
  endDate: string
  days: number
  reason?: string | null
  createdAt: number | null
}

export interface PendingReimbursement {
  id: string
  employeeId: string
  employeeName?: string | null
  departmentName?: string | null
  orgDepartmentName?: string | null
  expenseType: string
  amountCents: number
  currency_symbol?: string | null
  expenseDate: string
  description: string
  createdAt: number | null
}

export interface PendingBorrowing {
  id: string
  userId: string
  employeeName?: string | null
  amountCents: number
  currency_symbol?: string | null
  memo?: string | null
  createdAt: number | null
}

export interface PendingApprovalsResponse {
  leaves: PendingLeave[]
  reimbursements: PendingReimbursement[]
  borrowings: PendingBorrowing[]
  counts: {
    leaves: number
    reimbursements: number
    borrowings: number
  }
}

export function useMyPendingApprovals() {
  return useApiQuery<PendingApprovalsResponse>(
    ['my', 'approvals', 'pending'],
    api.approvals.pending,
    {
      staleTime: 2 * 60 * 1000, // 2分钟缓存
    }
  )
}

export function useMyApprovalHistory() {
  return useApiQuery<Approval[]>(
    ['my', 'approvals', 'history'],
    api.approvals.history,
    {
      select: (data: any) => data.approvals || [],
      staleTime: 5 * 60 * 1000,
    }
  )
}

export function useApproveLeave() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, memo }: { id: string; memo?: string }) => {
      await apiClient.post(api.approvals.leaveApprove(id), { memo })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my', 'approvals'] })
      queryClient.invalidateQueries({ queryKey: ['leaves'] })
      queryClient.invalidateQueries({ queryKey: ['my', 'dashboard'] })
    },
  })
}

export function useRejectLeave() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, memo }: { id: string; memo?: string }) => {
      await apiClient.post(api.approvals.leaveReject(id), { memo })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my', 'approvals'] })
      queryClient.invalidateQueries({ queryKey: ['leaves'] })
      queryClient.invalidateQueries({ queryKey: ['my', 'dashboard'] })
    },
  })
}

export function useApproveReimbursement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, memo }: { id: string; memo?: string }) => {
      await apiClient.post(api.approvals.reimbursementApprove(id), { memo })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my', 'approvals'] })
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['my', 'dashboard'] })
    },
  })
}

export function useRejectReimbursement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, memo }: { id: string; memo?: string }) => {
      await apiClient.post(api.approvals.reimbursementReject(id), { memo })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my', 'approvals'] })
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['my', 'dashboard'] })
    },
  })
}

export function useApproveBorrowing() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, memo }: { id: string; memo?: string }) => {
      await apiClient.post(api.approvals.borrowingApprove(id), { memo })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my', 'approvals'] })
      queryClient.invalidateQueries({ queryKey: ['borrowings'] })
      queryClient.invalidateQueries({ queryKey: ['my', 'dashboard'] })
    },
  })
}

export function useRejectBorrowing() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, memo }: { id: string; memo?: string }) => {
      await apiClient.post(api.approvals.borrowingReject(id), { memo })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my', 'approvals'] })
      queryClient.invalidateQueries({ queryKey: ['borrowings'] })
      queryClient.invalidateQueries({ queryKey: ['my', 'dashboard'] })
    },
  })
}

