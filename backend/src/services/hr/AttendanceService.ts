import { DrizzleD1Database } from 'drizzle-orm/d1'
import { eq, and, desc, sql } from 'drizzle-orm'
import { attendanceRecords } from '../../db/schema.js'
import * as schema from '../../db/schema.js'
import { uuid } from '../../utils/db.js'

export class AttendanceService {
  constructor(private db: DrizzleD1Database<typeof schema>) {}

  async getTodayRecord(employeeId: string) {
    const today = new Date().toISOString().split('T')[0]

    return await this.db
      .select()
      .from(attendanceRecords)
      .where(and(eq(attendanceRecords.employeeId, employeeId), eq(attendanceRecords.date, today)))
      .get()
  }

  async getMonthlyRecords(employeeId: string, year: string, month: string) {
    const startDate = `${year}-${month}-01`
    const endDate = `${year}-${month}-31` // SQLite handles invalid dates gracefully usually, or use proper day calculation

    return await this.db
      .select()
      .from(attendanceRecords)
      .where(
        and(
          eq(attendanceRecords.employeeId, employeeId),
          sql`${attendanceRecords.date} >= ${startDate}`,
          sql`${attendanceRecords.date} <= ${endDate}`
        )
      )
      .orderBy(desc(attendanceRecords.date))
      .execute()
  }

  async clockIn(employeeId: string) {
    const today = new Date().toISOString().split('T')[0]
    const now = Date.now()

    const existing = await this.getTodayRecord(employeeId)

    if (existing?.clockInTime) {
      return { error: '今日已签到', clockInTime: existing.clockInTime }
    }

    const status = 'normal'

    if (existing) {
      await this.db
        .update(attendanceRecords)
        .set({ clockInTime: now, status, updatedAt: now })
        .where(eq(attendanceRecords.id, existing.id))
        .execute()
    } else {
      const id = uuid()
      await this.db
        .insert(attendanceRecords)
        .values({
          id,
          employeeId,
          date: today,
          clockInTime: now,
          status,
          createdAt: now,
          updatedAt: now,
        })
        .execute()
    }

    return { ok: true, clockInTime: now, status }
  }

  async clockOut(employeeId: string) {
    const today = new Date().toISOString().split('T')[0]
    const now = Date.now()

    const existing = await this.getTodayRecord(employeeId)

    if (!existing?.clockInTime) {
      return { error: '请先签到' }
    }

    if (existing.clockOutTime) {
      return { error: '今日已签退', clockOutTime: existing.clockOutTime }
    }

    const status = existing.status || 'normal'

    await this.db
      .update(attendanceRecords)
      .set({ clockOutTime: now, status, updatedAt: now })
      .where(eq(attendanceRecords.id, existing.id))
      .execute()

    return { ok: true, clockOutTime: now, status }
  }
}
