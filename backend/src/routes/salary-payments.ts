import { Hono } from 'hono'
import type { Env, AppVariables } from '../types.js'
import { isHQDirector, isHQFinance, isHQHR, isProjectDirector, isProjectFinance, isTeamMember, getUserId } from '../utils/permissions.js'
import { logAudit, logAuditAction } from '../utils/audit.js'
import { uuid, getUserEmployeeId } from '../utils/db.js'
import { Errors } from '../utils/errors.js'
import { validateJson, getValidatedData, validateQuery, getValidatedQuery } from '../utils/validator.js'
import { generateSalaryPaymentsSchema, batchCreateSalaryAllocationsSchema, requestSalaryAllocationsSchema, salaryPaymentTransferSchema } from '../schemas/business.schema.js'
import { salaryPaymentQuerySchema } from '../schemas/common.schema.js'
import type { z } from 'zod'

export const salaryPaymentsRoutes = new Hono<{ Bindings: Env, Variables: AppVariables }>()

// 薪资发放管理 - 列表
salaryPaymentsRoutes.get('/salary-payments', validateQuery(salaryPaymentQuerySchema), async (c) => {
  // 所有人都可以查看（通过数据权限过滤）
  const query = getValidatedQuery<z.infer<typeof salaryPaymentQuerySchema>>(c)
  const year = query.year
  const month = query.month
  const status = query.status
  const employeeId = query.employee_id
  const userId = getUserId(c)
  
  let sql = `
    select 
      sp.*,
      e.name as employee_name,
      e.department_id,
      d.name as department_name,
      a.name as account_name,
      a.currency as account_currency,
      u1.name as employee_confirmed_by_name,
      u2.name as finance_approved_by_name,
      u3.name as payment_transferred_by_name,
      u4.name as payment_confirmed_by_name
    from salary_payments sp
    left join employees e on e.id = sp.employee_id
    left join departments d on d.id = e.department_id
    left join accounts a on a.id = sp.account_id
    left join users u1 on u1.id = sp.employee_confirmed_by
    left join users u2 on u2.id = sp.finance_approved_by
    left join users u3 on u3.id = sp.payment_transferred_by
    left join users u4 on u4.id = sp.payment_confirmed_by
    where 1=1
  `
  const binds: any[] = []
  
  // 组员只能查看自己的薪资（通过email匹配employee_id）
  if (isTeamMember(c) && userId) {
    const userEmployeeId = await getUserEmployeeId(c.env.DB, userId)
    if (userEmployeeId) {
      sql += ' and sp.employee_id = ?'
      binds.push(userEmployeeId)
    } else {
      // 如果没有找到对应的employee记录，返回空结果
      return c.json({ results: [] })
    }
  }
  
  if (year) {
    sql += ' and sp.year = ?'
    binds.push(year)
  }
  if (month) {
    sql += ' and sp.month = ?'
    binds.push(month)
  }
  if (status) {
    sql += ' and sp.status = ?'
    binds.push(status)
  }
  if (employeeId) {
    sql += ' and sp.employee_id = ?'
    binds.push(employeeId)
  }
  
  sql += ' order by sp.year desc, sp.month desc, e.name'
  
  // 优化：先获取薪资单基本信息，然后一次性批量查询所有分配记录
  const rows = await c.env.DB.prepare(sql).bind(...binds).all()
  const results = rows.results ?? []
  
  if (results.length === 0) {
    return c.json([])
  }
  
  // 一次性批量查询所有分配记录
  const paymentIds = results.map((r: any) => r.id)
  const placeholders = paymentIds.map(() => '?').join(',')
  const allocations = await c.env.DB.prepare(`
    select 
      spa.*,
      spa.salary_payment_id,
      c.name as currency_name,
      a.name as account_name,
      u1.name as requested_by_name,
      u2.name as approved_by_name
    from salary_payment_allocations spa
    left join currencies c on c.code = spa.currency_id
    left join accounts a on a.id = spa.account_id
    left join users u1 on u1.id = spa.requested_by
    left join users u2 on u2.id = spa.approved_by
    where spa.salary_payment_id in (${placeholders})
    order by spa.created_at
  `).bind(...paymentIds).all()
  
  // 按薪资单ID分组分配记录
  const allocationsByPaymentId = new Map<string, any[]>()
  for (const alloc of allocations.results ?? []) {
    const allocAny = alloc as any
    if (!allocationsByPaymentId.has(allocAny.salary_payment_id)) {
      allocationsByPaymentId.set(allocAny.salary_payment_id, [])
    }
    allocationsByPaymentId.get(allocAny.salary_payment_id)!.push({
      id: allocAny.id,
      currency_id: allocAny.currency_id,
      amount_cents: allocAny.amount_cents,
      status: allocAny.status,
      requested_by: allocAny.requested_by,
      approved_by: allocAny.approved_by,
      created_at: allocAny.created_at,
      currency_name: allocAny.currency_name,
      account_name: allocAny.account_name,
      requested_by_name: allocAny.requested_by_name,
      approved_by_name: allocAny.approved_by_name
    })
  }
  
  // 将分配记录添加到薪资单中
  const finalResults = results.map((payment: any) => ({
    ...payment,
    allocations: allocationsByPaymentId.get(payment.id) ?? []
  }))
  
  return c.json(finalResults)
})

