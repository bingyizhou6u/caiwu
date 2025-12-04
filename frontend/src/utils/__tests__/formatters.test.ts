import { formatAmount, formatDate, formatPercent, formatNumber } from '../formatters'
import { describe, it, expect } from 'vitest'

describe('formatters', () => {
    describe('formatAmount', () => {
        it('should format cents to amount string', () => {
            expect(formatAmount(100)).toBe('1.00')
            expect(formatAmount(1234)).toBe('12.34')
            expect(formatAmount(0)).toBe('0.00')
        })

        it('should handle null or undefined', () => {
            expect(formatAmount(null)).toBe('-')
            expect(formatAmount(undefined)).toBe('-')
        })
    })

    describe('formatDate', () => {
        it('should return date string', () => {
            expect(formatDate('2023-01-01')).toBe('2023-01-01')
        })

        it('should handle null or undefined', () => {
            expect(formatDate(null)).toBe('-')
            expect(formatDate(undefined)).toBe('-')
            expect(formatDate('')).toBe('-')
        })
    })

    describe('formatPercent', () => {
        it('should format number to percentage string', () => {
            expect(formatPercent(0.1234)).toBe('12.34%')
            expect(formatPercent(1)).toBe('100.00%')
            expect(formatPercent(0)).toBe('0.00%')
        })

        it('should handle custom decimals', () => {
            expect(formatPercent(0.1234, 1)).toBe('12.3%')
            expect(formatPercent(0.1234, 0)).toBe('12%')
        })
    })

    describe('formatNumber', () => {
        it('should format number with thousands separator', () => {
            expect(formatNumber(1000)).toBe('1,000')
            expect(formatNumber(1234567.89)).toBe('1,234,567.89')
            expect(formatNumber(0)).toBe('0')
        })

        it('should handle null or undefined', () => {
            expect(formatNumber(null)).toBe('-')
            expect(formatNumber(undefined)).toBe('-')
        })
    })
})
