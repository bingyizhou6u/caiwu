/**
 * 部门选择器组件
 * 封装部门下拉选择逻辑，统一格式和样式
 */

import { Select, SelectProps } from 'antd'
import { useDepartmentOptions } from '../../hooks'
import type { SelectOption } from '../../types/business'

export interface DepartmentSelectProps extends Omit<SelectProps, 'options' | 'loading'> {
  /** 自定义格式化部门标签 */
  formatLabel?: (department: { id: string; name: string }) => string
}

/**
 * 部门选择器
 * 
 * @example
 * ```tsx
 * <Form.Item name="departmentId" label="部门">
 *   <DepartmentSelect placeholder="请选择部门" />
 * </Form.Item>
 * ```
 */
export function DepartmentSelect({
  formatLabel,
  ...props
}: DepartmentSelectProps) {
  const { data: departments = [], isLoading } = useDepartmentOptions()

  // 确保 departments 是数组
  const safeDepartments = Array.isArray(departments) ? departments : []

  // 格式化选项
  const options: SelectOption[] = safeDepartments.map((dept) => {
    let label: string
    if (formatLabel) {
      label = formatLabel({
        id: String(dept.value),
        name: String(dept.label),
      })
    } else {
      label = String(dept.label)
    }

    return {
      value: dept.value,
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