// 薪资发放管理 - 创建（基于薪资表生成）
salaryPaymentsRoutes.post('/salary-payments/generate', validateJson(generateSalaryPaymentsSchema), async (c) => {
  // 只有财务和负责人可以生成薪资单
  const canGenerate = isHQDirector(c) || isHQFinance(c) || isProjectDirector(c) || isProjectFinance(c)
  if (!canGenerate) throw Errors.FORBIDDEN()
  const body = getValidatedData<z.infer<typeof generateSalaryPaymentsSchema>>(c)
  
  const yearNum = body.year
  const monthNum = body.month
  
  // 查询所有活跃员工（优化：一次性查询）
  const employees = await c.env.DB.prepare(`
    select 
      e.id,
      e.name,
      e.department_id,
      e.join_date,
      e.probation_salary_cents,
      e.regular_salary_cents,
      e.status,
      e.regular_date
    from employees e
    where e.active = 1
  `).all<any>()
  
  // 过滤出在该月在职的员工
  const eligibleEmployees = (employees.results || []).filter((emp: any) => {
    const joinDate = new Date(emp.join_date + 'T00:00:00Z')
    const joinYear = joinDate.getFullYear()
    const joinMonth = joinDate.getMonth() + 1
    return !(joinYear > yearNum || (joinYear === yearNum && joinMonth > monthNum))
  })
  
  if (eligibleEmployees.length === 0) {
    return c.json({ created: 0, ids: [] })
  }
  
  const employeeIds = eligibleEmployees.map((emp: any) => emp.id)
  
  // 优化：批量查询已存在的薪资单
  const placeholders = employeeIds.map(() => '?').join(',')
  const existingPayments = await c.env.DB.prepare(`
    select employee_id, year, month
    from salary_payments
    where employee_id in (${placeholders})
      and year = ? and month = ?
  `).bind(...employeeIds, yearNum, monthNum).all<any>()
  
  // 构建已存在薪资单的Set
  const existingSet = new Set<string>()
  for (const payment of (existingPayments.results || [])) {
    existingSet.add(`${payment.employee_id}:${payment.year}:${payment.month}`)
  }
  
  // 过滤掉已存在薪资单的员工
  const employeesToProcess = eligibleEmployees.filter((emp: any) => 
    !existingSet.has(`${emp.id}:${yearNum}:${monthNum}`)
  )
  
  if (employeesToProcess.length === 0) {
    return c.json({ created: 0, ids: [] })
  }
  
  const employeesToProcessIds = employeesToProcess.map((emp: any) => emp.id)
  const placeholders2 = employeesToProcessIds.map(() => '?').join(',')
  
  // 优化：批量查询所有员工的多币种底薪配置
  const allSalaries = await c.env.DB.prepare(`
    select 
      es.*,
      c.code as currency_code,
      es.employee_id,
      es.salary_type
    from employee_salaries es
    left join currencies c on c.code = es.currency_id
    where es.employee_id in (${placeholders2})
    order by es.employee_id, case when c.code = 'USDT' then 0 else 1 end, c.code
  `).bind(...employeesToProcessIds).all<any>()
  
  // 按员工ID和薪资类型分组底薪配置
  const salariesByEmployeeAndType = new Map<string, any[]>()
  for (const salary of (allSalaries.results || [])) {
    const key = `${salary.employee_id}:${salary.salary_type}`
    if (!salariesByEmployeeAndType.has(key)) {
      salariesByEmployeeAndType.set(key, [])
    }
    salariesByEmployeeAndType.get(key)!.push(salary)
  }
  
  // 优化：批量查询所有员工的请假记录
  const daysInMonth = new Date(yearNum, monthNum, 0).getDate()
  const monthStart = `${yearNum}-${String(monthNum).padStart(2, '0')}-01`
  const monthEnd = `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`
  
  const allLeaves = await c.env.DB.prepare(`
    select 
      employee_id,
      leave_type,
      start_date,
      end_date,
      days
    from employee_leaves
    where employee_id in (${placeholders2})
      and status = 'approved'
      and start_date <= ? and end_date >= ?
  `).bind(...employeesToProcessIds, monthEnd, monthStart).all<any>()
  
  // 按员工ID分组请假记录
  const leavesByEmployee = new Map<string, any[]>()
  for (const leave of (allLeaves.results || [])) {
    if (!leavesByEmployee.has(leave.employee_id)) {
      leavesByEmployee.set(leave.employee_id, [])
    }
    leavesByEmployee.get(leave.employee_id)!.push(leave)
  }
  
  const created = []
  const now = Date.now()
  const userId = c.get('userId') as string | undefined
  
  // 准备批量插入的语句和审计日志
  const insertStatements: any[] = []
  const auditLogs: any[] = []
  
  for (const emp of employeesToProcess) {
    const joinDate = new Date(emp.join_date + 'T00:00:00Z')
    const joinYear = joinDate.getFullYear()
    const joinMonth = joinDate.getMonth() + 1
    
    // 计算该月应发工资（优先使用多币种底薪配置）
    let salaryCents = 0
    let workDays = 0
    
    // 确定薪资类型
    const salaryType = (emp.status === 'regular' && emp.regular_date) ? 'regular' : 'probation'
    
    // 从批量查询的结果中获取该员工的多币种底薪配置
    const multiCurrencySalaries = salariesByEmployeeAndType.get(`${emp.id}:${salaryType}`) || []
    
    // 如果有多币种底薪配置，使用USDT或第一个币种
    if (multiCurrencySalaries.length > 0) {
      const usdtSalary = multiCurrencySalaries.find((s: any) => s.currency_code === 'USDT')
      salaryCents = usdtSalary ? usdtSalary.amount_cents : multiCurrencySalaries[0].amount_cents
    } else {
      // 如果没有多币种配置，使用原有的单一币种配置
      if (emp.status === 'regular' && emp.regular_date) {
        const regularDate = new Date(emp.regular_date + 'T00:00:00Z')
        const regularYear = regularDate.getFullYear()
        const regularMonth = regularDate.getMonth() + 1
        
        if (regularYear < yearNum || (regularYear === yearNum && regularMonth < monthNum)) {
          salaryCents = emp.regular_salary_cents
        } else if (regularYear === yearNum && regularMonth === monthNum) {
          // 当月转正，需要计算试用期和转正期的混合薪资
          const regularDay = regularDate.getDate()
          const probationDays = regularDay - 1
          const regularDays = daysInMonth - regularDay + 1
          
          // 从批量查询结果中获取试用期和转正期的多币种底薪
          const probationSalaries = salariesByEmployeeAndType.get(`${emp.id}:probation`) || []
          const regularSalaries = salariesByEmployeeAndType.get(`${emp.id}:regular`) || []
          
          let probationSalaryCents = emp.probation_salary_cents
          let regularSalaryCents = emp.regular_salary_cents
          
          if (probationSalaries.length > 0) {
            const usdtProbation = probationSalaries.find((s: any) => s.currency_code === 'USDT')
            probationSalaryCents = usdtProbation ? usdtProbation.amount_cents : probationSalaries[0].amount_cents
          }
          
          if (regularSalaries.length > 0) {
            const usdtRegular = regularSalaries.find((s: any) => s.currency_code === 'USDT')
            regularSalaryCents = usdtRegular ? usdtRegular.amount_cents : regularSalaries[0].amount_cents
          }
          
          salaryCents = Math.round(
            (probationSalaryCents * probationDays + regularSalaryCents * regularDays) / daysInMonth
          )
        } else {
          // 试用期，使用多币种或默认
          const probationSalaries = salariesByEmployeeAndType.get(`${emp.id}:probation`) || []
          if (probationSalaries.length > 0) {
            const usdtSalary = probationSalaries.find((s: any) => s.currency_code === 'USDT')
            salaryCents = usdtSalary ? usdtSalary.amount_cents : probationSalaries[0].amount_cents
          } else {
            salaryCents = emp.probation_salary_cents
          }
        }
      } else {
        salaryCents = emp.probation_salary_cents
      }
    }
    
    // 计算该月实际工作天数
    if (joinYear === yearNum && joinMonth === monthNum) {
      workDays = daysInMonth - joinDate.getDate() + 1
    } else {
      workDays = daysInMonth
    }
    
    // 从批量查询结果中获取该员工的请假记录
    const leaves = leavesByEmployee.get(emp.id) || []
    
    // 计算需要扣除的请假天数（非年假）
    let leaveDaysToDeduct = 0
    for (const leave of leaves) {
      if (leave.leave_type !== 'annual') {
        const leaveStart = new Date(leave.start_date + 'T00:00:00Z')
        const leaveEnd = new Date(leave.end_date + 'T00:00:00Z')
        const monthStartDate = new Date(monthStart + 'T00:00:00Z')
        const monthEndDate = new Date(monthEnd + 'T00:00:00Z')
        
        const overlapStart = leaveStart > monthStartDate ? leaveStart : monthStartDate
        const overlapEnd = leaveEnd < monthEndDate ? leaveEnd : monthEndDate
        
        if (overlapStart <= overlapEnd) {
          const overlapDays = Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
          leaveDaysToDeduct += overlapDays
        }
      }
    }
    
    workDays = Math.max(0, workDays - leaveDaysToDeduct)
    const actualSalaryCents = Math.round((salaryCents * workDays) / daysInMonth)
    
    // 准备批量插入
    const id = uuid()
    insertStatements.push(
      c.env.DB.prepare(`
        insert into salary_payments(
          id, employee_id, year, month, salary_cents, status, allocation_status,
          created_at, updated_at
        ) values(?,?,?,?,?,'pending_employee_confirmation','pending',?,?)
      `).bind(id, emp.id, yearNum, monthNum, actualSalaryCents, now, now)
    )
    
    auditLogs.push({
      id,
      action: 'create',
      resource: 'salary_payment',
      resourceId: id,
      details: JSON.stringify({
        employee_id: emp.id,
        year: yearNum,
        month: monthNum,
        salary_cents: actualSalaryCents
      })
    })
    
    created.push(id)
  }
  
  // 批量插入薪资单（优化：使用batch操作）
  if (insertStatements.length > 0) {
    await c.env.DB.batch(insertStatements)
    
    // 记录审计日志
    for (const log of auditLogs) {
      logAuditAction(c, log.action, log.resource, log.resourceId, log.details)
    }
  }
  
  return c.json({ created: created.length, ids: created })
})

