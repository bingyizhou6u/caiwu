/**
 * 审批流程工具函数
 * 统一处理审批相关的业务逻辑
 */

import { message } from 'antd'

/**
 * 审批操作类型
 */
export type ApprovalAction = 'approve' | 'reject'

/**
 * 审批结果
 */
export interface ApprovalResult {
  success: boolean
  message?: string
}

/**
 * 审批配置
 */
export interface ApprovalConfig {
  /** 审批通过的消息 */
  approveMessage?: string
  /** 驳回的消息 */
  rejectMessage?: string
  /** 成功后的回调 */
  onSuccess?: () => void
  /** 失败后的回调 */
  onError?: (error: Error) => void
}

/**
 * 创建审批处理函数
 * @param approveFn 审批通过的处理函数
 * @param rejectFn 驳回的处理函数
 * @param config 配置选项
 */
export function createApprovalHandler<T extends { id: string }>(
  approveFn: (id: string, memo?: string) => Promise<void>,
  rejectFn: (id: string, memo?: string) => Promise<void>,
  config: ApprovalConfig = {}
) {
  return async (
    action: ApprovalAction,
    record: T,
    memo?: string
  ): Promise<ApprovalResult> => {
    try {
      if (action === 'approve') {
        await approveFn(record.id, memo)
        message.success(config.approveMessage || '审批通过')
      } else {
        await rejectFn(record.id, memo)
        message.success(config.rejectMessage || '已驳回')
      }
      
      config.onSuccess?.()
      return { success: true }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('审批操作失败')
      message.error(err.message)
      config.onError?.(err)
      return { success: false, message: err.message }
    }
  }
}

/**
 * 检查是否可以审批
 * @param record 记录对象
 * @param statusField 状态字段名，默认 'status'
 * @param allowedStatuses 允许审批的状态列表
 */
export function canApprove<T extends Record<string, any>>(
  record: T,
  statusField: string = 'status',
  allowedStatuses: string[] = ['pending']
): boolean {
  const status = record[statusField]
  return allowedStatuses.includes(status)
}

/**
 * 检查是否可以驳回
 * @param record 记录对象
 * @param statusField 状态字段名，默认 'status'
 * @param allowedStatuses 允许驳回的状态列表
 */
export function canReject<T extends Record<string, any>>(
  record: T,
  statusField: string = 'status',
  allowedStatuses: string[] = ['pending']
): boolean {
  return canApprove(record, statusField, allowedStatuses)
}

/**
 * 获取审批按钮文本
 */
export function getApprovalButtonText(action: ApprovalAction): string {
  return action === 'approve' ? '审批通过' : '驳回'
}

/**
 * 获取审批操作类型
 */
export function getApprovalActionType(
  action: string
): ApprovalAction | null {
  if (action === 'approve' || action === 'reject') {
    return action
  }
  return null
}

