/**
 * 金额格式化工具函数
 * 统一处理金额的显示和转换
 */

/**
 * 将分转换为元（数字）
 */
export function centsToYuan(cents: number | null | undefined): number | null {
  if (cents == null) return null
  return cents / 100
}

/**
 * 将元转换为分（整数）
 */
export function yuanToCents(yuan: number): number {
  return Math.round(yuan * 100)
}

/**
 * 格式化金额（分转元，带币种符号）
 * @param cents 金额（分）
 * @param currency 币种代码，如 'CNY', 'USD'
 * @param showSymbol 是否显示币种符号，默认 true
 * @param precision 小数位数，默认 2
 */
export function formatAmountWithCurrency(
  cents: number | null | undefined,
  currency?: string,
  showSymbol = true,
  precision = 2
): string {
  if (cents == null) return '-'
  
  const amount = (cents / 100).toFixed(precision)
  
  if (!currency || !showSymbol) {
    return amount
  }
  
  // 币种符号映射
  const currencySymbols: Record<string, string> = {
    CNY: '¥',
    USD: '$',
    EUR: '€',
    USDT: 'USDT',
  }
  
  const symbol = currencySymbols[currency] || currency
  return `${symbol}${amount}`
}

/**
 * 格式化金额（分转元，使用 Intl.NumberFormat）
 * @param cents 金额（分）
 * @param currency 币种代码，默认 'CNY'
 * @param locale 语言环境，默认 'zh-CN'
 */
export function formatAmount(
  cents: number | null | undefined,
  currency: string = 'CNY',
  locale: string = 'zh-CN'
): string {
  if (cents == null) return '-'
  
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

/**
 * 格式化金额（简单格式，不带币种符号）
 * @param cents 金额（分）
 * @param precision 小数位数，默认 2
 */
export function formatAmountSimple(
  cents: number | null | undefined,
  precision = 2
): string {
  if (cents == null) return '-'
  return (cents / 100).toFixed(precision)
}

/**
 * 格式化金额范围
 * @param minCents 最小金额（分）
 * @param maxCents 最大金额（分）
 * @param currency 币种代码
 */
export function formatAmountRange(
  minCents: number | null | undefined,
  maxCents: number | null | undefined,
  currency?: string
): string {
  if (minCents == null && maxCents == null) return '-'
  if (minCents == null) return `≤ ${formatAmountWithCurrency(maxCents, currency)}`
  if (maxCents == null) return `≥ ${formatAmountWithCurrency(minCents, currency)}`
  if (minCents === maxCents) return formatAmountWithCurrency(minCents, currency)
  return `${formatAmountWithCurrency(minCents, currency)} - ${formatAmountWithCurrency(maxCents, currency)}`
}

