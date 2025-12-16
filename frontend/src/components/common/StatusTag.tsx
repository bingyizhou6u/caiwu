/**
 * 状态标签组件
 * 统一显示状态标签，支持自定义状态映射
 */

import { Tag } from 'antd'
import { getStatusConfig, type StatusConfig } from '../../utils/status'

export interface StatusTagProps {
  /** 状态值 */
  status: string | null | undefined
  /** 状态映射配置 */
  statusMap: Record<string, StatusConfig>
  /** 空值显示文本，默认 '-' */
  emptyText?: string
  /** 自定义样式 */
  style?: React.CSSProperties
}

/**
 * 状态标签组件
 */
export function StatusTag({
  status,
  statusMap,
  emptyText = '-',
  style,
}: StatusTagProps) {
  const config = getStatusConfig(status, statusMap)
  
  if (!config) {
    return <span style={style}>{status || emptyText}</span>
  }

  return (
    <Tag color={config.color} style={style}>
      {config.text}
    </Tag>
  )
}
