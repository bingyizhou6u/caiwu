/**
 * 数据格式化工具函数
 * 
 * @deprecated 请使用更具体的工具模块：
 * - 金额格式化：使用 utils/amount.ts
 * - 日期格式化：使用 utils/date.ts
 * - 状态映射：使用 utils/status.ts
 */

// 重新导出以保持向后兼容
export { formatAmount, formatAmountWithCurrency, formatAmountSimple } from './amount'
export { formatDate, formatDateTime, formatDateTimeFull } from './date'

/**
 * 格式化百分比
 */
export function formatPercent(value: number, decimals = 2): string {
  return `${(value * 100).toFixed(decimals)}%`
}

/**
 * 格式化数字（添加千分位）
 */
export function formatNumber(value: number | null | undefined): string {
  if (value == null) return '-'
  return value.toLocaleString('zh-CN')
}

