/**
 * 金额输入组件
 * 封装金额输入逻辑，统一格式和验证规则
 */

import { InputNumber, InputNumberProps } from 'antd'

export interface AmountInputProps extends Omit<InputNumberProps, 'precision' | 'min'> {
  /** 精度（小数位数），默认 2 */
  precision?: number
  /** 是否允许负数，默认 false */
  allowNegative?: boolean
  /** 币种显示（仅用于显示，不影响值） */
  currency?: string
}

/**
 * 金额输入框
 * 
 * @example
 * ```tsx
 * <Form.Item name="amount" label="金额">
 *   <AmountInput placeholder="请输入金额" />
 * </Form.Item>
 * ```
 */
export function AmountInput({
  precision = 2,
  allowNegative = false,
  currency,
  style,
  placeholder,
  ...props
}: AmountInputProps) {
  const displayStyle = currency
    ? { ...style, width: style?.width || '100%' }
    : { width: '100%', ...style }

  return (
    <InputNumber
      {...props}
      style={displayStyle}
      min={allowNegative ? undefined : 0}
      precision={precision}
      placeholder={placeholder || (currency ? `请输入金额 (${currency})` : '请输入金额')}
    />
  )
}

