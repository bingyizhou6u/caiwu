/**
 * 供应商选择器组件
 * 封装供应商下拉选择逻辑，统一格式和样式
 */

import { Select, SelectProps } from 'antd'
import { useVendorOptions } from '../../hooks'
import type { SelectOption } from '../../types/business'

export interface VendorSelectProps extends Omit<SelectProps, 'options' | 'loading'> {
  /** 是否只显示启用的供应商 */
  activeOnly?: boolean
  /** 自定义格式化供应商标签 */
  formatLabel?: (vendor: { id: string; name: string }) => string
}

/**
 * 供应商选择器
 * 
 * @example
 * ```tsx
 * <Form.Item name="vendorId" label="供应商">
 *   <VendorSelect placeholder="请选择供应商" />
 * </Form.Item>
 * ```
 */
export function VendorSelect({
  activeOnly = true,
  formatLabel,
  ...props
}: VendorSelectProps) {
  const { data: vendors = [], isLoading } = useVendorOptions({ activeOnly })

  // 确保 vendors 是数组
  const safeVendors = Array.isArray(vendors) ? vendors : []

  // 格式化选项
  const options: SelectOption[] = safeVendors.map((vendor) => {
    let label: string
    if (formatLabel) {
      label = formatLabel({
        id: vendor.value,
        name: vendor.label,
      })
    } else {
      label = vendor.label
    }

    return {
      value: vendor.value,
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
      placeholder={props.placeholder || '请选择供应商'}
    />
  )
}

