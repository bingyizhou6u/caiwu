/**
 * 部门选择器组件
 * 封装部门下拉选择逻辑，统一格式和样式
 */

import { Select, SelectProps } from 'antd'
import { useProjectOptions } from '../../hooks'
import type { SelectOption } from '../../types/business'

export interface DepartmentSelectProps extends Omit<SelectProps, 'options' | 'loading'> {
  /** 自定义格式化部门标签 */
  formatLabel?: (department: { id: string; name: string }) => string
  /** 是否包含总部选项 */
  includeHQ?: boolean
}

/**
 * 部门选择器
 * 
 * @example
 * ```tsx
 * <Form.Item name="projectId" label="部门">
 *   <DepartmentSelect placeholder="请选择部门" />
 * </Form.Item>
 * ```
 */
export function DepartmentSelect({
  formatLabel,
  includeHQ = false,
  ...props
}: DepartmentSelectProps) {
  const { data: options = [], isLoading } = useProjectOptions(includeHQ)

  // 确保 options 是数组
  const safeOptions = Array.isArray(options) ? options : []

  // 格式化选项
  const formattedOptions: SelectOption[] = safeOptions.map((opt: any) => {
    let label: string
    if (formatLabel) {
      label = formatLabel({
        id: String(opt.value),
        name: String(opt.label),
      })
    } else {
      label = String(opt.label)
    }

    return {
      value: opt.value,
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
      placeholder={props.placeholder || '请选择部门'}
    />
  )
}

