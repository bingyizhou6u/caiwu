import { DrizzleD1Database } from 'drizzle-orm/d1'
import { eq, and, gte, lt, lte, ne, or, like } from 'drizzle-orm'
import * as schema from '../../db/schema.js'
import { Errors } from '../../utils/errors.js'
import { Logger } from '../../utils/logger.js'
import { getBusinessDate } from '../../utils/timezone.js'
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
  ) { }

  async getMyEmployeeId(userId: string): Promise<string | null> {
    // userId is assumed to be authorized and equivalent to employeeId in new architecture.
    // We verify its existence using EmployeeService.
    const employee = await this.employeeService.getById(userId)
    return employee ? employee.id : null
  }

  async getDashboardData(userId: string) {
    // 假设 userId 即为 employeeId (或通过 getById 验证)
    const employeeId = userId

    // 并行获取所有数据
    const [empInfo, salary, pending, annualLeaveStats, leaves, reimbursements] = await Promise.all([
      // 1. 员工信息 (这也验证了用户是否存在)
      this.employeeService.getById(employeeId),

      // 2. 月薪
      this.salaryService.getEmployeeTotalSalary(employeeId),

      // 3. 待报销
      this.expenseReimbursementService
        .getReimbursementStats(employeeId)
        .then(stats => stats.find(s => s.status === 'pending') || { count: 0, totalCents: 0 }),

      // 4. 年假统计
      (async () => {
        // 由于 getAnnualLeaveStats 需要 joinDate，虽然我们可以在下面获取到 empInfo
        // 但为了并行，我们需要在这里先获取 joinDate。
        // 这会导致重复获取 empInfo 吗？是的。
        // 为了极致优化，我们可以稍作妥协：
        // 方案 A: 先 fetch empInfo，再 Promise.all 其他（串行 1 + N）
        // 方案 B: 并行 fetch，但在 annualLeaveStats 内部再 fetch 用于获取 joinDate (Worker 可能会缓存？不)

        // 修正：为了避免阻塞其他查询，我们单独在内部查一下（或者优化 annualLeaveService 只需要 id）
        // 这里为了简单和正确性，且 getById 可能已经被优化，我们先保留内部查询，
        // 或者我们可以分两步：Step 1 getEmpInfo, Step 2 Promise.all others.
        // Step 1 很快。
        const emp = await this.employeeService.getById(employeeId)
        if (!emp || !emp.joinDate) { return null }
        try {
          return await this.annualLeaveService.getAnnualLeaveStats(employeeId, emp.joinDate)
        } catch (e) {
          Logger.error('Failed to get annual leave stats', { error: e })
          return null
        }
      })(),

      // 5. 最近申请 (Leaves)
      this.employeeLeaveService.listLeaves({ employeeId }),

      // 6. 最近申请 (Reimbursements)
      this.expenseReimbursementService.listReimbursements({ employeeId }),
    ])

    if (!empInfo) {
      throw Errors.NOT_FOUND('未找到员工记录')
    }

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
    if (!profile) { return null }

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

    const today = getBusinessDate()
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

  /**
   * 获取日历事件
   * @param userId 用户ID
   * @param month 月份 (YYYY-MM 格式)
   */
  async getCalendarEvents(userId: string, month: string) {
    const employeeId = await this.getMyEmployeeId(userId)
    if (!employeeId) {
      throw Errors.NOT_FOUND('未找到员工记录')
    }

    // 解析月份范围
    const [year, mon] = month.split('-').map(Number)
    const startDate = `${year}-${String(mon).padStart(2, '0')}-01`
    const endDate = mon === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(mon + 1).padStart(2, '0')}-01`

    const events: Array<{
      date: string
      type: 'task' | 'leave' | 'reminder' | 'personal'
      title: string
      color: string
      meta?: Record<string, any>
    }> = []

    // 1. 查询任务截止日期
    const taskList = await this.db
      .select({
        id: schema.tasks.id,
        code: schema.tasks.code,
        title: schema.tasks.title,
        dueDate: schema.tasks.dueDate,
        priority: schema.tasks.priority,
        status: schema.tasks.status,
      })
      .from(schema.tasks)
      .where(
        and(
          like(schema.tasks.assigneeIds, `%"${employeeId}"%`),
          gte(schema.tasks.dueDate, startDate),
          lt(schema.tasks.dueDate, endDate),
          ne(schema.tasks.status, 'completed')
        )
      )

    for (const task of taskList) {
      if (task.dueDate) {
        const priorityColors: Record<string, string> = {
          high: '#ff4d4f',
          medium: '#faad14',
          low: '#52c41a',
        }
        events.push({
          date: task.dueDate,
          type: 'task',
          title: `[${task.code}] ${task.title}`,
          color: priorityColors[task.priority || 'medium'] || '#1890ff',
          meta: { taskId: task.id, priority: task.priority, status: task.status },
        })
      }
    }

    // 2. 查询请假记录
    const leaves = await this.db
      .select({
        id: schema.employeeLeaves.id,
        leaveType: schema.employeeLeaves.leaveType,
        startDate: schema.employeeLeaves.startDate,
        endDate: schema.employeeLeaves.endDate,
        status: schema.employeeLeaves.status,
        days: schema.employeeLeaves.days,
      })
      .from(schema.employeeLeaves)
      .where(
        and(
          eq(schema.employeeLeaves.employeeId, employeeId),
          or(
            and(gte(schema.employeeLeaves.startDate, startDate), lt(schema.employeeLeaves.startDate, endDate)),
            and(gte(schema.employeeLeaves.endDate, startDate), lt(schema.employeeLeaves.endDate, endDate)),
            and(lte(schema.employeeLeaves.startDate, startDate), gte(schema.employeeLeaves.endDate, endDate))
          )
        )
      )

    const leaveTypeLabels: Record<string, string> = {
      annual: '年假',
      sick: '病假',
      personal: '事假',
      other: '其他',
    }

    for (const leave of leaves) {
      // 生成请假期间的每一天事件
      const start = new Date(leave.startDate)
      const end = new Date(leave.endDate)
      const monthStart = new Date(startDate)
      const monthEnd = new Date(endDate)

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        if (d >= monthStart && d < monthEnd) {
          const dateStr = d.toISOString().split('T')[0]
          events.push({
            date: dateStr,
            type: 'leave',
            title: `${leaveTypeLabels[leave.leaveType] || leave.leaveType}`,
            color: leave.status === 'approved' ? '#722ed1' : '#d9d9d9',
            meta: { leaveId: leave.id, status: leave.status, days: leave.days },
          })
        }
      }
    }

    // 3. 查询特殊提醒（入职周年）
    const employee = await this.employeeService.getById(employeeId)
    if (employee) {
      // 入职周年提醒
      if (employee.joinDate) {
        const joinMonth = employee.joinDate.substring(5, 7)
        const joinDay = employee.joinDate.substring(8, 10)
        const anniversaryDate = `${year}-${joinMonth}-${joinDay}`

        if (anniversaryDate >= startDate && anniversaryDate < endDate) {
          const joinYear = parseInt(employee.joinDate.substring(0, 4))
          const years = year - joinYear
          if (years > 0) {
            events.push({
              date: anniversaryDate,
              type: 'reminder',
              title: `入职${years}周年`,
              color: '#faad14',
              meta: { reminderType: 'anniversary', years },
            })
          }
        }
      }
    }

    // 4. 查询个人自定义事件
    const personalEvents = await this.db
      .select()
      .from(schema.personalCalendarEvents)
      .where(
        and(
          eq(schema.personalCalendarEvents.employeeId, employeeId),
          or(
            and(gte(schema.personalCalendarEvents.startTime, new Date(startDate).getTime()), lt(schema.personalCalendarEvents.startTime, new Date(endDate).getTime())),
            and(gte(schema.personalCalendarEvents.endTime, new Date(startDate).getTime()), lt(schema.personalCalendarEvents.endTime, new Date(endDate).getTime()))
          )
        )
      )

    for (const evt of personalEvents) {
      const dateStr = new Date(evt.startTime).toISOString().split('T')[0]
      events.push({
        date: dateStr,
        type: 'personal',
        title: evt.title,
        color: evt.color || '#13c2c2',
        meta: {
          id: evt.id,
          description: evt.description,
          startTime: evt.startTime,
          endTime: evt.endTime,
          isAllDay: evt.isAllDay
        },
      })
    }

    return { events }
  }

  // 4. 个人日历事件 CRUD

  async createPersonalEvent(userId: string, data: { title: string, description?: string, startTime: number, endTime: number, isAllDay?: number, color?: string }) {
    const employeeId = await this.getMyEmployeeId(userId)
    if (!employeeId) {
      throw Errors.NOT_FOUND('未找到员工记录')
    }

    const id = crypto.randomUUID()
    const now = Date.now()

    await this.db.insert(schema.personalCalendarEvents).values({
      id,
      employeeId,
      title: data.title,
      description: data.description,
      startTime: data.startTime,
      endTime: data.endTime,
      isAllDay: data.isAllDay || 0,
      color: data.color,
      createdAt: now,
      updatedAt: now,
    })

    return { id, ok: true }
  }

  async updatePersonalEvent(userId: string, eventId: string, data: { title?: string, description?: string, startTime?: number, endTime?: number, isAllDay?: number, color?: string }) {
    const employeeId = await this.getMyEmployeeId(userId)
    if (!employeeId) {
      throw Errors.NOT_FOUND('未找到员工记录')
    }

    const event = await this.db.select().from(schema.personalCalendarEvents).where(eq(schema.personalCalendarEvents.id, eventId)).get()
    if (!event) {
      throw Errors.NOT_FOUND('事件不存在')
    }
    if (event.employeeId !== employeeId) {
      throw Errors.FORBIDDEN('无权操作此事件')
    }

    await this.db.update(schema.personalCalendarEvents)
      .set({
        ...data,
        updatedAt: Date.now(),
      })
      .where(eq(schema.personalCalendarEvents.id, eventId))

    return { ok: true }
  }

  async deletePersonalEvent(userId: string, eventId: string) {
    const employeeId = await this.getMyEmployeeId(userId)
    if (!employeeId) {
      throw Errors.NOT_FOUND('未找到员工记录')
    }

    const event = await this.db.select().from(schema.personalCalendarEvents).where(eq(schema.personalCalendarEvents.id, eventId)).get()
    if (!event) {
      throw Errors.NOT_FOUND('事件不存在')
    }
    if (event.employeeId !== employeeId) {
      throw Errors.FORBIDDEN('无权操作此事件')
    }

    await this.db.delete(schema.personalCalendarEvents).where(eq(schema.personalCalendarEvents.id, eventId))
    return { ok: true }
  }
}
