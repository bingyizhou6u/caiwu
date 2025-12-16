/**
 * 页面操作栏组件
 * 统一页面顶部的操作按钮布局
 */

import React, { ReactNode } from 'react'
import { Space, Button, ButtonProps } from 'antd'

export interface PageToolbarAction {
  /** 按钮文本（当使用 component 时可选） */
  label?: string
  /** 按钮类型 */
  type?: ButtonProps['type']
  /** 按钮危险状态 */
  danger?: boolean
  /** 按钮图标 */
  icon?: ReactNode
  /** 点击事件 */
  onClick?: () => void | Promise<void> | Promise<unknown>
  /** 是否禁用 */
  disabled?: boolean
  /** 是否加载中 */
  loading?: boolean
  /** 自定义按钮组件（使用时 label 可选） */
  component?: ReactNode
}

export interface PageToolbarProps {
  /** 操作按钮列表 */
  actions?: PageToolbarAction[]
  /** 自定义内容 */
  children?: ReactNode
  /** 是否换行，默认 false */
  wrap?: boolean
  /** 间距，默认 12 */
  gap?: number
  /** 自定义样式 */
  style?: React.CSSProperties
  /** 自定义类名 */
  className?: string
}

/**
 * 页面操作栏组件
 */
export function PageToolbar({
  actions = [],
  children,
  wrap = false,
  gap = 12,
  style,
  className,
}: PageToolbarProps) {
  const defaultStyle: React.CSSProperties = {
    marginBottom: gap,
    ...style,
  }

  return (
    <Space wrap={wrap} style={defaultStyle} className={className}>
      {actions.map((action, index) => {
        if (action.component) {
          return <React.Fragment key={index}>{action.component}</React.Fragment>
        }
        
        return (
          <Button
            key={index}
            type={action.type}
            danger={action.danger}
            icon={action.icon}
            onClick={action.onClick}
            disabled={action.disabled}
            loading={action.loading}
          >
            {action.label}
          </Button>
        )
      })}
      {children}
    </Space>
  )
}
