/**
 * 年假计算服务
 * 支持半年制(6个月)和年制(12个月)两种周期
 */

import { DrizzleD1Database } from 'drizzle-orm/d1'
import { like, eq, and, gte, lte } from 'drizzle-orm'
import { systemConfig, employeeLeaves } from '../../db/schema.js'
import * as schema from '../../db/schema.js'

export interface AnnualLeaveConfig {
  cycleMonths: number // 周期月数: 6 或 12
  daysPerCycle: number // 每周期年假天数
  overtimeMultiplier: number // 未休折算系数
}

export interface CycleInfo {
  cycleNumber: number // 当前是第几个周期 (从1开始)
  cycleStart: string // 周期开始日期 YYYY-MM-DD
  cycleEnd: string // 周期结束日期 YYYY-MM-DD
  daysInCycle: number // 周期总天数
  daysWorkedInCycle: number // 本周期已工作天数
  isFirstCycle: boolean // 是否为第一周期（无年假）
}

export interface AnnualLeaveStats {
  config: AnnualLeaveConfig
  cycle: CycleInfo
  entitledDays: number // 本周期应得年假天数
  usedDays: number // 本周期已使用天数
  remainingDays: number // 本周期剩余天数
}

export interface LeaveSettlement {
  entitledDays: number // 按比例应得年假
  usedDays: number // 已使用天数
  unusedDays: number // 未休天数 (正数=补偿, 负数=扣回)
  dailySalaryCents: number // 日薪(分)
  settlementCents: number // 结算金额(分): 正=补偿, 负=扣回
}

export class AnnualLeaveService {
  constructor(private db: DrizzleD1Database<typeof schema>) {}

  // 获取年假配置
  async getAnnualLeaveConfig(): Promise<AnnualLeaveConfig> {
    const configs = await this.db
      .select({ key: systemConfig.key, value: systemConfig.value })
      .from(systemConfig)
      .where(like(systemConfig.key, 'annual_leave%'))
      .all()

    const configMap: Record<string, string> = {}
    for (const row of configs) {
      configMap[row.key] = row.value
    }

    return {
      cycleMonths: parseInt(configMap['annual_leave_cycle_months'] || '6'),
      daysPerCycle: parseInt(configMap['annual_leave_days_per_cycle'] || '5'),
      overtimeMultiplier: parseFloat(configMap['annual_leave_overtime_multiplier'] || '1'),
    }
  }

  // 计算入职日期到指定日期的周期信息
  calculateCycleInfo(joinDate: string, targetDate: string, cycleMonths: number): CycleInfo {
    const join = new Date(joinDate)
    const target = new Date(targetDate)

    // 计算从入职到目标日期经过的完整月数
    const monthsDiff =
      (target.getFullYear() - join.getFullYear()) * 12 + (target.getMonth() - join.getMonth())

    // 计算当前所在周期序号 (从1开始)
    const cycleNumber = Math.floor(monthsDiff / cycleMonths) + 1

    // 计算本周期的开始和结束日期
    const cycleStartMonths = (cycleNumber - 1) * cycleMonths
    const cycleStart = new Date(join)
    cycleStart.setMonth(cycleStart.getMonth() + cycleStartMonths)

    const cycleEnd = new Date(cycleStart)
    cycleEnd.setMonth(cycleEnd.getMonth() + cycleMonths)
    cycleEnd.setDate(cycleEnd.getDate() - 1) // 减1天得到周期最后一天

    // 计算周期总天数
    const daysInCycle =
      Math.ceil((cycleEnd.getTime() - cycleStart.getTime()) / (1000 * 60 * 60 * 24)) + 1

    // 计算本周期已工作天数
    const effectiveTarget = target < cycleEnd ? target : cycleEnd
    const daysWorkedInCycle =
      Math.ceil((effectiveTarget.getTime() - cycleStart.getTime()) / (1000 * 60 * 60 * 24)) + 1

    return {
      cycleNumber,
      cycleStart: cycleStart.toISOString().split('T')[0],
      cycleEnd: cycleEnd.toISOString().split('T')[0],
      daysInCycle,
      daysWorkedInCycle: Math.max(0, daysWorkedInCycle),
      isFirstCycle: cycleNumber === 1,
    }
  }