// 薪资发放管理 - 员工确认
salaryPaymentsRoutes.post('/salary-payments/:id/employee-confirm', async (c) => {
  // 员工可以确认自己的薪资
  const id = c.req.param('id')
  const userId = getUserId(c)
  
  const record = await c.env.DB.prepare(`
    select sp.*, e.name as employee_name
    from salary_payments sp
    left join employees e on e.id = sp.employee_id
    where sp.id=?
  `).bind(id).first<any>()
  
  if (!record) throw Errors.NOT_FOUND()
  
  // 组员只能确认自己的薪资（通过email匹配employee_id）
  if (isTeamMember(c) && userId) {
    const userEmployeeId = await getUserEmployeeId(c.env.DB, userId)
    if (!userEmployeeId || record.employee_id !== userEmployeeId) {
      throw Errors.FORBIDDEN('员工只能确认自己的工资')
    }
  }
  
  if (record.status !== 'pending_employee_confirmation') {
    throw Errors.VALIDATION_ERROR('无效的状态')
  }
  
  const now = Date.now()
  await c.env.DB.prepare(`
    update salary_payments 
    set status='pending_finance_approval',
        employee_confirmed_at=?,
        employee_confirmed_by=?,
        updated_at=?
    where id=?
  `).bind(now, userId || 'system', now, id).run()
  
  logAuditAction(c, 'update', 'salary_payment', id, JSON.stringify({
    action: 'employee_confirm',
    employee_id: record.employee_id
  }))
  
  const updated = await c.env.DB.prepare(`
    select 
      sp.*,
      e.name as employee_name,
      d.name as department_name
    from salary_payments sp
    left join employees e on e.id = sp.employee_id
    left join departments d on d.id = e.department_id
    where sp.id=?
  `).bind(id).first()
  
  return c.json(updated)
})

