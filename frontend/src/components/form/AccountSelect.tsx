/**
 * 账户选择器组件
 * 封装账户下拉选择逻辑，统一格式和样式
 */

import { Select, SelectProps } from 'antd'
import { useAccounts } from '../../hooks'
import type { SelectOption } from '../../types/business'

export interface AccountSelectProps extends Omit<SelectProps, 'options' | 'loading'> {
  /** 按币种过滤账户 */
  filterByCurrency?: string
  /** 是否显示币种信息 */
  showCurrency?: boolean
  /** 自定义格式化账户标签 */
  formatLabel?: (account: { id: string; name: string; currency?: string; alias?: string }) => string
  /** 选择账户时的回调，可以获取账户信息 */
  onAccountChange?: (accountId: string, account?: SelectOption & { currency?: string }) => void
}

/**
 * 账户选择器
 * 
 * @example
 * ```tsx
 * <Form.Item name="accountId" label="账户">
 *   <AccountSelect 
 *     filterByCurrency="CNY"
 *     onAccountChange={(id, account) => {
 *       if (account?.currency) {
 *         form.setFieldsValue({ currency: account.currency })
 *       }
 *     }}
 *   />
 * </Form.Item>
 * ```
 */
export function AccountSelect({
  filterByCurrency,
  showCurrency = true,
  formatLabel,
  onAccountChange,
  onChange,
  ...props
}: AccountSelectProps) {
  const { data: accounts = [], isLoading } = useAccounts()

  // 确保 accounts 是数组
  const safeAccounts = Array.isArray(accounts) ? accounts : []

  // 过滤账户
  const filteredAccounts = filterByCurrency
    ? safeAccounts.filter((acc) => acc.currency === filterByCurrency)
    : safeAccounts

  // 格式化选项
  const options: (SelectOption & { currency?: string })[] = filteredAccounts.map((acc) => {
    let label: string
    if (formatLabel) {
      // 从 accounts hook 返回的数据中提取信息
      const parts = acc.label.split(' [')
      const namePart = parts[0] || acc.label
      const currencyPart = acc.currency || ''
      label = formatLabel({
        id: acc.value,
        name: namePart,
        currency: currencyPart,
        alias: undefined, // useAccounts 返回的数据中可能包含 alias
      })
    } else {
      label = acc.label
    }

    return {
      value: acc.value,
      label,
      currency: acc.currency,
    }
  })

  const handleChange = (value: string, option: any) => {
    const account = options.find((acc) => acc.value === value)
    if (onAccountChange) {
      onAccountChange(value, account)
    }
    if (onChange) {
      onChange(value, option)
    }
  }

  return (
    <Select
      {...props}
      options={options}
      loading={isLoading}
      showSearch
      optionFilterProp="label"
      placeholder={props.placeholder || '请选择账户'}
      onChange={handleChange}
    />
  )
}

