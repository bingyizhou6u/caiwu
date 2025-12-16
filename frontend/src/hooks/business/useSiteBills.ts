import { useApiQuery } from '../../utils/useApiQuery'
import { api } from '../../config/api'
import { api as apiClient } from '../../api/http'
import { useMutation, useQueryClient } from '@tanstack/react-query'

/**
 * 站点账单相关 Hooks
 */

export interface SiteBill {
  id: string
  siteId: string
  siteName?: string
  billDate: string
  billType: 'income' | 'expense'
  amountCents: number
  currency: string
  description?: string
  accountId?: string
  accountName?: string
  categoryId?: string
  categoryName?: string
  status: 'pending' | 'paid' | 'cancelled'
  paymentDate?: string
  memo?: string
  createdAt?: number
}

interface SiteBillsParams {
  siteId?: string
  startDate?: string
  endDate?: string
  billType?: string
  status?: string
}

/**
 * 查询站点账单列表
 */
export function useSiteBills(params: SiteBillsParams = {}) {
  const queryParams = new URLSearchParams()
  if (params.siteId) queryParams.append('siteId', params.siteId)
  if (params.startDate) queryParams.append('startDate', params.startDate)
  if (params.endDate) queryParams.append('endDate', params.endDate)
  if (params.billType) queryParams.append('billType', params.billType)
  if (params.status) queryParams.append('status', params.status)

  return useApiQuery<SiteBill[]>(
    ['siteBills', params],
    `${api.siteBills}?${queryParams.toString()}`,
    {
      select: (data: any) => data.results || [],
      staleTime: 5 * 60 * 1000,
    }
  )
}

/**
 * 创建站点账单
 */
export function useCreateSiteBill() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: {
      siteId: string
      billDate: string
      billType: 'income' | 'expense'
      amountCents: number
      currency: string
      description?: string | null
      accountId?: string | null
      categoryId?: string | null
      status?: string
      paymentDate?: string | null
      memo?: string | null
    }) => {
      const result = await apiClient.post<SiteBill>(api.siteBills, data)
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['siteBills'] })
    },
  })
}

/**
 * 更新站点账单
 */
export function useUpdateSiteBill() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: {
      id: string
      data: {
        siteId: string
        billDate: string
        billType: 'income' | 'expense'
        amountCents: number
        currency: string
        description?: string | null
        accountId?: string | null
        categoryId?: string | null
        status: string
        paymentDate?: string | null
        memo?: string | null
      }
    }) => {
      const result = await apiClient.put<SiteBill>(`${api.siteBills}/${id}`, data)
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['siteBills'] })
    },
  })
}

/**
 * 删除站点账单
 */
export function useDeleteSiteBill() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`${api.siteBills}/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['siteBills'] })
    },
  })
}