// 薪资发放管理 - 财务确认（需要先审批币种分配）
salaryPaymentsRoutes.post('/salary-payments/:id/finance-approve', async (c) => {
  // 只有财务和负责人可以确认
  const canApprove = isHQDirector(c) || isHQFinance(c) || isProjectDirector(c) || isProjectFinance(c)
  if (!canApprove) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  const userId = c.get('userId') as string | undefined
  
  const record = await c.env.DB.prepare('select * from salary_payments where id=?').bind(id).first<any>()
  if (!record) throw Errors.NOT_FOUND()
  
  if (record.status !== 'pending_finance_approval') {
    throw Errors.VALIDATION_ERROR('无效的状态')
  }
  
  // 检查是否已申请币种分配（如果已申请，必须已批准）
  if (record.allocation_status === 'requested') {
    throw Errors.BUSINESS_ERROR('币种分配必须先获得批准')
  }
  
  // 如果没有申请分配，默认全部USDT
  // 如果已批准分配，检查所有分配是否都已批准
  if (record.allocation_status === 'approved') {
    const pendingAllocations = await c.env.DB.prepare(`
      select count(1) as n from salary_payment_allocations 
      where salary_payment_id=? and status!='approved'
    `).bind(id).first<{ n: number }>()
    if (pendingAllocations && pendingAllocations.n > 0) {
      throw Errors.BUSINESS_ERROR('所有分配必须已批准')
    }
  }
  
  const now = Date.now()
  await c.env.DB.prepare(`
    update salary_payments 
    set status='pending_payment',
        finance_approved_at=?,
        finance_approved_by=?,
        updated_at=?
    where id=?
  `).bind(now, userId || 'system', now, id).run()
  
  logAuditAction(c, 'update', 'salary_payment', id, JSON.stringify({
    action: 'finance_approve',
    employee_id: record.employee_id
  }))
  
  const updated = await c.env.DB.prepare(`
    select 
      sp.*,
      e.name as employee_name,
      d.name as department_name
    from salary_payments sp
    left join employees e on e.id = sp.employee_id
    left join departments d on d.id = e.department_id
    where sp.id=?
  `).bind(id).first()
  
  return c.json(updated)
})

