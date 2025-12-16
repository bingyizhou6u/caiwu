/**
 * 金额显示组件
 * 统一格式化显示金额，支持币种和精度配置
 */

import { formatAmountWithCurrency, formatAmountSimple } from '../../utils/amount'

export interface AmountDisplayProps {
  /** 金额（分） */
  cents: number | null | undefined
  /** 币种代码 */
  currency?: string
  /** 是否显示币种符号，默认 true */
  showSymbol?: boolean
  /** 小数位数，默认 2 */
  precision?: number
  /** 空值显示文本，默认 '-' */
  emptyText?: string
  /** 自定义样式 */
  style?: React.CSSProperties
  /** 自定义类名 */
  className?: string
}

/**
 * 金额显示组件
 */
export function AmountDisplay({
  cents,
  currency,
  showSymbol = true,
  precision = 2,
  emptyText = '-',
  style,
  className,
}: AmountDisplayProps) {
  if (cents == null) {
    return <span style={style} className={className}>{emptyText}</span>
  }

  const formatted = currency && showSymbol
    ? formatAmountWithCurrency(cents, currency, showSymbol, precision)
    : formatAmountSimple(cents, precision)

  return (
    <span style={style} className={className}>
      {formatted}
    </span>
  )
}
