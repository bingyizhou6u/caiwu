/**
 * 币种选择器组件
 * 封装币种下拉选择逻辑，统一格式和样式
 */

import { Select, SelectProps } from 'antd'
import { useCurrencies } from '../../hooks'
import type { SelectOption } from '../../types/business'

export interface CurrencySelectProps extends Omit<SelectProps, 'options' | 'loading'> {
  /** 是否只显示代码（不显示名称） */
  codeOnly?: boolean
  /** 自定义格式化币种标签 */
  formatLabel?: (currency: { code: string; name: string }) => string
}

/**
 * 币种选择器
 * 
 * @example
 * ```tsx
 * <Form.Item name="currency" label="币种">
 *   <CurrencySelect placeholder="请选择币种" />
 * </Form.Item>
 * ```
 */
export function CurrencySelect({
  codeOnly = false,
  formatLabel,
  ...props
}: CurrencySelectProps) {
  const { data: currencies = [], isLoading } = useCurrencies()

  // 确保 currencies 是数组
  const safeCurrencies = Array.isArray(currencies) ? currencies : []

  // 格式化选项
  const options: SelectOption[] = safeCurrencies.map((curr) => {
    let label: string
    if (formatLabel) {
      // 从 label 中提取 code 和 name
      const parts = curr.label.split(' - ')
      label = formatLabel({
        code: parts[0] || curr.value,
        name: parts[1] || curr.value,
      })
    } else if (codeOnly) {
      label = curr.value
    } else {
      label = curr.label
    }

    return {
      value: curr.value,
      label,
    }
  })

  return (
    <Select
      {...props}
      options={options}
      loading={isLoading}
      showSearch
      optionFilterProp="label"
      placeholder={props.placeholder || '请选择币种'}
    />
  )
}

