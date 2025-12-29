/**
 * 乐观锁工具函数
 * 用于实现并发控制，防止数据冲突
 */

import { Errors } from './errors.js'
import { ErrorCodes } from '../constants/errorCodes.js'

/**
 * 验证版本号并更新
 * 
 * @param currentVersion 当前版本号
 * @param expectedVersion 期望的版本号
 * @throws 如果版本不匹配，抛出并发冲突错误
 */
export function validateVersion(currentVersion: number | null, expectedVersion: number | null): void {
  // 版本号必须提供，不再跳过
  if (currentVersion === null || expectedVersion === null) {
    throw Errors.VALIDATION_ERROR('缺少版本号，无法进行并发控制')
  }

  if (currentVersion !== expectedVersion) {
    throw Errors.BUSINESS_ERROR(
      '数据已被其他用户修改，请刷新后重试',
      {
        code: ErrorCodes.BUS_CONCURRENT_MODIFICATION,
        currentVersion,
        expectedVersion,
      }
    )
  }
}

/**
 * 递增版本号
 */
export function incrementVersion(version: number | null): number {
  return (version || 0) + 1
}

