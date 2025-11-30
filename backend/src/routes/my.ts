/**
 * 个人中心路由 - 修复版本
 */

import { Hono } from 'hono'
import type { Env, AppVariables } from '../types.js'
import { Errors } from '../utils/errors.js'
import { logAuditAction } from '../utils/audit.js'
import { uuid } from '../utils/db.js'
import { validateJson, getValidatedData } from '../utils/validator.js'
import { z } from 'zod'
import { getAnnualLeaveStats } from '../services/AnnualLeaveService.js'

export const myRoutes = new Hono<{ Bindings: Env, Variables: AppVariables }>()

// 获取当前用户的员工ID
async function getMyEmployeeId(c: any): Promise<string | null> {
  const userId = c.get('userId')
  if (!userId) return null
  
  const user = await c.env.DB.prepare('SELECT email FROM users WHERE id = ?').bind(userId).first() as { email: string } | null
  if (!user?.email) return null
  
  const emp = await c.env.DB.prepare('SELECT id FROM employees WHERE email = ? AND active = 1').bind(user.email).first() as { id: string } | null
  return emp?.id || null
}

// 获取员工完整信息
async function getMyEmployeeInfo(c: any): Promise<{ id: string, join_date: string } | null> {
  const userId = c.get('userId')
  if (!userId) return null
  
  const user = await c.env.DB.prepare('SELECT email FROM users WHERE id = ?').bind(userId).first() as { email: string } | null
  if (!user?.email) return null
  
  const emp = await c.env.DB.prepare('SELECT id, join_date FROM employees WHERE email = ? AND active = 1').bind(user.email).first() as { id: string, join_date: string } | null
  return emp
}

// ==================== 个人仪表盘 ====================

