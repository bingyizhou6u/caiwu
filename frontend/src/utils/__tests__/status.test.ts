import { describe, it, expect } from 'vitest'
import {
  getStatusConfig,
  getStatusText,
  getStatusColor,
  BORROWING_STATUS,
  LEAVE_STATUS,
  REIMBURSEMENT_STATUS,
} from '../status'

describe('status utils', () => {
  describe('getStatusConfig', () => {
    it('should get status config correctly', () => {
      const config = getStatusConfig('pending', BORROWING_STATUS)
      expect(config).toEqual({ text: '待审批', color: 'processing' })
    })

    it('should return default config for unknown status', () => {
      const config = getStatusConfig('unknown', BORROWING_STATUS)
      expect(config).toEqual({ text: 'unknown', color: 'default' })
    })

    it('should handle null/undefined', () => {
      expect(getStatusConfig(null, BORROWING_STATUS)).toBeNull()
      expect(getStatusConfig(undefined, BORROWING_STATUS)).toBeNull()
    })
  })

  describe('getStatusText', () => {
    it('should get status text correctly', () => {
      expect(getStatusText('pending', BORROWING_STATUS)).toBe('待审批')
      expect(getStatusText('approved', BORROWING_STATUS)).toBe('已通过')
    })

    it('should return status value for unknown status', () => {
      expect(getStatusText('unknown', BORROWING_STATUS)).toBe('unknown')
    })

    it('should handle null/undefined', () => {
      expect(getStatusText(null, BORROWING_STATUS)).toBe('-')
      expect(getStatusText(undefined, BORROWING_STATUS)).toBe('-')
    })
  })

  describe('getStatusColor', () => {
    it('should get status color correctly', () => {
      expect(getStatusColor('pending', BORROWING_STATUS)).toBe('processing')
      expect(getStatusColor('approved', BORROWING_STATUS)).toBe('success')
      expect(getStatusColor('rejected', BORROWING_STATUS)).toBe('error')
    })

    it('should return default color for unknown status', () => {
      expect(getStatusColor('unknown', BORROWING_STATUS)).toBe('default')
    })
  })

  describe('status mappings', () => {
    it('should have correct BORROWING_STATUS', () => {
      expect(BORROWING_STATUS.pending).toEqual({ text: '待审批', color: 'processing' })
      expect(BORROWING_STATUS.approved).toEqual({ text: '已通过', color: 'success' })
    })

    it('should have correct LEAVE_STATUS', () => {
      expect(LEAVE_STATUS.pending).toEqual({ text: '待审批', color: 'processing' })
      expect(LEAVE_STATUS.approved).toEqual({ text: '已通过', color: 'success' })
    })

    it('should have correct REIMBURSEMENT_STATUS', () => {
      expect(REIMBURSEMENT_STATUS.pending).toEqual({ text: '待审批', color: 'processing' })
      expect(REIMBURSEMENT_STATUS.approved).toEqual({ text: '已通过', color: 'success' })
    })
  })
})

