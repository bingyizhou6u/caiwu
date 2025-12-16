import { describe, it, expect } from 'vitest'
import {
  formatAmount,
  formatAmountWithCurrency,
  formatAmountSimple,
  centsToYuan,
  yuanToCents,
  formatAmountRange,
} from '../amount'

describe('amount utils', () => {
  describe('centsToYuan', () => {
    it('should convert cents to yuan', () => {
      expect(centsToYuan(100)).toBe(1)
      expect(centsToYuan(1234)).toBe(12.34)
      expect(centsToYuan(0)).toBe(0)
    })

    it('should handle null/undefined', () => {
      expect(centsToYuan(null)).toBeNull()
      expect(centsToYuan(undefined)).toBeNull()
    })
  })

  describe('yuanToCents', () => {
    it('should convert yuan to cents', () => {
      expect(yuanToCents(1)).toBe(100)
      expect(yuanToCents(12.34)).toBe(1234)
      expect(yuanToCents(0)).toBe(0)
    })

    it('should round to nearest integer', () => {
      expect(yuanToCents(12.345)).toBe(1235)
      expect(yuanToCents(12.344)).toBe(1234)
    })
  })

  describe('formatAmount', () => {
    it('should format amount with CNY currency', () => {
      const result = formatAmount(100)
      expect(result).toMatch(/¥\s?1\.00/)
    })

    it('should format amount with custom currency', () => {
      const result = formatAmount(100, 'USD')
      expect(result).toMatch(/\$?\s?1\.00/)
    })

    it('should handle null/undefined', () => {
      expect(formatAmount(null)).toBe('-')
      expect(formatAmount(undefined)).toBe('-')
    })
  })

  describe('formatAmountWithCurrency', () => {
    it('should format with currency symbol', () => {
      expect(formatAmountWithCurrency(100, 'CNY')).toBe('¥1.00')
      expect(formatAmountWithCurrency(100, 'USD')).toBe('$1.00')
    })

    it('should format without symbol when showSymbol is false', () => {
      expect(formatAmountWithCurrency(100, 'CNY', false)).toBe('1.00')
    })

    it('should handle null/undefined', () => {
      expect(formatAmountWithCurrency(null)).toBe('-')
      expect(formatAmountWithCurrency(undefined)).toBe('-')
    })
  })

  describe('formatAmountSimple', () => {
    it('should format without currency symbol', () => {
      expect(formatAmountSimple(100)).toBe('1.00')
      expect(formatAmountSimple(1234)).toBe('12.34')
    })

    it('should handle custom precision', () => {
      expect(formatAmountSimple(1234, 0)).toBe('12')
      expect(formatAmountSimple(1234, 1)).toBe('12.3')
    })

    it('should handle null/undefined', () => {
      expect(formatAmountSimple(null)).toBe('-')
      expect(formatAmountSimple(undefined)).toBe('-')
    })
  })

  describe('formatAmountRange', () => {
    it('should format range correctly', () => {
      expect(formatAmountRange(100, 200, 'CNY')).toBe('¥1.00 - ¥2.00')
    })

    it('should handle single value', () => {
      expect(formatAmountRange(100, 100, 'CNY')).toBe('¥1.00')
    })

    it('should handle min only', () => {
      expect(formatAmountRange(100, null, 'CNY')).toBe('≥ ¥1.00')
    })

    it('should handle max only', () => {
      expect(formatAmountRange(null, 200, 'CNY')).toBe('≤ ¥2.00')
    })

    it('should handle both null', () => {
      expect(formatAmountRange(null, null)).toBe('-')
    })
  })
})