myRoutes.get('/my/dashboard', async (c) => {
  const userId = c.get('userId')
  if (!userId) throw Errors.UNAUTHORIZED()
  
  // 优化：合并部分查询，减少数据库往返次数
  const empInfo = await getMyEmployeeInfo(c)
  if (!empInfo) throw Errors.NOT_FOUND('未找到员工记录')
  
  const employeeId = empInfo.id
  
  // 优化：并行执行所有数据库查询
  const [
    employee,
    salary,
    pending,
    borrowing,
    recent,
    annualLeaveStats
  ] = await Promise.all([
    // 获取员工基本信息 (name 已在 employees 表中)
    c.env.DB.prepare(`
      SELECT e.*, e.email, p.name as position_name, 
             d.name as department_name, od.name as org_department_name
      FROM employees e
      LEFT JOIN positions p ON p.id = e.position_id
      LEFT JOIN departments d ON d.id = e.department_id
      LEFT JOIN org_departments od ON od.id = e.org_department_id
      WHERE e.id = ?
    `).bind(employeeId).first() as Promise<any>,
    
    // 获取本月薪资
    c.env.DB.prepare(`
      SELECT SUM(amount_cents) as total_cents, currency_id
      FROM employee_salaries WHERE employee_id = ?
      GROUP BY currency_id
    `).bind(employeeId).all() as Promise<D1Result<{ total_cents: number, currency_id: string }>>,
    
    // 待报销金额
    c.env.DB.prepare(`
      SELECT COALESCE(SUM(amount_cents), 0) as pending_cents
      FROM expense_reimbursements
      WHERE employee_id = ? AND status IN ('pending', 'approved')
    `).bind(employeeId).first() as Promise<{ pending_cents: number } | null>,
    
    // 借支余额（优化子查询为JOIN）
    c.env.DB.prepare(`
      SELECT 
        COALESCE(SUM(b.amount_cents), 0) as borrowed_cents,
        COALESCE(SUM(r.amount_cents), 0) as repaid_cents
      FROM borrowings b
      LEFT JOIN repayments r ON r.borrowing_id = b.id
      WHERE b.user_id = ?
    `).bind(userId).first() as Promise<{ borrowed_cents: number, repaid_cents: number } | null>,
    
    // 最近申请
    c.env.DB.prepare(`
      SELECT * FROM (
        SELECT id, 'leave' as type, leave_type as sub_type, status, days || '天' as amount, created_at
        FROM employee_leaves WHERE employee_id = ?
        UNION ALL
        SELECT id, 'reimbursement' as type, expense_type as sub_type, status, amount_cents as amount, created_at
        FROM expense_reimbursements WHERE employee_id = ?
      ) ORDER BY created_at DESC LIMIT 5
    `).bind(employeeId, employeeId).all() as Promise<D1Result<any>>,
    
    // 年假统计（捕获错误以避免阻塞）
    (async () => {
      if (!empInfo.join_date) return null
      try {
        return await getAnnualLeaveStats(c.env.DB, employeeId, empInfo.join_date)
      } catch (e) {
        console.error('Failed to get annual leave stats:', e)
        return null
      }
    })()
  ])
  
  const balance_cents = (borrowing?.borrowed_cents || 0) - (borrowing?.repaid_cents || 0)
  
  return c.json({
    employee: {
      id: employee?.id,
      name: employee?.name,
      email: employee?.email,
      position: employee?.position_name,
      department: employee?.department_name,
      orgDepartment: employee?.org_department_name,
    },
    stats: {
      salary: salary.results || [],
      annualLeave: annualLeaveStats ? {
        cycleMonths: annualLeaveStats.config.cycleMonths,
        cycleNumber: annualLeaveStats.cycle.cycleNumber,
        cycleStart: annualLeaveStats.cycle.cycleStart,
        cycleEnd: annualLeaveStats.cycle.cycleEnd,
        isFirstCycle: annualLeaveStats.cycle.isFirstCycle,
        total: annualLeaveStats.entitledDays,
        used: annualLeaveStats.usedDays,
        remaining: annualLeaveStats.remainingDays,
      } : { cycleMonths: 6, cycleNumber: 1, cycleStart: null, cycleEnd: null, isFirstCycle: true, total: 0, used: 0, remaining: 0 },
      pendingReimbursementCents: pending?.pending_cents || 0,
      borrowingBalanceCents: balance_cents,
    },
    recentApplications: recent.results || [],
  })
})

// ==================== 我的请假 ====================

myRoutes.get('/my/leaves', async (c) => {
  const userId = c.get('userId')
  if (!userId) throw Errors.UNAUTHORIZED()
  
  const employeeId = await getMyEmployeeId(c)
  if (!employeeId) throw Errors.NOT_FOUND('未找到员工记录')
  
  const status = c.req.query('status')
  const year = c.req.query('year') || new Date().getFullYear().toString()
  
  let sql = `SELECT el.*, ae.name as approved_by_name FROM employee_leaves el LEFT JOIN users u ON u.id = el.approved_by LEFT JOIN employees ae ON ae.email = u.email WHERE el.employee_id = ? AND strftime('%Y', el.start_date) = ?`
  const binds: any[] = [employeeId, year]
  if (status) { sql += ' AND el.status = ?'; binds.push(status) }
  sql += ' ORDER BY el.created_at DESC'
  
  const leaves = await c.env.DB.prepare(sql).bind(...binds).all() as D1Result<any>
  const leaveStats = await c.env.DB.prepare(`
    SELECT leave_type, COALESCE(SUM(days), 0) as used_days
    FROM employee_leaves WHERE employee_id = ? AND status = 'approved' AND strftime('%Y', start_date) = ?
    GROUP BY leave_type
  `).bind(employeeId, year).all() as D1Result<{ leave_type: string, used_days: number }>
  
  return c.json({ leaves: leaves.results || [], stats: leaveStats.results || [] })
})

const createLeaveSchema = z.object({
  leave_type: z.enum(['annual', 'sick', 'personal', 'other']),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  days: z.number().positive(),
  reason: z.string().optional(),
})

