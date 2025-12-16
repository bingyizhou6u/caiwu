import { describe, it, expect } from 'vitest'
import {
  formatDate,
  formatDateTime,
  formatDateTimeFull,
  formatTime,
  formatRelativeTime,
  calculateDaysDiff,
  isBeforeToday,
  isAfterToday,
  isToday,
  getDateRange,
} from '../date'
import dayjs from 'dayjs'

describe('date utils', () => {
  describe('formatDate', () => {
    it('should format date string', () => {
      expect(formatDate('2024-01-01')).toBe('2024-01-01')
    })

    it('should format dayjs object', () => {
      expect(formatDate(dayjs('2024-01-01'))).toBe('2024-01-01')
    })

    it('should handle null/undefined', () => {
      expect(formatDate(null)).toBe('-')
      expect(formatDate(undefined)).toBe('-')
    })
  })

  describe('formatDateTime', () => {
    it('should format date time', () => {
      const result = formatDateTime('2024-01-01 12:30:00')
      expect(result).toBe('2024-01-01 12:30')
    })

    it('should handle null/undefined', () => {
      expect(formatDateTime(null)).toBe('-')
      expect(formatDateTime(undefined)).toBe('-')
    })
  })

  describe('formatDateTimeFull', () => {
    it('should format full date time', () => {
      const result = formatDateTimeFull('2024-01-01 12:30:45')
      expect(result).toBe('2024-01-01 12:30:45')
    })
  })

  describe('formatTime', () => {
    it('should format time only', () => {
      const result = formatTime('2024-01-01 12:30:00')
      expect(result).toBe('12:30')
    })
  })

  describe('formatRelativeTime', () => {
    it('should format relative time', () => {
      const yesterday = dayjs().subtract(1, 'day')
      const result = formatRelativeTime(yesterday)
      expect(result).toContain('前')
    })
  })

  describe('calculateDaysDiff', () => {
    it('should calculate days difference', () => {
      expect(calculateDaysDiff('2024-01-01', '2024-01-05')).toBe(5)
      expect(calculateDaysDiff('2024-01-01', '2024-01-01')).toBe(1)
    })

    it('should handle dayjs objects', () => {
      const start = dayjs('2024-01-01')
      const end = dayjs('2024-01-05')
      expect(calculateDaysDiff(start, end)).toBe(5)
    })
  })

  describe('isBeforeToday', () => {
    it('should check if date is before today', () => {
      const yesterday = dayjs().subtract(1, 'day')
      expect(isBeforeToday(yesterday)).toBe(true)
      
      const tomorrow = dayjs().add(1, 'day')
      expect(isBeforeToday(tomorrow)).toBe(false)
    })
  })

  describe('isAfterToday', () => {
    it('should check if date is after today', () => {
      const tomorrow = dayjs().add(1, 'day')
      expect(isAfterToday(tomorrow)).toBe(true)
      
      const yesterday = dayjs().subtract(1, 'day')
      expect(isAfterToday(yesterday)).toBe(false)
    })
  })

  describe('isToday', () => {
    it('should check if date is today', () => {
      const today = dayjs()
      expect(isToday(today)).toBe(true)
      
      const tomorrow = dayjs().add(1, 'day')
      expect(isToday(tomorrow)).toBe(false)
    })
  })

  describe('getDateRange', () => {
    it('should get date range correctly', () => {
      const range = getDateRange('2024-01-01', '2024-01-05')
      expect(range.days).toBe(5)
      expect(range.start.format('YYYY-MM-DD')).toBe('2024-01-01')
      expect(range.end.format('YYYY-MM-DD')).toBe('2024-01-05')
    })
  })
})

