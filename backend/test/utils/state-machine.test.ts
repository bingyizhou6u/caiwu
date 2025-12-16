import { describe, it, expect } from 'vitest'
import {
  StateMachine,
  salaryPaymentStateMachine,
  leaveStateMachine,
  reimbursementStateMachine,
  borrowingStateMachine,
} from '../../src/utils/state-machine'
import { Errors } from '../../src/utils/errors'

describe('StateMachine', () => {
  describe('基本功能', () => {
    it('应该允许有效的状态转换', () => {
      const machine = new StateMachine({
        A: ['B', 'C'],
        B: ['C'],
        C: [],
      })

      expect(machine.canTransition('A', 'B')).toBe(true)
      expect(machine.canTransition('A', 'C')).toBe(true)
      expect(machine.canTransition('B', 'C')).toBe(true)
    })

    it('应该拒绝无效的状态转换', () => {
      const machine = new StateMachine({
        A: ['B'],
        B: ['C'],
        C: [],
      })

      expect(machine.canTransition('A', 'C')).toBe(false)
      expect(machine.canTransition('B', 'A')).toBe(false)
      expect(machine.canTransition('C', 'A')).toBe(false)
    })

    it('应该验证状态转换并抛出错误', () => {
      const machine = new StateMachine({
        A: ['B'],
        B: [],
      })

      expect(() => machine.validateTransition('A', 'B')).not.toThrow()
      expect(() => machine.validateTransition('A', 'C')).toThrow()
    })
  })

  describe('薪资支付状态机', () => {
    it('应该允许从 pending_employee_confirmation 转换到 pending_finance_approval', () => {
      expect(
        salaryPaymentStateMachine.canTransition(
          'pending_employee_confirmation',
          'pending_finance_approval'
        )
      ).toBe(true)
    })

    it('应该允许从 pending_finance_approval 转换到 pending_payment', () => {
      expect(
        salaryPaymentStateMachine.canTransition(
          'pending_finance_approval',
          'pending_payment'
        )
      ).toBe(true)
    })

    it('应该允许从 pending_payment 转换到 pending_payment_confirmation', () => {
      expect(
        salaryPaymentStateMachine.canTransition(
          'pending_payment',
          'pending_payment_confirmation'
        )
      ).toBe(true)
    })

    it('应该允许从 pending_payment_confirmation 转换到 completed', () => {
      expect(
        salaryPaymentStateMachine.canTransition(
          'pending_payment_confirmation',
          'completed'
        )
      ).toBe(true)
    })

    it('应该拒绝从 completed 转换到其他状态', () => {
      expect(
        salaryPaymentStateMachine.canTransition('completed', 'pending_payment')
      ).toBe(false)
    })

    it('应该拒绝无效的状态转换', () => {
      expect(
        salaryPaymentStateMachine.canTransition(
          'pending_payment',
          'pending_employee_confirmation'
        )
      ).toBe(false)
    })
  })

  describe('请假状态机', () => {
    it('应该允许从 pending 转换到 approved', () => {
      expect(leaveStateMachine.canTransition('pending', 'approved')).toBe(true)
    })

    it('应该允许从 pending 转换到 rejected', () => {
      expect(leaveStateMachine.canTransition('pending', 'rejected')).toBe(true)
    })

    it('应该拒绝从 approved 转换到其他状态', () => {
      expect(leaveStateMachine.canTransition('approved', 'pending')).toBe(false)
    })
  })

  describe('报销状态机', () => {
    it('应该允许从 pending 转换到 approved', () => {
      expect(reimbursementStateMachine.canTransition('pending', 'approved')).toBe(true)
    })

    it('应该允许从 pending 转换到 rejected', () => {
      expect(reimbursementStateMachine.canTransition('pending', 'rejected')).toBe(true)
    })
  })

  describe('借款状态机', () => {
    it('应该允许从 pending 转换到 approved', () => {
      expect(borrowingStateMachine.canTransition('pending', 'approved')).toBe(true)
    })

    it('应该允许从 pending 转换到 rejected', () => {
      expect(borrowingStateMachine.canTransition('pending', 'rejected')).toBe(true)
    })

    it('应该允许从 approved 转换到 outstanding', () => {
      expect(borrowingStateMachine.canTransition('approved', 'outstanding')).toBe(true)
    })
  })
})

