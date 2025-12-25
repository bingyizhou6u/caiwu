import { Errors } from './errors.js'

/**
 * 状态机工具类
 * 用于验证状态转换的合法性
 */
export class StateMachine {
  private transitions: Map<string, Set<string>> = new Map()

  constructor(transitions: Record<string, string[]>) {
    Object.entries(transitions).forEach(([from, tos]) => {
      this.transitions.set(from, new Set(tos))
    })
  }

  /**
   * 检查是否允许从某个状态转换到另一个状态
   */
  canTransition(from: string, to: string): boolean {
    const allowed = this.transitions.get(from)
    return allowed?.has(to) ?? false
  }

  /**
   * 验证状态转换，如果不允许则抛出错误
   */
  validateTransition(from: string, to: string): void {
    if (!this.canTransition(from, to)) {
      throw Errors.BUSINESS_ERROR(
        `不允许从状态 "${from}" 转换到 "${to}"`
      )
    }
  }

  /**
   * 获取从某个状态可以转换到的所有状态
   */
  getPossibleTransitions(from: string): string[] {
    const allowed = this.transitions.get(from)
    return allowed ? Array.from(allowed) : []
  }
}

/**
 * 薪资支付状态机
 * 状态流转: pending_employee_confirmation → pending_finance_approval → pending_payment → pending_payment_confirmation → completed
 */
export const salaryPaymentStateMachine = new StateMachine({
  pending_employee_confirmation: ['pending_finance_approval', 'deleted'],
  pending_finance_approval: ['pending_payment', 'pending_employee_confirmation'],
  pending_payment: ['pending_payment_confirmation'],
  pending_payment_confirmation: ['completed'],
  completed: [], // 终态，不允许转换
})

/**
 * 借款状态机
 * 状态流转: pending → approved → outstanding → partial → repaid
 */
export const borrowingStateMachine = new StateMachine({
  pending: ['approved', 'rejected'],
  approved: ['outstanding'],
  outstanding: ['partial', 'repaid'],
  partial: ['repaid'],
  repaid: [], // 终态
  rejected: [], // 终态
})

/**
 * 报销状态机
 * 状态流转: pending → approved/rejected; approved → paid
 */
export const reimbursementStateMachine = new StateMachine({
  pending: ['approved', 'rejected'],
  approved: ['paid'], // 审批通过后可以支付
  paid: [], // 终态
  rejected: [], // 终态
})

/**
 * 请假状态机
 * 状态流转: pending → approved → rejected
 */
export const leaveStateMachine = new StateMachine({
  pending: ['approved', 'rejected'],
  approved: [], // 终态
  rejected: [], // 终态
})

