import { useApiQuery } from '../../utils/useApiQuery'
import { api } from '../../config/api'
import { api as apiClient } from '../../api/http'
import { useMutation, useQueryClient } from '@tanstack/react-query'

/**
 * 我的仪表盘数据
 */
export interface MyDashboard {
  employee: {
    id?: string
    name?: string | null
    email?: string
    position?: string | null
    department?: string | null
    orgDepartment?: string | null
  }
  stats: {
    salary: Array<{
      totalCents: number
      currencyId: string
    }>
    annualLeave: {
      cycleMonths: number
      cycleNumber: number
      cycleStart: string | null
      cycleEnd: string | null
      isFirstCycle: boolean
      total: number
      used: number
      remaining: number
    }
    pendingReimbursementCents: number
    borrowingBalanceCents: number
  }
  recentApplications: Array<{
    id: string
    type: string
    subType: string
    status: string | null
    amount: string | null
    createdAt: number | null
  }>
}

export function useMyDashboard() {
  return useApiQuery<MyDashboard>(
    ['my', 'dashboard'],
    api.my.dashboard,
    {
      staleTime: 2 * 60 * 1000, // 2分钟缓存
    }
  )
}

/**
 * 我的请假
 */
export interface MyLeave {
  id: string
  employeeId: string
  leaveType: string
  startDate: string
  endDate: string
  days: number
  status: string | null
  reason: string | null
  memo: string | null
  approvedBy: string | null
  approvedAt: number | null
  createdAt: number | null
  updatedAt: number | null
  approvedByName?: string | null
}

export interface MyLeavesResponse {
  leaves: MyLeave[]
  stats: Array<{
    leaveType: string
    usedDays: number
  }>
}

export function useMyLeaves(params?: { status?: string; year?: string }) {
  const queryParams = new URLSearchParams()
  if (params?.status) queryParams.append('status', params.status)
  if (params?.year) queryParams.append('year', params.year)

  return useApiQuery<MyLeavesResponse>(
    ['my', 'leaves', params],
    `${api.my.leaves}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`,
    {
      staleTime: 5 * 60 * 1000,
    }
  )
}

export function useCreateMyLeave() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: {
      leave_type?: string
      leaveType?: string
      startDate: string
      endDate: string
      days: number
      reason?: string
    }) => {
      const result = await apiClient.post<any>(api.my.leaves, {
        ...data,
        leave_type: data.leave_type || data.leaveType,
      })
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my', 'leaves'] })
      queryClient.invalidateQueries({ queryKey: ['my', 'dashboard'] })
    },
  })
}

/**
 * 我的报销
 */
export interface MyReimbursement {
  id: string
  employeeId: string
  expenseType: string
  expenseDate: string
  amountCents: number
  currencyId?: string
  currency_symbol?: string
  description?: string | null
  status: string | null
  reason?: string | null
  voucherUrl?: string | null
  approvedBy?: string | null
  approvedByName?: string | null
  approvedAt?: number | null
  createdAt: number | null
}

export interface MyReimbursementsResponse {
  reimbursements: MyReimbursement[]
  stats: Array<{
    status: string
    count: number
    totalCents: number
  }>
}

export function useMyReimbursements(params?: { status?: string }) {
  const queryParams = new URLSearchParams()
  if (params?.status) queryParams.append('status', params.status)

  return useApiQuery<MyReimbursementsResponse>(
    ['my', 'reimbursements', params],
    `${api.my.reimbursements}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`,
    {
      staleTime: 5 * 60 * 1000,
    }
  )
}

export function useCreateMyReimbursement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: {
      expenseType: string
      amountCents: number
      currencyId?: string
      expenseDate: string
      description?: string
      voucherUrl?: string
    }) => {
      const result = await apiClient.post<any>(api.my.reimbursements, data)
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my', 'reimbursements'] })
      queryClient.invalidateQueries({ queryKey: ['my', 'dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
    },
  })
}

/**
 * 我的借款
 */
export interface MyBorrowing {
  id: string
  employeeId: string
  amountCents: number
  currency?: string
  currency_symbol?: string
  borrow_date?: string
  memo?: string | null
  status: string | null
  accountName?: string
  repaid_cents?: number
  approvedBy?: string | null
  approvedAt?: number | null
  createdAt: number | null
  balanceCents?: number
}

export interface MyBorrowingsResponse {
  borrowings: MyBorrowing[]
  stats: {
    totalBorrowedCents: number
    totalRepaidCents: number
    balanceCents: number
  }
}

export function useMyBorrowings() {
  return useApiQuery<MyBorrowingsResponse>(
    ['my', 'borrowings'],
    api.my.borrowings,
    {
      staleTime: 5 * 60 * 1000,
    }
  )
}

export function useCreateMyBorrowing() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: {
      amountCents: number
      currency?: string
      memo?: string
    }) => {
      const result = await apiClient.post<any>(api.my.borrowings, data)
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my', 'borrowings'] })
      queryClient.invalidateQueries({ queryKey: ['my', 'dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['borrowings'] })
    },
  })
}

/**
 * 我的资产
 */
export interface MyAsset {
  id: string
  assetId: string
  assetName: string
  assetCode: string
  specification?: string | null
  brand?: string | null
  model?: string | null
  original_value_cents?: number | null
  allocationDate?: string | null
  returnDate?: string | null
  memo?: string | null
}

export interface MyAssetsResponse {
  current: MyAsset[]
  returned: MyAsset[]
}

export function useMyAssets() {
  return useApiQuery<MyAssetsResponse>(
    ['my', 'assets'],
    api.my.assets,
    {
      staleTime: 5 * 60 * 1000,
    }
  )
}

/**
 * 我的资料
 */
export interface MyProfile {
  id: string
  userId?: string | null
  name: string | null
  email: string
  phone?: string | null
  idCard?: string | null
  bankAccount?: string | null
  bankName?: string | null
  position?: string | null
  positionCode?: string | null
  department?: string | null
  orgDepartment?: string | null
  entryDate?: string | null
  contractEndDate?: string | null
  emergencyContact?: string | null
  emergencyPhone?: string | null
  status?: string | null
  workSchedule?: any | null
  annualLeaveCycleMonths?: number | null
  annualLeaveDays?: number | null
}

export function useMyProfile() {
  return useApiQuery<MyProfile | null>(
    ['my', 'profile'],
    api.my.profile,
    {
      staleTime: 10 * 60 * 1000, // 10分钟缓存
    }
  )
}

export function useUpdateMyProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: {
      phone?: string
      emergencyContact?: string
      emergencyPhone?: string
    }) => {
      const result = await apiClient.put<any>(api.my.profile, data)
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my', 'profile'] })
    },
  })
}

