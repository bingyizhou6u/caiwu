/**
 * 员工选择器组件
 * 封装员工下拉选择逻辑，统一格式和样式
 */

import { Select, SelectProps } from 'antd'
import { useEmployees } from '../../hooks'
import type { Employee } from '../../types'
import type { SelectOption } from '../../types/business'

export interface EmployeeSelectProps extends Omit<SelectProps, 'options' | 'loading'> {
  /** 是否只显示活跃员工 */
  activeOnly?: boolean
  /** 是否显示部门信息 */
  showDepartment?: boolean
  /** 自定义格式化员工标签 */
  formatLabel?: (employee: { id: string; name: string; departmentName?: string }) => string
}

/**
 * 员工选择器
 * 
 * @example
 * ```tsx
 * <Form.Item name="employeeId" label="员工">
 *   <EmployeeSelect placeholder="请选择员工" />
 * </Form.Item>
 * ```
 */
export function EmployeeSelect({
  activeOnly = true,
  showDepartment = true,
  formatLabel,
  ...props
}: EmployeeSelectProps) {
  const { data: employees = [], isLoading } = useEmployees({ activeOnly, status: 'active' })

  // 确保 employees 是数组
  const safeEmployees = Array.isArray(employees) ? employees : []

  // 格式化选项
  const options: SelectOption[] = safeEmployees.map((emp: Employee) => {
    let label: string
    if (formatLabel) {
      label = formatLabel({
        id: emp.id || '',
        name: emp.name || '',
        departmentName: emp.departmentName,
      })
    } else if (showDepartment && emp.departmentName) {
      label = `${emp.name} (${emp.departmentName})`
    } else {
      label = emp.name || ''
    }

    return {
      value: emp.id || '',
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
      placeholder={props.placeholder || '请选择员工'}
    />
  )
}

