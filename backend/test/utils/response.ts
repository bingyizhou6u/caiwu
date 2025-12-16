/**
 * 测试工具函数 - 类型安全的响应断言
 *
 * 用于替代测试文件中的 `as any` 类型断言，提供类型安全的响应验证
 */

import type { ApiSuccessResponse, ApiErrorResponse } from '../../src/utils/response.js'

/**
 * 断言响应是成功的 API 响应
 */
export function assertSuccessResponse<T>(
  response: unknown
): asserts response is ApiSuccessResponse<T> {
  if (typeof response !== 'object' || response === null) {
    throw new Error('Response is not an object')
  }
  if (!('success' in response) || response.success !== true) {
    throw new Error('Response is not successful')
  }
  if (!('data' in response)) {
    throw new Error('Response missing data field')
  }
}

/**
 * 断言响应是错误 API 响应
 */
export function assertErrorResponse(response: unknown): asserts response is ApiErrorResponse {
  if (typeof response !== 'object' || response === null) {
    throw new Error('Response is not an object')
  }
  if (!('success' in response) || response.success !== false) {
    throw new Error('Response is not an error response')
  }
  if (!('error' in response)) {
    throw new Error('Response missing error field')
  }
}

/**
 * 类型安全的响应提取器
 * 从响应中提取数据，并进行类型检查
 */
export function extractSuccessData<T>(response: unknown): T {
  assertSuccessResponse<T>(response)
  return response.data
}

/**
 * 类型安全的错误提取器
 * 从错误响应中提取错误信息
 */
export function extractError(response: unknown): ApiErrorResponse['error'] {
  assertErrorResponse(response)
  return response.error
}
