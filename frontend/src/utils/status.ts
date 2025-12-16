/**
 * 状态映射工具
 * 统一管理各种业务状态的颜色和标签
 */

import React from 'react'
import { Tag } from 'antd'

/**
 * 通用状态配置
 */
export interface StatusConfig {
  text: string
  color?: string
}

/**
 * 借款状态
 */
export const BORROWING_STATUS: Record<string, StatusConfig> = {
  pending: { text: '待审批', color: 'processing' },
  approved: { text: '已通过', color: 'success' },
  rejected: { text: '已驳回', color: 'error' },
  outstanding: { text: '未还清', color: 'warning' },
  partial: { text: '部分还款', color: 'warning' },
  repaid: { text: '已还清', color: 'success' },
}

/**
 * 请假状态
 */
export const LEAVE_STATUS: Record<string, StatusConfig> = {
  pending: { text: '待审批', color: 'processing' },
  approved: { text: '已通过', color: 'success' },
  rejected: { text: '已驳回', color: 'error' },
  cancelled: { text: '已取消', color: 'default' },
}

/**
 * 报销状态
 */
export const REIMBURSEMENT_STATUS: Record<string, StatusConfig> = {
  pending: { text: '待审批', color: 'processing' },
  approved: { text: '已通过', color: 'success' },
  rejected: { text: '已驳回', color: 'error' },
  paid: { text: '已支付', color: 'success' },
  cancelled: { text: '已取消', color: 'default' },
}

/**
 * 薪资发放状态
 */
export const SALARY_PAYMENT_STATUS: Record<string, StatusConfig> = {
  pending_employee_confirmation: { text: '待员工确认', color: 'processing' },
  pending_finance_approval: { text: '待财务审批', color: 'warning' },
  pending_payment: { text: '待支付', color: 'warning' },
  pending_payment_confirmation: { text: '待确认转账', color: 'warning' },
  completed: { text: '已完成', color: 'success' },
}

/**
 * 薪资分配状态
 */
export const SALARY_ALLOCATION_STATUS: Record<string, StatusConfig> = {
  pending: { text: '待申请', color: 'default' },
  requested: { text: '待审批', color: 'processing' },
  approved: { text: '已批准', color: 'success' },
  rejected: { text: '已驳回', color: 'error' },
}

/**
 * 应收应付状态
 */
export const ARAP_STATUS: Record<string, StatusConfig> = {
  open: { text: '未结清', color: 'processing' },
  partial: { text: '部分结清', color: 'warning' },
  settled: { text: '已结清', color: 'success' },
  overdue: { text: '已逾期', color: 'error' },
  bad_debt: { text: '坏账', color: 'error' },
}

/**
 * 固定资产状态
 */
export const FIXED_ASSET_STATUS: Record<string, StatusConfig> = {
  in_use: { text: '在用', color: 'success' },
  idle: { text: '闲置', color: 'default' },
  maintenance: { text: '维修中', color: 'warning' },
  scrapped: { text: '已报废', color: 'error' },
  sold: { text: '已出售', color: 'default' },
}

/**
 * 租赁物业状态
 */
export const RENTAL_STATUS: Record<string, StatusConfig> = {
  active: { text: '使用中', color: 'success' },
  inactive: { text: '已停用', color: 'default' },
  expired: { text: '已到期', color: 'warning' },
}

/**
 * 站点账单状态
 */
export const SITE_BILL_STATUS: Record<string, StatusConfig> = {
  pending: { text: '待支付', color: 'processing' },
  paid: { text: '已支付', color: 'success' },
  overdue: { text: '已逾期', color: 'error' },
}

/**
 * 通用状态映射
 */
export const COMMON_STATUS: Record<string, StatusConfig> = {
  active: { text: '启用', color: 'success' },
  inactive: { text: '停用', color: 'default' },
  enabled: { text: '启用', color: 'success' },
  disabled: { text: '禁用', color: 'default' },
  pending: { text: '待处理', color: 'processing' },
  approved: { text: '已批准', color: 'success' },
  rejected: { text: '已驳回', color: 'error' },
  probation: { text: '试用', color: 'warning' },
  normal: { text: '正常', color: 'success' },
  late: { text: '迟到', color: 'warning' },
  early: { text: '早退', color: 'warning' },
  late_early: { text: '迟到且早退', color: 'error' },
}

/**
 * 获取状态配置
 */
export function getStatusConfig(
  status: string | null | undefined,
  statusMap: Record<string, StatusConfig>
): StatusConfig | null {
  if (!status) return null
  return statusMap[status] || { text: status, color: 'default' }
}

/**
 * 获取状态文本
 */
export function getStatusText(
  status: string | null | undefined,
  statusMap: Record<string, StatusConfig>
): string {
  const config = getStatusConfig(status, statusMap)
  return config?.text || status || '-'
}

/**
 * 获取状态颜色
 */
export function getStatusColor(
  status: string | null | undefined,
  statusMap: Record<string, StatusConfig>
): string {
  const config = getStatusConfig(status, statusMap)
  return config?.color || 'default'
}

/**
 * 渲染状态标签
 */
export function renderStatusTag(
  status: string | null | undefined,
  statusMap: Record<string, StatusConfig>
): React.ReactNode {
  const config = getStatusConfig(status, statusMap)
  if (!config) return <Tag>{status || '-'}</Tag>
  return <Tag color={config.color}>{config.text}</Tag>
}

