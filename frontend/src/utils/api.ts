/**
 * API 工具函数
 * 统一处理 API 调用、错误处理和响应解析
 */

import { message } from 'antd'

/**
 * 解析 API 响应，统一处理结果格式
 */
export function parseResponse<T = any>(response: Response): Promise<{ results: T[]; data?: T }> {
  return response.json().then((data: any) => {
    // 统一处理：可能是 { results: [] } 或直接的数组
    if (Array.isArray(data)) {
      return { results: data }
    }
    return { results: data.results ?? [], data }
  })
}

/**
 * 统一的 API 请求函数
 */
export async function apiRequest<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<{ results: T[]; data?: T }> {
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }))
    const errorObj = new Error(error.error || `请求失败: ${response.status}`) as any
    errorObj.status = response.status
    throw errorObj
  }

  return parseResponse<T>(response)
}

/**
 * GET 请求
 */
export async function apiGet<T = any>(url: string): Promise<T[]> {
  const { results } = await apiRequest<T>(url, { method: 'GET' })
  return results
}

/**
 * POST 请求
 */
export async function apiPost<T = any>(url: string, body: any): Promise<T> {
  const { data } = await apiRequest<T>(url, {
    method: 'POST',
    body: JSON.stringify(body),
  })
  return data as T
}

/**
 * PUT 请求
 */
export async function apiPut<T = any>(url: string, body: any): Promise<T> {
  const { data } = await apiRequest<T>(url, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
  return data as T
}

/**
 * DELETE 请求
 */
export async function apiDelete(url: string): Promise<void> {
  await apiRequest(url, { method: 'DELETE' })
}

/**
 * 带错误处理的 API 调用
 */
export async function safeApiCall<T>(
  apiCall: () => Promise<T>,
  errorMessage = '操作失败'
): Promise<T | null> {
  try {
    return await apiCall()
  } catch (error: any) {
    message.error(error.message || errorMessage)
    return null
  }
}

/**
 * 处理 409 冲突错误
 */
export function handleConflictError(error: any, entityName: string, fieldName: string = 'name'): void {
  if (error.status === 409 || error.message?.includes('duplicate')) {
    message.error(`${entityName}"${fieldName}"已存在，请使用其他名称`)
  } else {
    message.error(error.message || '操作失败')
  }
}

