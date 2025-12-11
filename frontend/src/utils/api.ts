/**
 * API 工具函数
 * 
 * 本文件仅保留有用的辅助函数。
 * 所有API调用请使用 `apiClient`：
 * 
 * ```typescript
 * import { api as apiClient } from '../api/http'
 * const data = await apiClient.get<Employee[]>(api.employees)
 * ```
 */

import { message } from 'antd'

/**
 * 带错误处理的 API 调用包装器
 * 
 * ✅ 推荐使用：这是一个有用的辅助函数
 * 
 * @param apiCall API 调用函数
 * @param errorMessage 错误消息
 * @returns 成功时返回结果，失败时返回 null
 * 
 * @example
 * ```typescript
 * const result = await safeApiCall(
 *   () => apiClient.post(api.employees, data),
 *   '创建员工失败'
 * )
 * if (result) {
 *   // 成功处理
 * }
 * ```
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
 * 
 * ✅ 推荐使用：这是一个有用的辅助函数
 * 
 * @param error 错误对象
 * @param entityName 实体名称（用于错误消息）
 * @param fieldName 字段名称（用于错误消息）
 * 
 * @example
 * ```typescript
 * try {
 *   await apiClient.post(api.employees, data)
 * } catch (error) {
 *   handleConflictError(error, '员工', 'email')
 * }
 * ```
 */
export function handleConflictError(error: any, entityName: string, fieldName: string = 'name'): void {
  if (error.status === 409 || error.message?.includes('duplicate')) {
    message.error(`${entityName}"${fieldName}"已存在，请使用其他名称`)
  } else {
    message.error(error.message || '操作失败')
  }
}
