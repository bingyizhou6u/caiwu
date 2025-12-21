import { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from '../../db/schema.js'
import { Errors } from '../../utils/errors.js'
import { Logger } from '../../utils/logger.js'
import type { EmployeeLeaveService } from '../hr/EmployeeLeaveService.js'
import type { ExpenseReimbursementService } from '../hr/ExpenseReimbursementService.js'
import type { AttendanceService } from '../hr/AttendanceService.js'
import type { FinanceService } from '../finance/FinanceService.js'
import type { AllowancePaymentService } from '../hr/AllowancePaymentService.js'
import type { FixedAssetService } from '../assets/FixedAssetService.js'
import type { FixedAssetAllocationService } from '../assets/FixedAssetAllocationService.js'
import type { EmployeeService } from '../hr/EmployeeService.js'
import type { AnnualLeaveService } from '../hr/AnnualLeaveService.js'
import type { SalaryService } from '../hr/SalaryService.js'

export class MyService {
  constructor(
    private db: DrizzleD1Database<typeof schema>,
    private employeeLeaveService: EmployeeLeaveService,
    private expenseReimbursementService: ExpenseReimbursementService,
    private attendanceService: AttendanceService,
    private financeService: FinanceService,
    private allowancePaymentService: AllowancePaymentService,
    private fixedAssetService: FixedAssetService,
    private fixedAssetAllocationService: FixedAssetAllocationService,
    private employeeService: EmployeeService,
    private annualLeaveService: AnnualLeaveService,
    private salaryService: SalaryService
  ) {}

  async getMyEmployeeId(userId: string): Promise<string | null> {
    // userId is assumed to be authorized and equivalent to employeeId in new architecture.
    // We verify its existence using EmployeeService.
    const employee = await this.employeeService.getById(userId)
    return employee ? employee.id : null
  }

  async getDashboardData(userId: string) {
    const employeeId = await this.getMyEmployeeId(userId)
    if (!employeeId) {
      throw Errors.NOT_FOUND('未找到员工记录')
    }

    const [empInfo, salary, pending, annualLeaveStats] = await Promise.all([
      // 员工信息
      this.employeeService.getById(employeeId),

      // 月薪
      this.salaryService.getEmployeeTotalSalary(employeeId),

      // 待报销
      this.expenseReimbursementService
        .getReimbursementStats(employeeId)
        .then(stats => stats.find(s => s.status === 'pending') || { count: 0, totalCents: 0 }),

      // 年假统计
      (async () => {
        const emp = await this.employeeService.getById(employeeId)
        if (!emp || !emp.joinDate) {return null}
        try {
          return await this.annualLeaveService.getAnnualLeaveStats(employeeId, emp.joinDate)
        } catch (e) {
          Logger.error('Failed to get annual leave stats', { error: e })
          return null
        }
      })(),
    ])

    // 最近申请 - 需要分别查再合并
    const leaves = await this.employeeLeaveService.listLeaves({ employeeId })
    const reimbursements = await this.expenseReimbursementService.listReimbursements({ employeeId })

    const recent = [
      ...leaves.map(l => ({
        id: l.id,
        type: 'leave',
        subType: l.leaveType,
        status: l.status,
        amount: `${l.days}天`,
        createdAt: l.createdAt,
      })),
      ...reimbursements.map(r => ({
        id: r.id,
        type: 'reimbursement',
        subType: r.expenseType,
        status: r.status,
        amount: `${r.amountCents}`,
        createdAt: r.createdAt,
      })),
    ]
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, 5)

    return {
      employee: {
        id: empInfo?.id,
        name: empInfo?.name,
        email: empInfo?.email,
        position: empInfo?.positionName,
        department: empInfo?.departmentName,
        orgDepartment: empInfo?.orgDepartmentName,
      },
      stats: {
        salary: salary || [],
        annualLeave: annualLeaveStats
          ? {
              cycleMonths: annualLeaveStats.config.cycleMonths,
              cycleNumber: annualLeaveStats.cycle.cycleNumber,
              cycleStart: annualLeaveStats.cycle.cycleStart,
              cycleEnd: annualLeaveStats.cycle.cycleEnd,
              isFirstCycle: annualLeaveStats.cycle.isFirstCycle,
              total: annualLeaveStats.entitledDays,
              used: annualLeaveStats.usedDays,
              remaining: annualLeaveStats.remainingDays,
            }
          : {
              cycleMonths: 6,
              cycleNumber: 1,
              cycleStart: null,
              cycleEnd: null,
              isFirstCycle: true,
              total: 0,
              used: 0,
              remaining: 0,
            },
        pendingReimbursementCents: pending.totalCents || 0,
      },
      recentApplications: recent || [],
    }
  }

  async getLeaves(userId: string, year: string, status?: string) {
    const employeeId = await this.getMyEmployeeId(userId)
    if (!employeeId) {
      throw Errors.NOT_FOUND('未找到员工记录')
    }

    const leaves = await this.employeeLeaveService.getLeavesWithApprover({
      employeeId,
      year,
      status,
    })
    const leaveStats = await this.employeeLeaveService.getLeaveStats(employeeId, year)

    return {
      leaves: leaves.map(l => ({ ...l.leave, approvedByName: l.approvedByName })),
      stats: leaveStats,
    }
  }

  async createLeave(userId: string, data: any) {
    const employeeId = await this.getMyEmployeeId(userId)
    if (!employeeId) {
      throw Errors.NOT_FOUND('未找到员工记录')
    }

    const result = await this.employeeLeaveService.createLeave({
      ...data,
      employeeId,
      createdBy: userId,
    })

    return { ok: true, id: result.id }
  }

  async getReimbursements(userId: string, status?: string) {
    const employeeId = await this.getMyEmployeeId(userId)
    if (!employeeId) {
      throw Errors.NOT_FOUND('未找到员工记录')
    }

    const reimbursements = await this.expenseReimbursementService.getReimbursementsWithApprover({
      employeeId,
      status,
    })
    const stats = await this.expenseReimbursementService.getReimbursementStats(employeeId)

    return {
      reimbursements: reimbursements.map(r => ({
        ...r.reimbursement,
        approvedByName: r.approvedByName,
      })),
      stats,
    }
  }

  async createReimbursement(userId: string, data: any) {
    const employeeId = await this.getMyEmployeeId(userId)
    if (!employeeId) {
      throw Errors.NOT_FOUND('未找到员工记录')
    }

    const result = await this.expenseReimbursementService.createReimbursement({
      ...data,
      employeeId,
      createdBy: userId,
    })

    return { ok: true, id: result.id }
  }

  async getAllowances(userId: string, year: string) {
    const employeeId = await this.getMyEmployeeId(userId)
    if (!employeeId) {
      throw Errors.NOT_FOUND('未找到员工记录')
    }

    return await this.allowancePaymentService.getEmployeeYearlyStats(employeeId, parseInt(year))
  }

  async getAssets(userId: string) {
    const employeeId = await this.getMyEmployeeId(userId)
    if (!employeeId) {
      throw Errors.NOT_FOUND('未找到员工记录')
    }

    const allAllocations = await this.fixedAssetAllocationService.listAllocations({ employeeId })

    // Filter into current and returned
    const current = allAllocations
      .filter(a => !a.allocation.returnDate)
      .map(a => ({
        ...a.allocation,
        assetName: a.assetName,
        assetCode: a.assetCode,
      }))

    const returned = allAllocations
      .filter(a => a.allocation.returnDate)
      .map(a => ({
        ...a.allocation,
        assetName: a.assetName,
        assetCode: a.assetCode,
      }))

    return { current, returned }
  }

  async getProfile(userId: string) {
    // userId should be employeeId in new architecture
    const employeeId = userId
    const profile = await this.employeeService.getById(employeeId)
    if (!profile) {return null}

    return {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      phone: profile.phone,
      position: profile.positionName,
      positionCode: profile.positionCode,
      department: profile.departmentName,
      orgDepartment: profile.orgDepartmentName,
      entryDate: profile.joinDate,
      emergencyContact: profile.emergencyContact,
      emergencyPhone: profile.emergencyPhone,
      status: profile.status,
    }
  }

  async updateProfile(userId: string, data: any) {
    const employeeId = userId
    await this.employeeService.update(employeeId, {
      phone: data.phone,
      emergencyContact: data.emergencyContact,
      emergencyPhone: data.emergencyPhone,
    })

    return { ok: true }
  }

  async getAttendanceToday(userId: string) {
    const employeeId = await this.getMyEmployeeId(userId)
    if (!employeeId) {
      throw Errors.NOT_FOUND('未找到员工记录')
    }

    const today = new Date().toISOString().split('T')[0]
    const record = await this.attendanceService.getTodayRecord(employeeId)

    return {
      today,
      record: record
        ? {
            id: record.id,
            date: record.date,
            clockInTime: record.clockInTime,
            clockOutTime: record.clockOutTime,
            clockInLocation: record.clockInLocation,
            clockOutLocation: record.clockOutLocation,
            status: record.status,
            memo: record.memo,
          }
        : null,
    }
  }

  async getAttendanceList(userId: string, year: string, month: string) {
    const employeeId = await this.getMyEmployeeId(userId)
    if (!employeeId) {
      throw Errors.NOT_FOUND('未找到员工记录')
    }

    const records = await this.attendanceService.getMonthlyRecords(employeeId, year, month)
    return { records }
  }

  async clockIn(userId: string) {
    const employeeId = await this.getMyEmployeeId(userId)
    if (!employeeId) {
      throw Errors.NOT_FOUND('未找到员工记录')
    }
    return await this.attendanceService.clockIn(employeeId)
  }

  async clockOut(userId: string) {
    const employeeId = await this.getMyEmployeeId(userId)
    if (!employeeId) {
      throw Errors.NOT_FOUND('未找到员工记录')
    }
    return await this.attendanceService.clockOut(employeeId)
  }
}
