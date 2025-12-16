/**
 * 日期格式化工具函数
 * 统一处理日期的显示和转换
 */

import dayjs, { Dayjs } from 'dayjs'

/**
 * 格式化日期为 YYYY-MM-DD
 */
export function formatDate(
  date: string | number | Dayjs | Date | null | undefined
): string {
  if (!date) return '-'
  return dayjs(date).format('YYYY-MM-DD')
}

/**
 * 格式化日期时间为 YYYY-MM-DD HH:mm
 */
export function formatDateTime(
  date: string | number | Dayjs | Date | null | undefined
): string {
  if (!date) return '-'
  return dayjs(date).format('YYYY-MM-DD HH:mm')
}

/**
 * 格式化日期时间为 YYYY-MM-DD HH:mm:ss
 */
export function formatDateTimeFull(
  date: string | number | Dayjs | Date | null | undefined
): string {
  if (!date) return '-'
  return dayjs(date).format('YYYY-MM-DD HH:mm:ss')
}

/**
 * 格式化时间 HH:mm
 */
export function formatTime(
  date: string | number | Dayjs | Date | null | undefined
): string {
  if (!date) return '-'
  return dayjs(date).format('HH:mm')
}

/**
 * 计算日期差（天数）
 */
export function calculateDaysDiff(
  startDate: string | Dayjs | Date,
  endDate: string | Dayjs | Date
): number {
  return dayjs(endDate).diff(dayjs(startDate), 'day') + 1
}

/**
 * 格式化相对时间（如：3天前）
 */
export function formatRelativeTime(
  date: string | number | Dayjs | Date | null | undefined
): string {
  if (!date) return '-'
  return dayjs(date).fromNow()
}

/**
 * 检查日期是否在今天之前
 */
export function isBeforeToday(date: string | Dayjs | Date): boolean {
  return dayjs(date).isBefore(dayjs(), 'day')
}

/**
 * 检查日期是否在今天之后
 */
export function isAfterToday(date: string | Dayjs | Date): boolean {
  return dayjs(date).isAfter(dayjs(), 'day')
}

/**
 * 检查日期是否在今天
 */
export function isToday(date: string | Dayjs | Date): boolean {
  return dayjs(date).isSame(dayjs(), 'day')
}

/**
 * 获取日期范围
 */
export function getDateRange(
  start: string | Dayjs | Date,
  end: string | Dayjs | Date
): { start: Dayjs; end: Dayjs; days: number } {
  const startDate = dayjs(start)
  const endDate = dayjs(end)
  return {
    start: startDate,
    end: endDate,
    days: calculateDaysDiff(startDate, endDate),
  }
}