myRoutes.post('/my/leaves', validateJson(createLeaveSchema), async (c) => {
  const userId = c.get('userId')
  if (!userId) throw Errors.UNAUTHORIZED()
  
  const employeeId = await getMyEmployeeId(c)
  if (!employeeId) throw Errors.NOT_FOUND('未找到员工记录')
  
  const body = getValidatedData<z.infer<typeof createLeaveSchema>>(c)
  const now = Date.now()
  const id = uuid()
  
  await c.env.DB.prepare(`
    INSERT INTO employee_leaves (id, employee_id, leave_type, start_date, end_date, days, reason, status, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
  `).bind(id, employeeId, body.leave_type, body.start_date, body.end_date, body.days, body.reason || null, userId, now, now).run()
  
  logAuditAction(c, 'create', 'employee_leave', id, JSON.stringify(body))
  return c.json({ ok: true, id })
})

// ==================== 我的报销 ====================

myRoutes.get('/my/reimbursements', async (c) => {
  const userId = c.get('userId')
  if (!userId) throw Errors.UNAUTHORIZED()
  
  const employeeId = await getMyEmployeeId(c)
  if (!employeeId) throw Errors.NOT_FOUND('未找到员工记录')
  
  const status = c.req.query('status')
  // 移除对 c.symbol 的引用
  let sql = `SELECT er.*, ae.name as approved_by_name FROM expense_reimbursements er LEFT JOIN users u ON u.id = er.approved_by LEFT JOIN employees ae ON ae.email = u.email WHERE er.employee_id = ?`
  const binds: any[] = [employeeId]
  if (status) { sql += ' AND er.status = ?'; binds.push(status) }
  sql += ' ORDER BY er.created_at DESC'
  
  const reimbursements = await c.env.DB.prepare(sql).bind(...binds).all() as D1Result<any>
  const stats = await c.env.DB.prepare(`
    SELECT status, COUNT(*) as count, COALESCE(SUM(amount_cents), 0) as total_cents
    FROM expense_reimbursements WHERE employee_id = ? GROUP BY status
  `).bind(employeeId).all() as D1Result<any>
  
  return c.json({ reimbursements: reimbursements.results || [], stats: stats.results || [] })
})

const createReimbursementSchema = z.object({
  expense_type: z.enum(['travel', 'office', 'meal', 'transport', 'other']),
  amount_cents: z.number().int().positive(),
  currency_id: z.string().default('CNY'),
  expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().min(1),
  voucher_url: z.string().optional(),
})

myRoutes.post('/my/reimbursements', validateJson(createReimbursementSchema), async (c) => {
  const userId = c.get('userId')
  if (!userId) throw Errors.UNAUTHORIZED()
  
  const employeeId = await getMyEmployeeId(c)
  if (!employeeId) throw Errors.NOT_FOUND('未找到员工记录')
  
  const body = getValidatedData<z.infer<typeof createReimbursementSchema>>(c)
  const now = Date.now()
  const id = uuid()
  
  await c.env.DB.prepare(`
    INSERT INTO expense_reimbursements (id, employee_id, expense_type, amount_cents, currency_id, expense_date, description, voucher_url, status, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
  `).bind(id, employeeId, body.expense_type, body.amount_cents, body.currency_id, body.expense_date, body.description, body.voucher_url || null, userId, now, now).run()
  
  logAuditAction(c, 'create', 'expense_reimbursement', id, JSON.stringify(body))
  return c.json({ ok: true, id })
})

// ==================== 我的借支 ====================