// 薪资发放管理 - 出纳转账（需要选择账户）
salaryPaymentsRoutes.post('/salary-payments/:id/payment-transfer', validateJson(salaryPaymentTransferSchema), async (c) => {
  // 只有财务和负责人可以标记转账
  const canTransfer = isHQDirector(c) || isHQFinance(c) || isProjectDirector(c) || isProjectFinance(c)
  if (!canTransfer) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  const body = getValidatedData<z.infer<typeof salaryPaymentTransferSchema>>(c)
  const userId = c.get('userId') as string | undefined
  
  const record = await c.env.DB.prepare('select * from salary_payments where id=?').bind(id).first<any>()
  if (!record) throw Errors.NOT_FOUND()
  
  if (record.status !== 'pending_payment') {
    throw Errors.VALIDATION_ERROR('无效的状态')
  }
  
  // 验证账户存在
  const account = await c.env.DB.prepare('select * from accounts where id=?').bind(body.account_id).first<any>()
  if (!account) throw Errors.NOT_FOUND('账户')
  if (account.active === 0) throw Errors.BUSINESS_ERROR('账户已停用')
  
  // 如果没有币种分配，使用选择的账户；如果有分配，检查账户是否匹配
  if (record.allocation_status === 'approved') {
    const allocations = await c.env.DB.prepare(`
      select account_id from salary_payment_allocations 
      where salary_payment_id=? and status='approved' and account_id is not null
      limit 1
    `).bind(id).all<any>()
    
    // 如果有分配且指定了账户，使用分配的账户；否则使用传入的账户
    if (allocations.results && allocations.results.length > 0 && allocations.results[0].account_id) {
      // 使用分配的账户
      const now = Date.now()
      await c.env.DB.prepare(`
        update salary_payments 
        set status='pending_payment_confirmation',
            account_id=?,
            payment_transferred_at=?,
            payment_transferred_by=?,
            updated_at=?
        where id=?
      `).bind(body.account_id, now, userId || 'system', now, id).run()
    } else {
      // 如果没有分配账户，使用传入的账户
      const now = Date.now()
      await c.env.DB.prepare(`
        update salary_payments 
        set status='pending_payment_confirmation',
            account_id=?,
            payment_transferred_at=?,
            payment_transferred_by=?,
            updated_at=?
        where id=?
      `).bind(body.account_id, now, userId || 'system', now, id).run()
    }
  } else {
    // 没有分配，使用传入的账户
    const now = Date.now()
    await c.env.DB.prepare(`
      update salary_payments 
      set status='pending_payment_confirmation',
          account_id=?,
          payment_transferred_at=?,
          payment_transferred_by=?,
          updated_at=?
      where id=?
    `).bind(body.account_id, now, userId || 'system', now, id).run()
  }
  
  logAuditAction(c, 'update', 'salary_payment', id, JSON.stringify({
    action: 'payment_transfer',
    account_id: body.account_id,
    employee_id: record.employee_id
  }))
  
  const updated = await c.env.DB.prepare(`
    select 
      sp.*,
      e.name as employee_name,
      d.name as department_name,
      a.name as account_name,
      a.currency as account_currency
    from salary_payments sp
    left join employees e on e.id = sp.employee_id
    left join departments d on d.id = e.department_id
    left join accounts a on a.id = sp.account_id
    where sp.id=?
  `).bind(id).first()
  
  return c.json(updated)
})

// 薪资发放管理 - 出纳确认（上传凭证）
salaryPaymentsRoutes.post('/salary-payments/:id/payment-confirm', async (c) => {
  // 只有总部财务、项目财务或负责人可以确认转账
  const canConfirm = isHQFinance(c) || isProjectFinance(c) || isHQDirector(c) || isProjectDirector(c)
  if (!canConfirm) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  const body = await c.req.json<{ payment_voucher_path: string }>()
  const userId = c.get('userId') as string | undefined
  
  if (!body.payment_voucher_path) throw Errors.VALIDATION_ERROR('payment_voucher_path参数必填')
  
  const record = await c.env.DB.prepare('select * from salary_payments where id=?').bind(id).first<any>()
  if (!record) throw Errors.NOT_FOUND()
  
  if (record.status !== 'pending_payment_confirmation') {
    throw Errors.VALIDATION_ERROR('无效的状态')
  }
  
  const now = Date.now()
  await c.env.DB.prepare(`
    update salary_payments 
    set status='completed',
        payment_voucher_path=?,
        payment_confirmed_at=?,
        payment_confirmed_by=?,
        updated_at=?
    where id=?
  `).bind(body.payment_voucher_path, now, userId || 'system', now, id).run()
  
  logAuditAction(c, 'update', 'salary_payment', id, JSON.stringify({
    action: 'payment_confirm',
    employee_id: record.employee_id,
    payment_voucher_path: body.payment_voucher_path
  }))
  
  const updated = await c.env.DB.prepare(`
    select 
      sp.*,
      e.name as employee_name,
      d.name as department_name
    from salary_payments sp
    left join employees e on e.id = sp.employee_id
    left join departments d on d.id = e.department_id
    where sp.id=?
  `).bind(id).first()
  
  return c.json(updated)
})

