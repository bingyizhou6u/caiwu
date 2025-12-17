/**
 * React Query Hooks - 统一的数据获取和缓存
 */

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { api as apiClient } from '../api/http'

/**
 * 通用查询 Hook
 */
export function useApiQuery<T = any>(
  key: any,
  url: string,
  options?: {
    enabled?: boolean
    staleTime?: number
    gcTime?: number
    refetchInterval?: number
    refetchOnWindowFocus?: boolean
    select?: (data: any) => any
    placeholderData?: ((previousData: any) => any) | any
    keepPreviousData?: boolean
    retry?: number | boolean | ((failureCount: number, error: any) => boolean)
  }
) {
  return useQuery({
    queryKey: Array.isArray(key) ? key : [key],
    queryFn: async () => {
      const data = await apiClient.get<T>(url)
      return data
    },
    enabled: options?.enabled,
    staleTime: options?.staleTime,
    gcTime: options?.gcTime,
    refetchInterval: options?.refetchInterval,
    refetchOnWindowFocus: options?.refetchOnWindowFocus,
    select: options?.select,
    placeholderData: options?.keepPreviousData ? keepPreviousData : options?.placeholderData,
    retry: options?.retry,
  })
}

/**
 * 通用变更 Hook
 */
export function useApiMutation<TData = any, TVariables = any>(
  onSuccessCallback?: (data: TData) => void
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ url, method = 'POST', body }: {
      url: string
      method?: 'POST' | 'PUT' | 'DELETE' | 'PATCH'
      body?: any
    }) => {
      let data: TData
      switch (method) {
        case 'POST':
          data = await apiClient.post<TData>(url, body)
          break
        case 'PUT':
          data = await apiClient.put<TData>(url, body)
          break
        case 'DELETE':
          data = await apiClient.delete<TData>(url)
          break
        default:
          throw new Error(`Unsupported method: ${method}`)
      }
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries()
      if (onSuccessCallback) {
        onSuccessCallback(data)
      }
    },
  })
}

/**
 * 报表查询 Hook（带日期范围）
 */
export function useReportQuery<T = any>(
  reportName: string,
  url: string,
  params?: Record<string, any>
) {
  const queryKey = params
    ? [reportName, ...Object.values(params)]
    : [reportName]

  return useQuery({
    queryKey,
    queryFn: async () => {
      const data = await apiClient.get<T>(url)
      return data
    },
    staleTime: 3 * 60 * 1000, // 报表缓存3分钟
  })
}