myRoutes.get('/my/borrowings', async (c) => {
  const userId = c.get('userId')
  if (!userId) throw Errors.UNAUTHORIZED()
  
  // 移除对 c.symbol 的引用
  const borrowings = await c.env.DB.prepare(`
    SELECT b.*, a.name as account_name,
           (SELECT COALESCE(SUM(amount_cents), 0) FROM repayments WHERE borrowing_id = b.id) as repaid_cents
    FROM borrowings b
    LEFT JOIN accounts a ON a.id = b.account_id
    WHERE b.user_id = ?
    ORDER BY b.created_at DESC
  `).bind(userId).all() as D1Result<any>
  
  const stats = await c.env.DB.prepare(`
    SELECT 
      COALESCE(SUM(b.amount_cents), 0) as total_borrowed_cents,
      COALESCE((SELECT SUM(r.amount_cents) FROM repayments r WHERE r.borrowing_id IN (SELECT id FROM borrowings WHERE user_id = ?)), 0) as total_repaid_cents
    FROM borrowings b WHERE b.user_id = ?
  `).bind(userId, userId).first() as { total_borrowed_cents: number, total_repaid_cents: number } | null
  
  return c.json({
    borrowings: borrowings.results || [],
    stats: {
      totalBorrowedCents: stats?.total_borrowed_cents || 0,
      totalRepaidCents: stats?.total_repaid_cents || 0,
      balanceCents: (stats?.total_borrowed_cents || 0) - (stats?.total_repaid_cents || 0),
    },
  })
})

const createBorrowingSchema = z.object({
  amount_cents: z.number().int().positive(),
  currency: z.string().default('CNY'),
  memo: z.string().optional(),
})

myRoutes.post('/my/borrowings', validateJson(createBorrowingSchema), async (c) => {
  const userId = c.get('userId')
  if (!userId) throw Errors.UNAUTHORIZED()
  
  const body = getValidatedData<z.infer<typeof createBorrowingSchema>>(c)
  const now = Date.now()
  const id = uuid()
  const today = new Date().toISOString().split('T')[0]
  
  let borrower = await c.env.DB.prepare('SELECT id FROM borrowers WHERE user_id = ?').bind(userId).first() as { id: string } | null
  if (!borrower) {
    const user = await c.env.DB.prepare('SELECT name FROM users WHERE id = ?').bind(userId).first() as { name: string } | null
    const borrowerId = uuid()
    await c.env.DB.prepare('INSERT INTO borrowers (id, name, user_id, active) VALUES (?, ?, ?, 1)').bind(borrowerId, user?.name || '未知', userId).run()
    borrower = { id: borrowerId }
  }
  
  await c.env.DB.prepare(`
    INSERT INTO borrowings (id, borrower_id, user_id, amount_cents, currency, borrow_date, memo, status, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
  `).bind(id, borrower.id, userId, body.amount_cents, body.currency, today, body.memo || null, userId, now).run()
  
  logAuditAction(c, 'create', 'borrowing', id, JSON.stringify(body))
  return c.json({ ok: true, id })
})

// ==================== 我的津贴 ====================

myRoutes.get('/my/allowances', async (c) => {
  const userId = c.get('userId')
  if (!userId) throw Errors.UNAUTHORIZED()
  
  const employeeId = await getMyEmployeeId(c)
  if (!employeeId) throw Errors.NOT_FOUND('未找到员工记录')
  
  const year = c.req.query('year') || new Date().getFullYear().toString()
  
  const allowances = await c.env.DB.prepare(`
    SELECT ap.* FROM allowance_payments ap
    WHERE ap.employee_id = ? AND ap.year = ?
    ORDER BY ap.year DESC, ap.month DESC, ap.allowance_type
  `).bind(employeeId, parseInt(year)).all() as D1Result<any>
  
  const monthlyStats = await c.env.DB.prepare(`
    SELECT year, month, COALESCE(SUM(amount_cents), 0) as total_cents
    FROM allowance_payments WHERE employee_id = ? AND year = ?
    GROUP BY year, month ORDER BY month DESC
  `).bind(employeeId, parseInt(year)).all() as D1Result<any>
  
  return c.json({ allowances: allowances.results || [], monthlyStats: monthlyStats.results || [] })
})

// ==================== 我的资产 ====================