// 薪资发放管理 - 获取详情
salaryPaymentsRoutes.get('/salary-payments/:id', async (c) => {
  // 所有人都可以查看（通过数据权限过滤）
  const id = c.req.param('id')
  
  const record = await c.env.DB.prepare(`
    select 
      sp.*,
      e.name as employee_name,
      e.department_id,
      d.name as department_name,
      a.name as account_name,
      a.currency as account_currency,
      u1.name as employee_confirmed_by_name,
      u2.name as finance_approved_by_name,
      u3.name as payment_transferred_by_name,
      u4.name as payment_confirmed_by_name
    from salary_payments sp
    left join employees e on e.id = sp.employee_id
    left join departments d on d.id = e.department_id
    left join accounts a on a.id = sp.account_id
    left join users u1 on u1.id = sp.employee_confirmed_by
    left join users u2 on u2.id = sp.finance_approved_by
    left join users u3 on u3.id = sp.payment_transferred_by
    left join users u4 on u4.id = sp.payment_confirmed_by
    where sp.id=?
  `).bind(id).first()
  
  if (!record) throw Errors.NOT_FOUND()
  
  // 组员只能查看自己的薪资
  if (isTeamMember(c)) {
    const userId = getUserId(c)
    if (userId) {
      const userEmployeeId = await getUserEmployeeId(c.env.DB, userId)
      if (!userEmployeeId || record.employee_id !== userEmployeeId) {
        throw Errors.FORBIDDEN()
      }
    }
  }
  
  // 查询币种分配
  const allocations = await c.env.DB.prepare(`
    select 
      spa.*,
      c.name as currency_name,
      a.name as account_name
    from salary_payment_allocations spa
    left join currencies c on c.code = spa.currency_id
    left join accounts a on a.id = spa.account_id
    where spa.salary_payment_id = ?
    order by spa.created_at
  `).bind(id).all()
  
  record.allocations = allocations.results ?? []
  
  return c.json(record)
})

// 薪资发放管理 - 删除
salaryPaymentsRoutes.delete('/salary-payments/:id', async (c) => {
  const canDelete = isHQDirector(c)
  if (!canDelete) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  
  const record = await c.env.DB.prepare('select * from salary_payments where id=?').bind(id).first<any>()
  if (!record) throw Errors.NOT_FOUND()
  
  // 只有pending_employee_confirmation状态可以删除
  if (record.status !== 'pending_employee_confirmation') {
    throw Errors.BUSINESS_ERROR('只能删除待处理的付款')
  }
  
  // 删除关联的币种分配记录
  await c.env.DB.prepare('delete from salary_payment_allocations where salary_payment_id=?').bind(id).run()
  
  await c.env.DB.prepare('delete from salary_payments where id=?').bind(id).run()
  
  logAuditAction(c, 'delete', 'salary_payment', id, JSON.stringify({
    employee_id: record.employee_id,
    year: record.year,
    month: record.month
  }))
  
  return c.json({ ok: true })
})

