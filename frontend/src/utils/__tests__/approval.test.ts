import { describe, it, expect, vi } from 'vitest'
import {
  createApprovalHandler,
  canApprove,
  canReject,
  getApprovalButtonText,
  getApprovalActionType,
  type ApprovalAction,
} from '../approval'

describe('approval utils', () => {
  describe('canApprove', () => {
    it('should check if record can be approved', () => {
      const record = { id: '1', status: 'pending' }
      expect(canApprove(record, 'status', ['pending'])).toBe(true)
      expect(canApprove(record, 'status', ['approved'])).toBe(false)
    })

    it('should use default status field', () => {
      const record = { id: '1', status: 'pending' }
      expect(canApprove(record, undefined, ['pending'])).toBe(true)
    })
  })

  describe('canReject', () => {
    it('should check if record can be rejected', () => {
      const record = { id: '1', status: 'pending' }
      expect(canReject(record, 'status', ['pending'])).toBe(true)
    })
  })

  describe('getApprovalButtonText', () => {
    it('should get correct button text', () => {
      expect(getApprovalButtonText('approve')).toBe('审批通过')
      expect(getApprovalButtonText('reject')).toBe('驳回')
    })
  })

  describe('getApprovalActionType', () => {
    it('should get action type correctly', () => {
      expect(getApprovalActionType('approve')).toBe('approve')
      expect(getApprovalActionType('reject')).toBe('reject')
      expect(getApprovalActionType('unknown')).toBeNull()
    })
  })

  describe('createApprovalHandler', () => {
    it('should create approval handler', async () => {
      const approveFn = vi.fn().mockResolvedValue(undefined)
      const rejectFn = vi.fn().mockResolvedValue(undefined)
      
      const handler = createApprovalHandler(approveFn, rejectFn)
      const record = { id: '1' }

      await handler('approve', record)
      expect(approveFn).toHaveBeenCalledWith('1', undefined)

      await handler('reject', record, 'reason')
      expect(rejectFn).toHaveBeenCalledWith('1', 'reason')
    })
  })
})