myRoutes.get('/my/assets', async (c) => {
  const userId = c.get('userId')
  if (!userId) throw Errors.UNAUTHORIZED()
  
  const employeeId = await getMyEmployeeId(c)
  if (!employeeId) throw Errors.NOT_FOUND('未找到员工记录')
  
  // 移除对 fa.specification, fa.brand, fa.model, fa.original_value_cents 的引用
  const assets = await c.env.DB.prepare(`
    SELECT faa.*, fa.name as asset_name, fa.asset_code, fa.purchase_price_cents
    FROM fixed_asset_allocations faa
    LEFT JOIN fixed_assets fa ON fa.id = faa.asset_id
    WHERE faa.employee_id = ?
    ORDER BY faa.allocation_date DESC
  `).bind(employeeId).all() as D1Result<any>
  
  const current = (assets.results || []).filter((a: any) => !a.return_date)
  const returned = (assets.results || []).filter((a: any) => a.return_date)
  
  return c.json({ current, returned })
})

// ==================== 个人信息 ====================

myRoutes.get('/my/profile', async (c) => {
  const userId = c.get('userId')
  if (!userId) throw Errors.UNAUTHORIZED()
  
  const employeeId = await getMyEmployeeId(c)
  if (!employeeId) throw Errors.NOT_FOUND('未找到员工记录')
  
  const profile = await c.env.DB.prepare(`
    SELECT e.*, e.email, p.name as position_name, p.code as position_code,
           d.name as department_name, od.name as org_department_name
    FROM employees e
    LEFT JOIN positions p ON p.id = e.position_id
    LEFT JOIN departments d ON d.id = e.department_id
    LEFT JOIN org_departments od ON od.id = e.org_department_id
    WHERE e.id = ?
  `).bind(employeeId).first() as any | null
  
  let workSchedule = null
  if (profile?.work_schedule) {
    try { workSchedule = typeof profile.work_schedule === 'string' ? JSON.parse(profile.work_schedule) : profile.work_schedule } catch (e) {}
  }

  return c.json({
    id: profile?.id, userId: profile?.user_id, name: profile?.name, email: profile?.email, phone: profile?.phone,
    idCard: profile?.id_card ? '****' + profile.id_card.slice(-4) : null,
    bankAccount: profile?.bank_account ? '****' + profile.bank_account.slice(-4) : null,
    bankName: profile?.bank_name, position: profile?.position_name, positionCode: profile?.position_code,
    department: profile?.department_name, orgDepartment: profile?.org_department_name,
    entryDate: profile?.join_date, contractEndDate: profile?.contract_end_date,
    emergencyContact: profile?.emergency_contact, emergencyPhone: profile?.emergency_phone,
    status: profile?.status, workSchedule: workSchedule,
    annualLeaveCycleMonths: profile?.annual_leave_cycle_months, annualLeaveDays: profile?.annual_leave_days,
    probationSalaryCents: profile?.probation_salary_cents, regularSalaryCents: profile?.regular_salary_cents,
    livingAllowanceCents: profile?.living_allowance_cents, housingAllowanceCents: profile?.housing_allowance_cents,
    transportationAllowanceCents: profile?.transportation_allowance_cents, mealAllowanceCents: profile?.meal_allowance_cents,
  })
})

const updateProfileSchema = z.object({
  phone: z.string().optional(),
  emergency_contact: z.string().optional(),
  emergency_phone: z.string().optional(),
})