// 薪资币种分配管理 - 申请分配（员工申请）
salaryPaymentsRoutes.post('/salary-payments/:id/allocations', validateJson(requestSalaryAllocationsSchema), async (c) => {
  // 员工可以申请币种分配
  const id = c.req.param('id')
  const body = getValidatedData<z.infer<typeof requestSalaryAllocationsSchema>>(c)
  const userId = getUserId(c)
  
  const record = await c.env.DB.prepare('select * from salary_payments where id=?').bind(id).first<any>()
  if (!record) throw Errors.NOT_FOUND()
  
  // 组员只能申请自己的薪资币种分配
  if (isTeamMember(c) && userId) {
    const userEmployeeId = await getUserEmployeeId(c.env.DB, userId)
    if (!userEmployeeId || record.employee_id !== userEmployeeId) {
      throw Errors.FORBIDDEN('员工只能为自己的工资申请分配')
    }
  }
  
  // 只能在工作确认后申请
  if (record.status !== 'pending_employee_confirmation' && record.status !== 'pending_finance_approval') {
    throw Errors.BUSINESS_ERROR('只能在财务审批前申请分配')
  }
  
  // 验证分配总额不超过薪资总额
  const totalAllocated = body.allocations.reduce((sum, a) => sum + a.amount_cents, 0)
  if (totalAllocated > record.salary_cents) {
    throw Errors.BUSINESS_ERROR('总分配金额超过工资金额')
  }
  
  // 删除旧的分配记录
  await c.env.DB.prepare('delete from salary_payment_allocations where salary_payment_id=?').bind(id).run()
  
  // 创建新的分配记录
  const now = Date.now()
  for (const alloc of body.allocations) {
    // 验证币种存在
    const currency = await c.env.DB.prepare('select code from currencies where code=? and active=1')
      .bind(alloc.currency_id.toUpperCase()).first<{ code: string }>()
    if (!currency) {
      throw Errors.NOT_FOUND(`币种 ${alloc.currency_id}`)
    }
    
    // 如果有账户，验证账户存在且币种匹配
    if (alloc.account_id) {
      const account = await c.env.DB.prepare('select * from accounts where id=?').bind(alloc.account_id).first<any>()
      if (!account) {
        throw Errors.NOT_FOUND('账户')
      }
      if (account.currency !== alloc.currency_id.toUpperCase()) {
        throw Errors.BUSINESS_ERROR('账户币种与分配币种不匹配')
      }
    }
    
    const allocId = uuid()
    await c.env.DB.prepare(`
      insert into salary_payment_allocations(
        id, salary_payment_id, currency_id, amount_cents, account_id,
        status, requested_by, requested_at,
        created_at, updated_at
      ) values(?,?,?,?,?,'pending',?,?,?,?)
    `).bind(
      allocId, id, alloc.currency_id.toUpperCase(), alloc.amount_cents,
      alloc.account_id || null, userId || 'system', now, now, now
    ).run()
  }
  
  // 更新薪资单的分配状态
  await c.env.DB.prepare(`
    update salary_payments 
    set allocation_status='requested',
        updated_at=?
    where id=?
  `).bind(now, id).run()
  
  logAuditAction(c, 'create', 'salary_payment_allocation', id, JSON.stringify({
    salary_payment_id: id,
    allocations: body.allocations
  }))
  
  const updated = await c.env.DB.prepare(`
    select 
      sp.*,
      e.name as employee_name,
      d.name as department_name
    from salary_payments sp
    left join employees e on e.id = sp.employee_id
    left join departments d on d.id = e.department_id
    where sp.id=?
  `).bind(id).first()
  
  if (!updated) throw Errors.NOT_FOUND()
  
  // 查询分配记录
  const allocations = await c.env.DB.prepare(`
    select 
      spa.*,
      c.name as currency_name,
      a.name as account_name
    from salary_payment_allocations spa
    left join currencies c on c.code = spa.currency_id
    left join accounts a on a.id = spa.account_id
    where spa.salary_payment_id = ?
    order by spa.created_at
  `).bind(id).all()
  
  updated.allocations = allocations.results ?? []
  
  return c.json(updated)
})

// 薪资币种分配管理 - 审批分配（财务审批）
salaryPaymentsRoutes.post('/salary-payments/:id/allocations/approve', async (c) => {
  // 只有总部财务、项目财务或负责人可以审批
  const canApprove = isHQFinance(c) || isProjectFinance(c) || isHQDirector(c) || isProjectDirector(c)
  if (!canApprove) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  const body = await c.req.json<{ allocation_ids?: string[], approve_all?: boolean }>()
  const userId = c.get('userId') as string | undefined
  
  const record = await c.env.DB.prepare('select * from salary_payments where id=?').bind(id).first<any>()
  if (!record) throw Errors.NOT_FOUND()
  
  if (record.allocation_status !== 'requested') {
    throw Errors.BUSINESS_ERROR('分配未申请')
  }
  
  const now = Date.now()
  
  if (body.approve_all) {
    // 批准所有待审批的分配
    await c.env.DB.prepare(`
      update salary_payment_allocations 
      set status='approved',
          approved_by=?,
          approved_at=?,
          updated_at=?
      where salary_payment_id=? and status='pending'
    `).bind(userId || 'system', now, now, id).run()
  } else if (body.allocation_ids && body.allocation_ids.length > 0) {
    // 批准指定的分配
    const placeholders = body.allocation_ids.map(() => '?').join(',')
    await c.env.DB.prepare(`
      update salary_payment_allocations 
      set status='approved',
          approved_by=?,
          approved_at=?,
          updated_at=?
      where id in (${placeholders}) and salary_payment_id=?
    `).bind(userId || 'system', now, now, ...body.allocation_ids, id).run()
  } else {
    throw Errors.VALIDATION_ERROR('allocation_ids or approve_all参数必填')
  }
  
  // 检查是否所有分配都已批准
  const pendingCount = await c.env.DB.prepare(`
    select count(1) as n from salary_payment_allocations 
    where salary_payment_id=? and status='pending'
  `).bind(id).first<{ n: number }>()
  
  if (pendingCount && pendingCount.n === 0) {
    // 所有分配都已批准，更新薪资单状态
    await c.env.DB.prepare(`
      update salary_payments 
      set allocation_status='approved',
          updated_at=?
      where id=?
    `).bind(now, id).run()
  }
  
  logAuditAction(c, 'update', 'salary_payment_allocation', id, JSON.stringify({
    action: 'approve',
    allocation_ids: body.allocation_ids,
    approve_all: body.approve_all
  }))
  
  const updated = await c.env.DB.prepare(`
    select 
      sp.*,
      e.name as employee_name,
      d.name as department_name
    from salary_payments sp
    left join employees e on e.id = sp.employee_id
    left join departments d on d.id = e.department_id
    where sp.id=?
  `).bind(id).first()
  
  if (!updated) throw Errors.NOT_FOUND()
  
  // 查询分配记录
  const allocations = await c.env.DB.prepare(`
    select 
      spa.*,
      c.name as currency_name,
      a.name as account_name,
      u1.name as requested_by_name,
      u2.name as approved_by_name
    from salary_payment_allocations spa
    left join currencies c on c.code = spa.currency_id
    left join accounts a on a.id = spa.account_id
    left join users u1 on u1.id = spa.requested_by
    left join users u2 on u2.id = spa.approved_by
    where spa.salary_payment_id = ?
    order by spa.created_at
  `).bind(id).all()
  
  updated.allocations = allocations.results ?? []
  
  return c.json(updated)
})

