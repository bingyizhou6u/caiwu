/**
 * 批量操作按钮组件
 * 统一批量操作的按钮样式和交互
 */

import { Button, Popconfirm, ButtonProps } from 'antd'
import { ReactNode } from 'react'

export interface BatchActionButtonProps {
  /** 按钮文本 */
  label: string
  /** 选中的数量 */
  selectedCount: number
  /** 确认对话框标题 */
  confirmTitle?: string | ((count: number) => string)
  /** 点击确认回调 */
  onConfirm: () => void
  /** 按钮类型 */
  type?: ButtonProps['type']
  /** 按钮危险状态 */
  danger?: boolean
  /** 按钮图标 */
  icon?: ReactNode
  /** 是否禁用 */
  disabled?: boolean
  /** 是否加载中 */
  loading?: boolean
  /** 确认按钮文本 */
  okText?: string
  /** 取消按钮文本 */
  cancelText?: string
}

/**
 * 批量操作按钮组件
 */
export function BatchActionButton({
  label,
  selectedCount,
  confirmTitle,
  onConfirm,
  type = 'default',
  danger = true,
  icon,
  disabled,
  loading,
  okText = '确定',
  cancelText = '取消',
}: BatchActionButtonProps) {
  const isDisabled = disabled || selectedCount === 0
  
  const getConfirmTitle = (): string => {
    if (typeof confirmTitle === 'function') {
      return confirmTitle(selectedCount)
    }
    if (confirmTitle) {
      return confirmTitle
    }
    return `确定要${label}选中的 ${selectedCount} 项吗？`
  }

  return (
    <Popconfirm
      title={getConfirmTitle()}
      onConfirm={onConfirm}
      okText={okText}
      cancelText={cancelText}
      disabled={isDisabled}
    >
      <Button
        type={type}
        danger={danger}
        icon={icon}
        disabled={isDisabled}
        loading={loading}
      >
        {label} ({selectedCount})
      </Button>
    </Popconfirm>
  )
}
