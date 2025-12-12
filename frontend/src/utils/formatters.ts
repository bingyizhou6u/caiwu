/**
 * 数据格式化工具函数
 */

/**
 * 格式化金额（分转元）
 */
export function formatAmount(cents: number | null | undefined): string {
  if (cents == null) return '-'
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2
  }).format(cents / 100)
}

/**
 * 格式化日期
 */
export function formatDate(date: string | null | undefined): string {
  if (!date) return '-'
  return date
}

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