myRoutes.put('/my/profile', validateJson(updateProfileSchema), async (c) => {
  const userId = c.get('userId')
  if (!userId) throw Errors.UNAUTHORIZED()
  
  const employeeId = await getMyEmployeeId(c)
  if (!employeeId) throw Errors.NOT_FOUND('未找到员工记录')
  
  const body = getValidatedData<z.infer<typeof updateProfileSchema>>(c)
  const now = Date.now()
  
  const updates: string[] = []
  const binds: any[] = []
  if (body.phone !== undefined) { updates.push('phone = ?'); binds.push(body.phone) }
  if (body.emergency_contact !== undefined) { updates.push('emergency_contact = ?'); binds.push(body.emergency_contact) }
  if (body.emergency_phone !== undefined) { updates.push('emergency_phone = ?'); binds.push(body.emergency_phone) }
  
  if (updates.length === 0) return c.json({ ok: true, message: '无更新' })
  
  updates.push('updated_at = ?')
  binds.push(now, employeeId)
  
  await c.env.DB.prepare(`UPDATE employees SET ${updates.join(', ')} WHERE id = ?`).bind(...binds).run()
  logAuditAction(c, 'update', 'my_profile', employeeId, JSON.stringify(body))
  return c.json({ ok: true })
})

// ==================== 打卡功能 ====================

// 获取今日打卡记录
myRoutes.get('/my/attendance/today', async (c) => {
  const userId = c.get('userId')
  if (!userId) throw Errors.UNAUTHORIZED()
  
  const employeeId = await getMyEmployeeId(c)
  if (!employeeId) throw Errors.NOT_FOUND('未找到员工记录')
  
  const today = new Date().toISOString().split('T')[0]
  
  const record = await c.env.DB.prepare(`
    SELECT * FROM attendance_records WHERE employee_id = ? AND date = ?
  `).bind(employeeId, today).first() as any | null
  
  // 获取员工工作时间配置
  const employee = await c.env.DB.prepare(`
    SELECT work_schedule FROM employees WHERE id = ?
  `).bind(employeeId).first() as { work_schedule: string } | null
  
  let workSchedule = null
  if (employee?.work_schedule) {
    try {
      workSchedule = typeof employee.work_schedule === 'string' 
        ? JSON.parse(employee.work_schedule) 
        : employee.work_schedule
    } catch (e) {}
  }
  
  return c.json({
    today,
    record: record ? {
      id: record.id,
      date: record.date,
      clockInTime: record.clock_in_time,
      clockOutTime: record.clock_out_time,
      clockInLocation: record.clock_in_location,
      clockOutLocation: record.clock_out_location,
      status: record.status,
      memo: record.memo,
    } : null,
    workSchedule,
  })
})

// 获取打卡记录列表
myRoutes.get('/my/attendance', async (c) => {
  const userId = c.get('userId')
  if (!userId) throw Errors.UNAUTHORIZED()
  
  const employeeId = await getMyEmployeeId(c)
  if (!employeeId) throw Errors.NOT_FOUND('未找到员工记录')
  
  const year = c.req.query('year') || new Date().getFullYear().toString()
  const month = c.req.query('month') || (new Date().getMonth() + 1).toString().padStart(2, '0')
  
  const startDate = `${year}-${month}-01`
  const endDate = `${year}-${month}-31`
  
  const records = await c.env.DB.prepare(`
    SELECT * FROM attendance_records 
    WHERE employee_id = ? AND date >= ? AND date <= ?
    ORDER BY date DESC
  `).bind(employeeId, startDate, endDate).all() as D1Result<any>
  
  return c.json({
    records: records.results || [],
  })
})

