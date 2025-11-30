/**
 * React Query Hooks - 统一的数据获取和缓存
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authedJsonFetch } from './authedFetch'

/**
 * 通用查询 Hook
 */
export function useApiQuery<T = any>(
  key: string | string[],
  url: string,
  options?: {
    enabled?: boolean
    staleTime?: number
    refetchInterval?: number
  }
) {
  return useQuery({
    queryKey: Array.isArray(key) ? key : [key],
    queryFn: async () => {
      const data = await authedJsonFetch(url)
      return data as T
    },
    enabled: options?.enabled,
    staleTime: options?.staleTime,
    refetchInterval: options?.refetchInterval,
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
      const init: RequestInit = {
        method,
        headers: { 'Content-Type': 'application/json' },
      }
      if (body) {
        init.body = JSON.stringify(body)
      }
      const response = await fetch(url, init)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || '请求失败')
      return data as TData
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
      const data = await authedJsonFetch(url)
      return data as T
    },
    staleTime: 3 * 60 * 1000, // 报表缓存3分钟
  })
}