// 薪资币种分配管理 - 拒绝分配（财务拒绝）
salaryPaymentsRoutes.post('/salary-payments/:id/allocations/reject', async (c) => {
  // 只有总部财务、项目财务或负责人可以拒绝
  const canReject = isHQFinance(c) || isProjectFinance(c) || isHQDirector(c) || isProjectDirector(c)
  if (!canReject) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  const body = await c.req.json<{ allocation_ids: string[] }>()
  const userId = c.get('userId') as string | undefined
  
  if (!body.allocation_ids || body.allocation_ids.length === 0) {
    throw Errors.VALIDATION_ERROR('allocation_ids参数必填')
  }
  
  const record = await c.env.DB.prepare('select * from salary_payments where id=?').bind(id).first<any>()
  if (!record) throw Errors.NOT_FOUND()
  
  if (record.allocation_status !== 'requested') {
    throw Errors.BUSINESS_ERROR('分配未申请')
  }
  
  const now = Date.now()
  const placeholders = body.allocation_ids.map(() => '?').join(',')
  
  // 拒绝指定的分配
  await c.env.DB.prepare(`
    update salary_payment_allocations 
    set status='rejected',
        approved_by=?,
        approved_at=?,
        updated_at=?
    where id in (${placeholders}) and salary_payment_id=?
  `).bind(userId || 'system', now, now, ...body.allocation_ids, id).run()
  
  logAuditAction(c, 'update', 'salary_payment_allocation', id, JSON.stringify({
    action: 'reject',
    allocation_ids: body.allocation_ids
  }))
  
  const updated = await c.env.DB.prepare(`
    select 
      sp.*,
      e.name as employee_name,
      d.name as department_name
    from salary_payments sp
    left join employees e on e.id = sp.employee_id
    left join departments d on d.id = e.department_id
    where sp.id=?
  `).bind(id).first()
  
  if (!updated) throw Errors.NOT_FOUND()
  
  // 查询分配记录
  const allocations = await c.env.DB.prepare(`
    select 
      spa.*,
      c.name as currency_name,
      a.name as account_name,
      u1.name as requested_by_name,
      u2.name as approved_by_name
    from salary_payment_allocations spa
    left join currencies c on c.code = spa.currency_id
    left join accounts a on a.id = spa.account_id
    left join users u1 on u1.id = spa.requested_by
    left join users u2 on u2.id = spa.approved_by
    where spa.salary_payment_id = ?
    order by spa.created_at
  `).bind(id).all()
  
  updated.allocations = allocations.results ?? []
  
  return c.json(updated)
})

// 薪资币种分配管理 - 获取分配列表
salaryPaymentsRoutes.get('/salary-payments/:id/allocations', async (c) => {
  // 所有人都可以查看
  const id = c.req.param('id')
  
  const allocations = await c.env.DB.prepare(`
    select 
      spa.*,
      c.name as currency_name,
      a.name as account_name,
      u1.name as requested_by_name,
      u2.name as approved_by_name
    from salary_payment_allocations spa
    left join currencies c on c.code = spa.currency_id
    left join accounts a on a.id = spa.account_id
    left join users u1 on u1.id = spa.requested_by
    left join users u2 on u2.id = spa.approved_by
    where spa.salary_payment_id = ?
    order by spa.created_at
  `).bind(id).all()
  
  return c.json(allocations.results ?? [])
})