  // 获取员工已使用的年假天数
  async getUsedAnnualLeaveDays(
    employeeId: string,
    cycleStart: string,
    cycleEnd: string
  ): Promise<number> {
    const result = await this.db
      .select({ usedDays: employeeLeaves.days })
      .from(employeeLeaves)
      .where(
        and(
          eq(employeeLeaves.employeeId, employeeId),
          eq(employeeLeaves.leaveType, 'annual'),
          eq(employeeLeaves.status, 'approved'),
          gte(employeeLeaves.startDate, cycleStart),
          lte(employeeLeaves.startDate, cycleEnd)
        )
      )
      .all()

    // 汇总天数
    return result.reduce((sum, row) => sum + (row.usedDays || 0), 0)
  }

  // 获取员工年假统计
  async getAnnualLeaveStats(
    employeeId: string,
    joinDate: string,
    targetDate?: string
  ): Promise<AnnualLeaveStats> {
    const config = await this.getAnnualLeaveConfig()
    const today = targetDate || new Date().toISOString().split('T')[0]
    const cycle = this.calculateCycleInfo(joinDate, today, config.cycleMonths)

    // 第一周期无年假
    const entitledDays = cycle.isFirstCycle ? 0 : config.daysPerCycle

    // 获取已使用天数
    const usedDays = await this.getUsedAnnualLeaveDays(employeeId, cycle.cycleStart, cycle.cycleEnd)

    return {
      config,
      cycle,
      entitledDays,
      usedDays,
      remainingDays: Math.max(0, entitledDays - usedDays),
    }
  }

  // 计算离职结算
  async calculateLeaveSettlement(
    employeeId: string,
    joinDate: string,
    leaveDate: string,
    dailySalaryCents: number
  ): Promise<LeaveSettlement> {
    const config = await this.getAnnualLeaveConfig()
    const cycle = this.calculateCycleInfo(joinDate, leaveDate, config.cycleMonths)

    // 第一周期无年假，无需结算
    if (cycle.isFirstCycle) {
      return {
        entitledDays: 0,
        usedDays: 0,
        unusedDays: 0,
        dailySalaryCents,
        settlementCents: 0,
      }
    }

    // 按比例计算本周期应得年假
    const proportion = cycle.daysWorkedInCycle / cycle.daysInCycle
    const entitledDays = Math.round(config.daysPerCycle * proportion * 10) / 10 // 保留1位小数

    // 获取已使用天数
    const usedDays = await this.getUsedAnnualLeaveDays(employeeId, cycle.cycleStart, cycle.cycleEnd)

    // 计算未休天数
    const unusedDays = entitledDays - usedDays

    // 计算结算金额
    const settlementCents = Math.round(unusedDays * dailySalaryCents * config.overtimeMultiplier)

    return {
      entitledDays,
      usedDays,
      unusedDays,
      dailySalaryCents,
      settlementCents,
    }
  }

  // 校验年假申请是否超额
  async validateAnnualLeaveRequest(
    employeeId: string,
    joinDate: string,
    requestDays: number
  ): Promise<{ valid: boolean; message?: string; remaining?: number }> {
    const stats = await this.getAnnualLeaveStats(employeeId, joinDate)

    if (stats.cycle.isFirstCycle) {
      return {
        valid: false,
        message: '入职第一周期内不享有年假',
        remaining: 0,
      }
    }

    if (requestDays > stats.remainingDays) {
      return {
        valid: false,
        message: `年假剩余${stats.remainingDays}天，申请${requestDays}天超出限额`,
        remaining: stats.remainingDays,
      }
    }

    return {
      valid: true,
      remaining: stats.remainingDays - requestDays,
    }
  }
}
