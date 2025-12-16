import { Errors } from './errors.js'

/**
 * 验证金额（以分为单位）
 * 
 * @param amountCents 金额（分）
 * @param min 最小金额（分），默认 0
 * @param max 最大金额（分），可选
 * @throws {Errors.VALIDATION_ERROR} 如果金额不符合要求
 */
export function validateAmount(amountCents: number, min = 0, max?: number): void {
  if (!Number.isInteger(amountCents)) {
    throw Errors.VALIDATION_ERROR('金额必须是整数（以分为单位）')
  }

  if (amountCents < min) {
    throw Errors.VALIDATION_ERROR(`金额不能小于 ${min / 100} 元`)
  }

  if (max !== undefined && amountCents > max) {
    throw Errors.VALIDATION_ERROR(`金额不能大于 ${max / 100} 元`)
  }
}

/**
 * 验证金额为正数
 */
export function validatePositiveAmount(amountCents: number): void {
  validateAmount(amountCents, 1)
}

/**
 * 验证金额不为负数
 */
export function validateNonNegativeAmount(amountCents: number): void {
  validateAmount(amountCents, 0)
}