// 签到
myRoutes.post('/my/attendance/clock-in', async (c) => {
  const userId = c.get('userId')
  if (!userId) throw Errors.UNAUTHORIZED()
  
  const employeeId = await getMyEmployeeId(c)
  if (!employeeId) throw Errors.NOT_FOUND('未找到员工记录')
  
  const today = new Date().toISOString().split('T')[0]
  const now = Date.now()
  
  // 检查是否已签到
  const existing = await c.env.DB.prepare(`
    SELECT id, clock_in_time FROM attendance_records WHERE employee_id = ? AND date = ?
  `).bind(employeeId, today).first() as { id: string, clock_in_time: number } | null
  
  if (existing?.clock_in_time) {
    return c.json({ error: '今日已签到', clockInTime: existing.clock_in_time }, 400)
  }
  
  // 获取员工工作时间配置，判断是否迟到
  const employee = await c.env.DB.prepare(`
    SELECT work_schedule FROM employees WHERE id = ?
  `).bind(employeeId).first() as { work_schedule: string } | null
  
  let status = 'normal'
  if (employee?.work_schedule) {
    try {
      const schedule = typeof employee.work_schedule === 'string' 
        ? JSON.parse(employee.work_schedule) 
        : employee.work_schedule
      
      if (schedule?.start) {
        const [startHour, startMin] = schedule.start.split(':').map(Number)
        const currentDate = new Date(now)
        const currentMinutes = currentDate.getHours() * 60 + currentDate.getMinutes()
        const startMinutes = startHour * 60 + startMin
        
        if (currentMinutes > startMinutes + 5) { // 允许5分钟缓冲
          status = 'late'
        }
      }
    } catch (e) {}
  }
  
  if (existing) {
    // 更新已有记录
    await c.env.DB.prepare(`
      UPDATE attendance_records SET clock_in_time = ?, status = ?, updated_at = ? WHERE id = ?
    `).bind(now, status, now, existing.id).run()
  } else {
    // 创建新记录
    const id = uuid()
    await c.env.DB.prepare(`
      INSERT INTO attendance_records (id, employee_id, date, clock_in_time, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(id, employeeId, today, now, status, now, now).run()
  }
  
  logAuditAction(c, 'create', 'attendance_clock_in', employeeId, JSON.stringify({ date: today, time: now }))
  
  return c.json({ ok: true, clockInTime: now, status })
})

// 签退
myRoutes.post('/my/attendance/clock-out', async (c) => {
  const userId = c.get('userId')
  if (!userId) throw Errors.UNAUTHORIZED()
  
  const employeeId = await getMyEmployeeId(c)
  if (!employeeId) throw Errors.NOT_FOUND('未找到员工记录')
  
  const today = new Date().toISOString().split('T')[0]
  const now = Date.now()
  
  // 检查是否已签到
  const existing = await c.env.DB.prepare(`
    SELECT id, clock_in_time, clock_out_time, status FROM attendance_records WHERE employee_id = ? AND date = ?
  `).bind(employeeId, today).first() as { id: string, clock_in_time: number, clock_out_time: number, status: string } | null
  
  if (!existing?.clock_in_time) {
    return c.json({ error: '请先签到' }, 400)
  }
  
  if (existing.clock_out_time) {
    return c.json({ error: '今日已签退', clockOutTime: existing.clock_out_time }, 400)
  }
  
  // 获取员工工作时间配置，判断是否早退
  const employee = await c.env.DB.prepare(`
    SELECT work_schedule FROM employees WHERE id = ?
  `).bind(employeeId).first() as { work_schedule: string } | null
  
  let status = existing.status
  if (employee?.work_schedule) {
    try {
      const schedule = typeof employee.work_schedule === 'string' 
        ? JSON.parse(employee.work_schedule) 
        : employee.work_schedule
      
      if (schedule?.end) {
        const [endHour, endMin] = schedule.end.split(':').map(Number)
        const currentDate = new Date(now)
        const currentMinutes = currentDate.getHours() * 60 + currentDate.getMinutes()
        const endMinutes = endHour * 60 + endMin
        
        if (currentMinutes < endMinutes - 5) { // 允许5分钟缓冲
          status = status === 'late' ? 'late_early' : 'early'
        }
      }
    } catch (e) {}
  }
  
  await c.env.DB.prepare(`
    UPDATE attendance_records SET clock_out_time = ?, status = ?, updated_at = ? WHERE id = ?
  `).bind(now, status, now, existing.id).run()
  
  logAuditAction(c, 'update', 'attendance_clock_out', employeeId, JSON.stringify({ date: today, time: now }))
  
  return c.json({ ok: true, clockOutTime: now, status })
})
