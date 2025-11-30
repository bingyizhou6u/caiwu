import { Hono } from 'hono'
import type { Env, AppVariables } from '../types.js'
import { hasPermission, getUserPosition, getUserEmployee, getUserId, isTeamMember, canViewEmployee, getDataAccessFilter } from '../utils/permissions.js'
import { logAudit, logAuditAction } from '../utils/audit.js'
import { uuid } from '../utils/db.js'
import { SystemService } from '../services/SystemService.js'
import { FinanceService } from '../services/FinanceService.js'
import { UserService } from '../services/UserService.js'
import bcrypt from 'bcryptjs'
import { generateRandomPassword, sendNewEmployeeAccountEmail } from '../utils/email.js'
import { Errors } from '../utils/errors.js'
import { validateJson, getValidatedData, validateQuery, getValidatedQuery } from '../utils/validator.js'
import { createEmployeeSchema, updateEmployeeSchema, regularizeEmployeeSchema, leaveEmployeeSchema, createEmployeeLeaveSchema, approveEmployeeLeaveSchema, createExpenseSchema } from '../schemas/business.schema.js'
import { validateAnnualLeaveRequest, getAnnualLeaveStats, calculateLeaveSettlement } from '../services/AnnualLeaveService.js'
import { employeeQuerySchema, employeeLeaveQuerySchema, expenseReimbursementQuerySchema } from '../schemas/common.schema.js'
import type { z } from 'zod'

export const employeesRoutes = new Hono<{ Bindings: Env, Variables: AppVariables }>()

employeesRoutes.get('/employees', validateQuery(employeeQuerySchema), async (c) => {
  if (!getUserPosition(c)) throw Errors.FORBIDDEN()

  const userId = getUserId(c)
  const query = getValidatedQuery<z.infer<typeof employeeQuerySchema>>(c)
  let sql = `
    select 
      e.*,
      d.name as department_name,
      od.name as org_department_name,
      od.code as org_department_code,
      u.id as user_id,
      u.active as user_active,
      u.last_login_at as user_last_login_at,
      p.id as position_id,
      p.code as position_code,
      p.name as position_name,
      p.level as position_level,
      p.function_role as position_function_role
    from employees e
    left join departments d on e.department_id = d.id
    left join org_departments od on e.org_department_id = od.id
    left join users u on u.email = e.email
    left join positions p on p.id = e.position_id and p.active = 1
    where 1=1
  `
  const binds: any[] = []

  // 添加状态筛选
  const status = query.status
  if (status && status !== 'all') {
    sql += ' and e.status = ?'
    binds.push(status)
  }

  // 添加是否在职筛选（active=1 且 status != 'resigned'）
  const activeOnly = query.active_only
  if (activeOnly === 'true') {
    sql += ' and e.active = 1 and e.status != ?'
    binds.push('resigned')
  }

  // 组员只能查看自己的信息（通过email匹配）
  if (isTeamMember(c) && userId) {
    sql += ' and exists (select 1 from users u where u.id = ? and u.email = e.email)'
    binds.push(userId)
  } else {
    // 其他角色：根据职位权限过滤（所有用户必须有职位）
    // 优化：优先使用中间件中已获取的position信息
    let position = getUserPosition(c)
    if (!position) {
      // 如果没有，回退到数据库查询（向后兼容）
      const userService = new UserService(c.env.DB)
      const dbPosition = await userService.getUserPosition(userId!)
      // 所有账号都来自员工，必须有职位
      if (!dbPosition) {
        sql += ' and 1=0'
        return c.json({ results: [] })
      }
      position = dbPosition
    }

    // 基于职位权限过滤（中间件已保证必须有职位）
    // 总部负责人和总部级别：可以查看所有数据
    if (position.level === 1) {
      // 不需要过滤
    } else if (position.level === 2) {
      // 项目级别：只能查看本项目数据
      // 优化：优先使用中间件中已获取的employee信息
      const employee = getUserEmployee(c)
      if (employee?.department_id) {
        sql += ' and e.department_id = ?'
        binds.push(employee.department_id)
      } else {
        // 如果没有，回退到数据库查询
        const userService = new UserService(c.env.DB)
        const deptIds = await userService.getUserDepartmentIds(userId!)
        if (deptIds.length > 0) {
          const placeholders = deptIds.map(() => '?').join(',')
          sql += ` and e.department_id in (${placeholders})`
          binds.push(...deptIds)
        }
      }
    } else if (position.code === 'team_leader') {
      // 组长：只能查看组内数据
      // 优化：优先使用中间件中已获取的employee信息
      const employee = getUserEmployee(c)
      if (employee?.org_department_id) {
        sql += ' and e.org_department_id = ?'
        binds.push(employee.org_department_id)
      } else {
        // 如果没有，回退到数据库查询
        const userService = new UserService(c.env.DB)
        const user = await userService.getUserById(userId!)
        if (user?.org_department_id) {
          sql += ' and e.org_department_id = ?'
          binds.push(user.org_department_id)
        }
      }
    }
    // team_developer 的情况已经在isEmployee中处理
  }

  sql += ' order by e.name'

  const rows = await c.env.DB.prepare(sql).bind(...binds).all()
  return c.json({ results: rows.results ?? [] })
})

// 为现有用户创建员工记录（迁移功能）
employeesRoutes.post('/employees/create-from-user', async (c) => {
  // 只有有员工更新权限的人可以执行此操作
  if (!hasPermission(c, 'hr', 'employee', 'update')) throw Errors.FORBIDDEN()

  const body = await c.req.json<{
    user_id: string
    org_department_id: string
    position_id: string
    join_date: string
    probation_salary_cents: number
    regular_salary_cents: number
    birthday: string
  }>()

  // 获取用户信息
  const userService = new UserService(c.env.DB)
  const user = await userService.getUserById(body.user_id)
  if (!user) throw Errors.NOT_FOUND('用户')

  // 检查是否已有员工记录
  const existingEmployee = await c.env.DB.prepare('select id from employees where email=?').bind(user.email).first<{ id: string }>()
  if (existingEmployee) {
    throw Errors.DUPLICATE('该用户已有员工记录')
  }

  // 从部门信息中获取项目ID
  const orgDept = await c.env.DB.prepare('select project_id from org_departments where id=?').bind(body.org_department_id).first<{ project_id: string | null }>()
  if (!orgDept) {
    throw Errors.NOT_FOUND('组织部门')
  }

  // 根据部门的project_id确定department_id
  let actualDepartmentId: string
  if (orgDept.project_id === null) {
    // 总部部门：查找或创建"总部"项目
    const hqDept = await c.env.DB.prepare('select id from departments where name=? and active=1 limit 1').bind('总部').first<{ id: string }>()
    if (hqDept?.id) {
      actualDepartmentId = hqDept.id
    } else {
      const systemService = new SystemService(c.env.DB)
      const hq = await systemService.getOrCreateDefaultHQ()
      const newDeptId = uuid()
      await c.env.DB.prepare('insert into departments(id,hq_id,name,active) values(?,?,?,1)')
        .bind(newDeptId, hq.id, '总部').run()
      actualDepartmentId = newDeptId
    }
  } else {
    actualDepartmentId = orgDept.project_id
  }

  // 验证项目是否存在
  const dept = await c.env.DB.prepare('select id from departments where id=?').bind(actualDepartmentId).first<{ id: string }>()
  if (!dept) throw Errors.NOT_FOUND('项目')

  // 验证职位
  const position = await c.env.DB.prepare('select code, level, function_role from positions where id=? and active=1')
    .bind(body.position_id).first<{ code: string, level: number, function_role: string }>()
  if (!position) throw Errors.NOT_FOUND('职位')

  const id = uuid()
  const now = Date.now()

  // 创建员工记录
  await c.env.DB.prepare(`
    insert into employees(
      id, name, department_id, org_department_id, position_id, join_date, 
      probation_salary_cents, regular_salary_cents,
      living_allowance_cents, housing_allowance_cents,
      transportation_allowance_cents, meal_allowance_cents,
      status, active, phone, email, usdt_address,
      emergency_contact, emergency_phone, address, memo,
      birthday, created_at, updated_at
    ) values(?,?,?,?,?,?,?,?,?,?,?,?,'regular',1,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    id, user.name || user.email, actualDepartmentId, body.org_department_id, body.position_id, body.join_date,
    body.probation_salary_cents, body.regular_salary_cents,
    0, 0, 0, 0,
    null, user.email, null,
    null, null,
    null, null,
    body.birthday,
    now, now
  ).run()

  // 更新用户账号的position_id和department_id
  await c.env.DB.prepare('update users set position_id=?, department_id=?, org_department_id=? where id=?')
    .bind(body.position_id, actualDepartmentId, body.org_department_id, body.user_id).run()

  // 如果项目存在，插入到user_departments表（如果还没有）
  const existingUd = await c.env.DB.prepare('select id from user_departments where user_id=? and department_id=?').bind(body.user_id, actualDepartmentId).first<{ id: string }>()
  if (!existingUd) {
    const udId = uuid()
    await c.env.DB.prepare('insert into user_departments(id,user_id,department_id,created_at) values(?,?,?,?)')
      .bind(udId, body.user_id, actualDepartmentId, now).run()
  }

  logAuditAction(c, 'create', 'employee', id, JSON.stringify({ name: user.name, email: user.email, from_user: true }))

  const created = await c.env.DB.prepare(`
    select 
      e.*,
      d.name as department_name,
      od.name as org_department_name,
      od.code as org_department_code
    from employees e
    left join departments d on e.department_id = d.id
    left join org_departments od on e.org_department_id = od.id
    where e.id=?
  `).bind(id).first()

  return c.json(created)
})

// 执行迁移：为admin和magi创建员工记录
employeesRoutes.post('/employees/migrate-admin-magi', async (c) => {
  // 只有有员工更新权限的人可以执行此操作
  if (!hasPermission(c, 'hr', 'employee', 'update')) throw Errors.FORBIDDEN()

  const ADMIN_EMAIL_ADDR = 'bingyizhou6u@gmail.com'
  const MAGI_EMAIL_ADDR = 'magi20221102@gmail.com'

  try {
    // 1. 查询用户信息
    const adminUserResult = await c.env.DB.prepare('select id from users where email=?').bind(ADMIN_EMAIL_ADDR).first<{ id: string }>()
    const magiUserResult = await c.env.DB.prepare('select id from users where email=?').bind(MAGI_EMAIL_ADDR).first<{ id: string }>()

    if (!adminUserResult) throw Errors.NOT_FOUND('admin用户')
    if (!magiUserResult) throw Errors.NOT_FOUND('magi用户')

    const userService = new UserService(c.env.DB)
    const adminUser = await userService.getUserById(adminUserResult.id)
    const magiUser = await userService.getUserById(magiUserResult.id)

    if (!adminUser) throw Errors.NOT_FOUND('admin用户')
    if (!magiUser) throw Errors.NOT_FOUND('magi用户')

    // 2. 查询或创建总部部门
    let hqDept = await c.env.DB.prepare('select id, name from org_departments where project_id is null and name=? limit 1').bind('总部').first<{ id: string, name: string }>()

    if (!hqDept) {
      const hqDeptId = uuid()
      await c.env.DB.prepare('insert into org_departments(id, project_id, name, active, created_at, updated_at) values(?,?,?,1,?,?)')
        .bind(hqDeptId, null, '总部', Date.now(), Date.now()).run()
      hqDept = await c.env.DB.prepare('select id, name from org_departments where id=?').bind(hqDeptId).first<{ id: string, name: string }>() as { id: string, name: string }
    }

    // 3. 查询总部负责人职位
    const hqAdminPosition = await c.env.DB.prepare('select id, code, name from positions where code=? and active=1').bind('hq_admin').first<{ id: string, code: string, name: string }>()
    if (!hqAdminPosition) {
      throw Errors.NOT_FOUND('hq_admin职位')
    }

    // 4. 查询或创建总部项目部门
    let actualDepartmentId: string
    const hqProjectDept = await c.env.DB.prepare('select id from departments where name=? and active=1 limit 1').bind('总部').first<{ id: string }>()
    if (hqProjectDept?.id) {
      actualDepartmentId = hqProjectDept.id
    } else {
      const systemService = new SystemService(c.env.DB)
      const hq = await systemService.getOrCreateDefaultHQ()
      const newDeptId = uuid()
      await c.env.DB.prepare('insert into departments(id,hq_id,name,active) values(?,?,?,1)')
        .bind(newDeptId, hq.id, '总部').run()
      actualDepartmentId = newDeptId
    }

    const now = Date.now()
    const results: any[] = []

    // 5. 为admin创建员工记录
    const existingAdminEmployee = await c.env.DB.prepare('select id from employees where email=?').bind(ADMIN_EMAIL_ADDR).first<{ id: string }>()
    if (existingAdminEmployee) {
      results.push({ user: 'admin', status: 'already_exists', employee_id: existingAdminEmployee.id })
    } else {
      const adminEmployeeId = uuid()
      await c.env.DB.prepare(`
        insert into employees(
          id, name, department_id, org_department_id, position_id, join_date, 
          probation_salary_cents, regular_salary_cents,
          living_allowance_cents, housing_allowance_cents,
          transportation_allowance_cents, meal_allowance_cents,
          status, active, phone, email, usdt_address,
          emergency_contact, emergency_phone, address, memo,
          birthday, created_at, updated_at
        ) values(?,?,?,?,?,?,?,?,?,?,?,?,'regular',1,?,?,?,?,?,?,?,?,?,?,?)
      `).bind(
        adminEmployeeId, adminUser.name || adminUser.email, actualDepartmentId, hqDept.id, hqAdminPosition.id, '2022-01-01',
        0, 0, 0, 0, 0, 0,
        null, adminUser.email, null, null, null, null, null,
        '1990-01-01', now, now
      ).run()

      await c.env.DB.prepare('update users set position_id=?, department_id=?, org_department_id=? where id=?')
        .bind(hqAdminPosition.id, actualDepartmentId, hqDept.id, adminUser.id).run()

      const existingUd = await c.env.DB.prepare('select id from user_departments where user_id=? and department_id=?').bind(adminUser.id, actualDepartmentId).first<{ id: string }>()
      if (!existingUd) {
        const udId = uuid()
        await c.env.DB.prepare('insert into user_departments(id,user_id,department_id,created_at) values(?,?,?,?)')
          .bind(udId, adminUser.id, actualDepartmentId, now).run()
      }

      results.push({ user: 'admin', status: 'created', employee_id: adminEmployeeId })
    }

    // 6. 为magi创建员工记录
    const existingMagiEmployee = await c.env.DB.prepare('select id from employees where email=?').bind(MAGI_EMAIL_ADDR).first<{ id: string }>()
    if (existingMagiEmployee) {
      results.push({ user: 'magi', status: 'already_exists', employee_id: existingMagiEmployee.id })
    } else {
      const magiEmployeeId = uuid()
      await c.env.DB.prepare(`
        insert into employees(
          id, name, department_id, org_department_id, position_id, join_date, 
          probation_salary_cents, regular_salary_cents,
          living_allowance_cents, housing_allowance_cents,
          transportation_allowance_cents, meal_allowance_cents,
          status, active, phone, email, usdt_address,
          emergency_contact, emergency_phone, address, memo,
          birthday, created_at, updated_at
        ) values(?,?,?,?,?,?,?,?,?,?,?,?,'regular',1,?,?,?,?,?,?,?,?,?,?,?)
      `).bind(
        magiEmployeeId, magiUser.name || magiUser.email, actualDepartmentId, hqDept.id, hqAdminPosition.id, '2022-11-02',
        0, 0, 0, 0, 0, 0,
        null, magiUser.email, null, null, null, null, null,
        '1990-01-01', now, now
      ).run()

      await c.env.DB.prepare('update users set position_id=?, department_id=?, org_department_id=? where id=?')
        .bind(hqAdminPosition.id, actualDepartmentId, hqDept.id, magiUser.id).run()

      const existingUd2 = await c.env.DB.prepare('select id from user_departments where user_id=? and department_id=?').bind(magiUser.id, actualDepartmentId).first<{ id: string }>()
      if (!existingUd2) {
        const udId2 = uuid()
        await c.env.DB.prepare('insert into user_departments(id,user_id,department_id,created_at) values(?,?,?,?)')
          .bind(udId2, magiUser.id, actualDepartmentId, now).run()
      }

      results.push({ user: 'magi', status: 'created', employee_id: magiEmployeeId })
    }

    return c.json({ success: true, results })
  } catch (error: any) {
    console.error('Migration error:', error)
    throw Errors.INTERNAL_ERROR(error.message || '迁移失败')
  }
})

// 员工管理 - 创建
employeesRoutes.post('/employees', validateJson(createEmployeeSchema), async (c) => {
  // 有员工创建权限的人可以创建员工
  if (!hasPermission(c, 'hr', 'employee', 'create')) throw Errors.FORBIDDEN()
  const body = getValidatedData<z.infer<typeof createEmployeeSchema>>(c)

  // 从部门信息中获取项目ID和允许的职位列表
  const orgDept = await c.env.DB.prepare('select project_id, allowed_positions from org_departments where id=?').bind(body.org_department_id).first<{ project_id: string | null, allowed_positions: string | null }>()
  if (!orgDept) {
    throw Errors.NOT_FOUND('组织部门')
  }

  // 验证职位是否在部门允许的职位列表中
  if (body.position_id && orgDept.allowed_positions) {
    try {
      const allowedPositions = JSON.parse(orgDept.allowed_positions) as string[]
      if (Array.isArray(allowedPositions) && allowedPositions.length > 0) {
        if (!allowedPositions.includes(body.position_id)) {
          throw Errors.BUSINESS_ERROR('所选职位不在该部门允许的职位列表中')
        }
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes('不在该部门允许')) throw e
      // JSON解析失败，不做限制
    }
  }

  // 根据部门的project_id确定department_id
  let actualDepartmentId: string
  if (orgDept.project_id === null) {
    // 总部部门：查找或创建"总部"项目
    const hqDept = await c.env.DB.prepare('select id from departments where name=? and active=1 limit 1').bind('总部').first<{ id: string }>()
    if (hqDept?.id) {
      actualDepartmentId = hqDept.id
    } else {
      // 如果没有"总部"项目，创建一个
      const systemService = new SystemService(c.env.DB)
      const hq = await systemService.getOrCreateDefaultHQ()
      const newDeptId = uuid()
      await c.env.DB.prepare('insert into departments(id,hq_id,name,active) values(?,?,?,1)')
        .bind(newDeptId, hq.id, '总部').run()
      actualDepartmentId = newDeptId
    }
  } else {
    // 项目部门：使用部门的project_id
    actualDepartmentId = orgDept.project_id
  }

  // 如果前端也提供了department_id，验证是否一致
  if (body.department_id && body.department_id !== actualDepartmentId && body.department_id !== 'hq') {
    throw Errors.BUSINESS_ERROR('department_id与org_department不匹配')
  }

  // 验证项目是否存在
  const dept = await c.env.DB.prepare('select id from departments where id=?').bind(actualDepartmentId).first<{ id: string }>()
  if (!dept) throw Errors.NOT_FOUND('项目')

  // 检查姓名是否重复（同一项目内）
  const existed = await c.env.DB.prepare('select id from employees where name=? and department_id=?').bind(body.name, actualDepartmentId).first<{ id: string }>()
  if (existed?.id) throw Errors.DUPLICATE('员工姓名（同一项目内）')

  // 检查邮箱是否已存在用户账号
  const userService = new UserService(c.env.DB)
  const existingUser = await userService.getUserByEmail(body.email)
  if (existingUser) throw Errors.DUPLICATE('邮箱（用户系统中已存在）')

  const id = uuid()
  const userId = c.get('userId') as string | undefined
  const now = Date.now()

  // 准备批量执行的语句
  const statements: D1PreparedStatement[] = []

  // 1. 创建员工记录
  statements.push(c.env.DB.prepare(`
    insert into employees(
      id, name, department_id, org_department_id, position_id, join_date, 
      probation_salary_cents, regular_salary_cents,
      living_allowance_cents, housing_allowance_cents,
      transportation_allowance_cents, meal_allowance_cents,
      status, active, phone, email, usdt_address,
      emergency_contact, emergency_phone, address, memo,
      birthday, work_schedule, annual_leave_cycle_months, annual_leave_days, created_at, updated_at
    ) values(?,?,?,?,?,?,?,?,?,?,?,?,'probation',1,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    id, body.name, actualDepartmentId, body.org_department_id || null, body.position_id || null, body.join_date,
    body.probation_salary_cents, body.regular_salary_cents,
    body.living_allowance_cents || 0,
    body.housing_allowance_cents || 0,
    body.transportation_allowance_cents || 0,
    body.meal_allowance_cents || 0,
    body.phone || null, body.email, body.usdt_address || null,
    body.emergency_contact || null, body.emergency_phone || null,
    body.address || null, body.memo || null,
    body.birthday || null,
    now, now
  ))

  // 创建对应的员工账号
  // 总是生成随机密码
  const password = generateRandomPassword(12)
  const hash = await bcrypt.hash(password, 10)
  const userAccountId = uuid()

  // 2. 创建用户账号，设置must_change_password=1要求首次登录修改密码
  // 注意: name字段已移至employees表，不再在users表中存储
  statements.push(c.env.DB.prepare('insert into users(id,email,password_hash,department_id,position_id,active,must_change_password,password_changed,created_at) values(?,?,?,?,?,?,?,?,?)')
    .bind(userAccountId, body.email, hash, actualDepartmentId, body.position_id, 1, 1, 0, now))

  // 3. 如果项目存在，插入到user_departments表
  const udId = uuid()
  statements.push(c.env.DB.prepare('insert into user_departments(id,user_id,department_id,created_at) values(?,?,?,?)')
    .bind(udId, userAccountId, actualDepartmentId, now))

  // 4. 如果提供了多币种底薪配置，创建对应的记录
  if (body.probation_salaries && Array.isArray(body.probation_salaries) && body.probation_salaries.length > 0) {
    for (const salary of body.probation_salaries) {
      if (salary.currency_id && salary.amount_cents !== undefined && salary.amount_cents !== null) {
        // 验证币种是否存在
        const currency = await c.env.DB.prepare('select code from currencies where code=?').bind(salary.currency_id).first<{ code: string }>()
        if (currency) {
          const salaryId = uuid()
          statements.push(c.env.DB.prepare(`
            insert into employee_salaries(
              id, employee_id, salary_type, currency_id, amount_cents, created_at, updated_at
            ) values(?,?,?,?,?,?,?)
          `).bind(salaryId, id, 'probation', salary.currency_id, salary.amount_cents, now, now))
        }
      }
    }
  }

  if (body.regular_salaries && Array.isArray(body.regular_salaries) && body.regular_salaries.length > 0) {
    for (const salary of body.regular_salaries) {
      if (salary.currency_id && salary.amount_cents !== undefined && salary.amount_cents !== null) {
        // 验证币种是否存在
        const currency = await c.env.DB.prepare('select code from currencies where code=?').bind(salary.currency_id).first<{ code: string }>()
        if (currency) {
          const salaryId = uuid()
          statements.push(c.env.DB.prepare(`
            insert into employee_salaries(
              id, employee_id, salary_type, currency_id, amount_cents, created_at, updated_at
            ) values(?,?,?,?,?,?,?)
          `).bind(salaryId, id, 'regular', salary.currency_id, salary.amount_cents, now, now))
        }
      }
    }
  }

  // 执行批量事务
  await c.env.DB.batch(statements)

  logAuditAction(c, 'create', 'employee', id, JSON.stringify({ name: body.name, department_id: actualDepartmentId, email: body.email }))
  logAuditAction(c, 'create', 'user', userAccountId, JSON.stringify({ email: body.email, department_id: actualDepartmentId }))

  // 发送账号信息邮件（使用 waitUntil 确保异步任务完成）
  const loginUrl = c.req.header('origin') || 'https://cloudflarets.com'
  let emailSent = false
  if (c.executionCtx?.waitUntil) {
    c.executionCtx.waitUntil(
      sendNewEmployeeAccountEmail(c.env, body.email, body.name, password, loginUrl)
        .then(result => {
          if (result.success) {
            emailSent = true
          } else {
            console.error(`[Employee] Failed to send account email to ${body.email}:`, result.error)
          }
        })
        .catch(error => {
          console.error(`[Employee] Error sending account email to ${body.email}:`, error)
        })
    )
    // 标记邮件已发送（实际发送是异步的，但我们已经安排了发送任务）
    emailSent = true
  } else {
    // 如果没有waitUntil，尝试同步发送（不推荐，但确保邮件能发送）
    try {
      const result = await sendNewEmployeeAccountEmail(c.env, body.email, body.name, password, loginUrl)
      emailSent = result.success
      if (!result.success) {
        console.error(`[Employee] Failed to send account email to ${body.email}:`, result.error)
      }
    } catch (error) {
      console.error(`[Employee] Error sending account email to ${body.email}:`, error)
    }
  }

  const created = await c.env.DB.prepare(`
    select 
      e.*,
      d.name as department_name,
      od.name as org_department_name,
      od.code as org_department_code
    from employees e
    left join departments d on e.department_id = d.id
    left join org_departments od on e.org_department_id = od.id
    where e.id=?
  `).bind(id).first()
  return c.json({ ...created, user_account_created: true, email_sent: emailSent })
})

// 员工管理 - 更新
employeesRoutes.put('/employees/:id', validateJson(updateEmployeeSchema), async (c) => {
  // 有员工更新权限的人可以更新员工
  if (!hasPermission(c, 'hr', 'employee', 'update')) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  const body = getValidatedData<z.infer<typeof updateEmployeeSchema>>(c)

  const record = await c.env.DB.prepare('select * from employees where id=?').bind(id).first<any>()
  if (!record) throw Errors.NOT_FOUND('员工')

  // 如果更新项目，验证项目是否存在，并处理总部
  if (body.department_id && body.department_id !== record.department_id) {
    let actualDepartmentId = body.department_id
    if (body.department_id === 'hq') {
      const hqDept = await c.env.DB.prepare('select id from departments where name=? and active=1 limit 1').bind('总部').first<{ id: string }>()
      if (hqDept?.id) {
        actualDepartmentId = hqDept.id
      } else {
        // 如果没有"总部"项目，创建一个
        const systemService = new SystemService(c.env.DB)
        const hq = await systemService.getOrCreateDefaultHQ()
        const newDeptId = uuid()
        await c.env.DB.prepare('insert into departments(id,hq_id,name,active) values(?,?,?,1)')
          .bind(newDeptId, hq.id, '总部').run()
        actualDepartmentId = newDeptId
      }
    }
    const dept = await c.env.DB.prepare('select id from departments where id=?').bind(actualDepartmentId).first<{ id: string }>()
    if (!dept) throw Errors.NOT_FOUND('项目')
    // 更新department_id为实际的ID
    body.department_id = actualDepartmentId
  }

  // 如果更新组织部门，验证它是否存在且属于当前项目（或新项目）
  if (body.org_department_id !== undefined) {
    const targetDeptId = body.department_id || record.department_id
    if (body.org_department_id) {
      const orgDept = await c.env.DB.prepare('select project_id, allowed_positions from org_departments where id=?').bind(body.org_department_id).first<{ project_id: string, allowed_positions: string | null }>()
      if (!orgDept) {
        throw Errors.NOT_FOUND('组织部门')
      }
      // 如果组织部门的project_id为null（总部直属部门），则targetDeptId应该是"总部"项目
      if (orgDept.project_id !== targetDeptId && orgDept.project_id !== null) {
        throw Errors.BUSINESS_ERROR('组织部门必须属于指定的项目')
      }
      // 如果组织部门属于总部（project_id为null），但员工的项目不是总部，则不允许
      if (orgDept.project_id === null && targetDeptId !== 'hq') {
        // 检查targetDeptId是否是"总部"项目
        const targetDept = await c.env.DB.prepare('select name from departments where id=?').bind(targetDeptId).first<{ name: string }>()
        if (targetDept?.name !== '总部') {
          throw Errors.BUSINESS_ERROR('组织部门属于总部，但员工项目不是总部')
        }
      }
      // 验证职位是否在部门允许的职位列表中
      const positionToCheck = body.position_id !== undefined ? body.position_id : record.position_id
      if (positionToCheck && orgDept.allowed_positions) {
        try {
          const allowedPositions = JSON.parse(orgDept.allowed_positions) as string[]
          if (Array.isArray(allowedPositions) && allowedPositions.length > 0) {
            if (!allowedPositions.includes(positionToCheck)) {
              throw Errors.BUSINESS_ERROR('所选职位不在该部门允许的职位列表中')
            }
          }
        } catch (e) {
          if (e instanceof Error && e.message.includes('不在该部门允许')) throw e
        }
      }
    }
  }

  // 如果只更新职位但不更新部门，也需要验证
  if (body.position_id !== undefined && body.org_department_id === undefined && record.org_department_id) {
    const orgDept = await c.env.DB.prepare('select allowed_positions from org_departments where id=?').bind(record.org_department_id).first<{ allowed_positions: string | null }>()
    if (orgDept?.allowed_positions) {
      try {
        const allowedPositions = JSON.parse(orgDept.allowed_positions) as string[]
        if (Array.isArray(allowedPositions) && allowedPositions.length > 0) {
          if (!allowedPositions.includes(body.position_id)) {
            throw Errors.BUSINESS_ERROR('所选职位不在该部门允许的职位列表中')
          }
        }
      } catch (e) {
        if (e instanceof Error && e.message.includes('不在该部门允许')) throw e
      }
    }
  }

  // 如果更新姓名，检查是否重复（同一项目内）
  if (body.name && body.name !== record.name) {
    const deptId = body.department_id || record.department_id
    const existed = await c.env.DB.prepare('select id from employees where name=? and department_id=? and id!=?').bind(body.name, deptId, id).first<{ id: string }>()
    if (existed?.id) throw Errors.DUPLICATE('员工姓名（同一项目内）')
  }

  const updates: string[] = []
  const binds: any[] = []
  if (body.name !== undefined) { updates.push('name=?'); binds.push(body.name) }
  if (body.department_id !== undefined) { updates.push('department_id=?'); binds.push(body.department_id) }
  if (body.org_department_id !== undefined) { updates.push('org_department_id=?'); binds.push(body.org_department_id || null) }
  if (body.position_id !== undefined) { updates.push('position_id=?'); binds.push(body.position_id || null) }
  if (body.join_date !== undefined) { updates.push('join_date=?'); binds.push(body.join_date) }
  if (body.probation_salary_cents !== undefined) { updates.push('probation_salary_cents=?'); binds.push(body.probation_salary_cents) }
  if (body.regular_salary_cents !== undefined) { updates.push('regular_salary_cents=?'); binds.push(body.regular_salary_cents) }
  if (body.living_allowance_cents !== undefined) { updates.push('living_allowance_cents=?'); binds.push(body.living_allowance_cents) }
  if (body.housing_allowance_cents !== undefined) { updates.push('housing_allowance_cents=?'); binds.push(body.housing_allowance_cents) }
  if (body.transportation_allowance_cents !== undefined) { updates.push('transportation_allowance_cents=?'); binds.push(body.transportation_allowance_cents) }
  if (body.meal_allowance_cents !== undefined) { updates.push('meal_allowance_cents=?'); binds.push(body.meal_allowance_cents) }
  if (body.active !== undefined) { updates.push('active=?'); binds.push(body.active) }
  if (body.phone !== undefined) { updates.push('phone=?'); binds.push(body.phone || null) }
  if (body.email !== undefined) { updates.push('email=?'); binds.push(body.email || null) }
  if (body.usdt_address !== undefined) { updates.push('usdt_address=?'); binds.push(body.usdt_address || null) }
  if (body.emergency_contact !== undefined) { updates.push('emergency_contact=?'); binds.push(body.emergency_contact || null) }
  if (body.emergency_phone !== undefined) { updates.push('emergency_phone=?'); binds.push(body.emergency_phone || null) }
  if (body.address !== undefined) { updates.push('address=?'); binds.push(body.address || null) }
  if (body.memo !== undefined) { updates.push('memo=?'); binds.push(body.memo || null) }
  if (body.birthday !== undefined) { updates.push('birthday=?'); binds.push(body.birthday || null) }
  if (body.work_schedule !== undefined) { updates.push('work_schedule=?'); binds.push(body.work_schedule ? JSON.stringify(body.work_schedule) : null) }
  if (body.annual_leave_cycle_months !== undefined) { updates.push('annual_leave_cycle_months=?'); binds.push(body.annual_leave_cycle_months) }
  if (body.annual_leave_days !== undefined) { updates.push('annual_leave_days=?'); binds.push(body.annual_leave_days) }

  if (updates.length === 0) {
    const current = await c.env.DB.prepare(`
      select 
        e.*,
        d.name as department_name,
        od.name as org_department_name,
        od.code as org_department_code,
        p.id as position_id,
        p.code as position_code,
        p.name as position_name,
        p.level as position_level,
        p.function_role as position_function_role
      from employees e
      left join departments d on e.department_id = d.id
      left join org_departments od on e.org_department_id = od.id
      left join positions p on p.id = e.position_id and p.active = 1
      where e.id=?
    `).bind(id).first()
    return c.json(current)
  }

  updates.push('updated_at=?')
  binds.push(Date.now())
  binds.push(id)
  await c.env.DB.prepare(`update employees set ${updates.join(',')} where id=?`).bind(...binds).run()

  // 如果更新了 department_id、org_department_id 或 position_id，同步更新用户账号
  if (body.department_id !== undefined || body.org_department_id !== undefined || body.position_id !== undefined) {
    try {
      const updatedEmployee = await c.env.DB.prepare('select email, department_id, org_department_id, position_id from employees where id=?').bind(id).first<{ email: string | null, department_id: string | null, org_department_id: string | null, position_id: string | null }>()
      if (updatedEmployee?.email) {
        const userUpdateFields: string[] = []
        const userUpdateBinds: any[] = []

        if (body.department_id !== undefined) {
          userUpdateFields.push('department_id=?')
          userUpdateBinds.push(updatedEmployee.department_id)
        }
        if (body.org_department_id !== undefined) {
          userUpdateFields.push('org_department_id=?')
          userUpdateBinds.push(updatedEmployee.org_department_id)
        }
        if (body.position_id !== undefined) {
          userUpdateFields.push('position_id=?')
          userUpdateBinds.push(updatedEmployee.position_id)
        }

        if (userUpdateFields.length > 0) {
          userUpdateBinds.push(updatedEmployee.email)
          await c.env.DB.prepare(`update users set ${userUpdateFields.join(',')} where email=?`).bind(...userUpdateBinds).run()

          // 如果更新了 department_id，更新 user_departments 表
          if (body.department_id !== undefined && updatedEmployee.department_id) {
            const user = await c.env.DB.prepare('select id from users where email=?').bind(updatedEmployee.email).first<{ id: string }>()
            if (user?.id) {
              const existingUd = await c.env.DB.prepare('select id from user_departments where user_id=? and department_id=?').bind(user.id, updatedEmployee.department_id).first<{ id: string }>()
              if (!existingUd) {
                const udId = uuid()
                await c.env.DB.prepare('insert into user_departments(id,user_id,department_id,created_at) values(?,?,?,?)')
                  .bind(udId, user.id, updatedEmployee.department_id, Date.now()).run()
              }
            }
          }
        }
      }
    } catch (error: any) {
      console.error('Error syncing user account in PUT /employees/:id:', {
        error: error.message,
        errorStack: error.stack,
        employeeId: id,
        body: {
          department_id: body.department_id,
          org_department_id: body.org_department_id,
          position_id: body.position_id
        }
      })
      // 不抛出错误，只记录日志，因为员工信息已经更新成功
    }
  }

  logAuditAction(c, 'update', 'employee', id, JSON.stringify(body))
  const updated = await c.env.DB.prepare(`
    select 
      e.*,
      d.name as department_name,
      od.name as org_department_name,
      od.code as org_department_code,
      p.id as position_id,
      p.code as position_code,
      p.name as position_name,
      p.level as position_level,
      p.function_role as position_function_role
    from employees e
    left join departments d on e.department_id = d.id
    left join org_departments od on e.org_department_id = od.id
    left join positions p on p.id = e.position_id and p.active = 1
    where e.id=?
  `).bind(id).first()
  return c.json(updated)
})

// 员工管理 - 转正
employeesRoutes.post('/employees/:id/regularize', validateJson(regularizeEmployeeSchema), async (c) => {
  // 有员工更新权限的人可以转正员工
  if (!hasPermission(c, 'hr', 'employee', 'update')) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  const body = getValidatedData<z.infer<typeof regularizeEmployeeSchema>>(c)

  const record = await c.env.DB.prepare('select * from employees where id=?').bind(id).first<any>()
  if (!record) throw Errors.NOT_FOUND('员工')

  if (record.status === 'regular') {
    throw Errors.BUSINESS_ERROR('员工已经转正')
  }

  await c.env.DB.prepare('update employees set status=?, regular_date=?, updated_at=? where id=?')
    .bind('regular', body.regular_date, Date.now(), id).run()

  logAuditAction(c, 'update', 'employee', id, JSON.stringify({ action: 'regularize', regular_date: body.regular_date }))
  const updated = await c.env.DB.prepare(`
    select 
      e.*,
      d.name as department_name,
      od.name as org_department_name,
      od.code as org_department_code
    from employees e
    left join departments d on e.department_id = d.id
    left join org_departments od on e.org_department_id = od.id
    where e.id=?
  `).bind(id).first()
  return c.json(updated)
})

// 员工管理 - 离职
employeesRoutes.post('/employees/:id/leave', validateJson(leaveEmployeeSchema), async (c) => {
  // 有员工更新权限的人可以办理离职
  if (!hasPermission(c, 'hr', 'employee', 'update')) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  const body = getValidatedData<z.infer<typeof leaveEmployeeSchema>>(c)

  const record = await c.env.DB.prepare('select * from employees where id=?').bind(id).first<any>()
  if (!record) throw Errors.NOT_FOUND('员工')

  if (record.status === 'resigned') {
    throw Errors.BUSINESS_ERROR('员工已经离职')
  }

  const userId = c.get('userId') as string | undefined
  const now = Date.now()

  // 更新员工状态为离职
  await c.env.DB.prepare(`
    update employees 
    set status=?, leave_date=?, leave_reason=?, leave_type=?, leave_memo=?, updated_at=?
    where id=?
  `).bind(
    'resigned',
    body.leave_date,
    body.leave_reason || null,
    body.leave_type,
    body.leave_memo || null,
    now,
    id
  ).run()

  // 如果选择禁用账号，更新对应的用户账号状态
  if (body.disable_account !== false && record.email) {
    await c.env.DB.prepare('update users set active=0 where email=?').bind(record.email).run()
  }

  logAuditAction(c, 'leave', 'employee', id, JSON.stringify({
    leave_date: body.leave_date,
    leave_type: body.leave_type,
    leave_reason: body.leave_reason,
    disable_account: body.disable_account !== false
  }))

  const updated = await c.env.DB.prepare(`
    select 
      e.*,
      d.name as department_name,
      od.name as org_department_name,
      od.code as org_department_code
    from employees e
    left join departments d on e.department_id = d.id
    left join org_departments od on e.org_department_id = od.id
    where e.id=?
  `).bind(id).first()

  return c.json(updated)
})

// 员工管理 - 撤销离职（重新入职）
employeesRoutes.post('/employees/:id/rejoin', async (c) => {
  // 有员工更新权限的人可以办理重新入职
  if (!hasPermission(c, 'hr', 'employee', 'update')) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  const body = await c.req.json<{
    join_date?: string  // 新的入职日期，如果不提供则使用原入职日期
    enable_account?: boolean  // 是否启用账号
  }>()

  const record = await c.env.DB.prepare('select * from employees where id=?').bind(id).first<any>()
  if (!record) throw Errors.NOT_FOUND('员工')

  if (record.status !== 'resigned') {
    throw Errors.BUSINESS_ERROR('员工未离职，无法重新入职')
  }

  const userId = c.get('userId') as string | undefined
  const now = Date.now()

  // 判断员工状态：如果原状态是regular，恢复为regular；否则恢复为probation
  const newStatus = record.regular_date ? 'regular' : 'probation'
  const newJoinDate = body.join_date || record.join_date

  // 更新员工状态
  await c.env.DB.prepare(`
    update employees 
    set status=?, join_date=?, leave_date=?, leave_reason=?, leave_type=?, leave_memo=?, updated_at=?
    where id=?
  `).bind(
    newStatus,
    newJoinDate,
    null,  // 清空离职相关字段
    null,
    null,
    null,
    now,
    id
  ).run()

  // 如果选择启用账号，更新对应的用户账号状态
  if (body.enable_account !== false && record.email) {
    await c.env.DB.prepare('update users set active=1 where email=?').bind(record.email).run()
  }

  logAuditAction(c, 'rejoin', 'employee', id, JSON.stringify({
    join_date: newJoinDate,
    status: newStatus,
    enable_account: body.enable_account !== false
  }))

  const updated = await c.env.DB.prepare(`
    select 
      e.*,
      d.name as department_name,
      od.name as org_department_name,
      od.code as org_department_code
    from employees e
    left join departments d on e.department_id = d.id
    left join org_departments od on e.org_department_id = od.id
    where e.id=?
  `).bind(id).first()

  return c.json(updated)
})

// 员工管理 - 删除

employeesRoutes.delete('/employees/:id', async (c) => {
  if (!hasPermission(c, 'hr', 'employee', 'delete')) throw Errors.FORBIDDEN()
  const id = c.req.param('id')

  const record = await c.env.DB.prepare('select * from employees where id=?').bind(id).first<any>()
  if (!record) throw Errors.NOT_FOUND('员工')

  await c.env.DB.prepare('delete from employees where id=?').bind(id).run()

  logAuditAction(c, 'delete', 'employee', id, JSON.stringify({ name: record.name }))
  return c.json({ ok: true })
})

// 员工请假管理 - 列表

employeesRoutes.get('/employee-leaves', validateQuery(employeeLeaveQuerySchema), async (c) => {
  if (!getUserPosition(c)) throw Errors.FORBIDDEN()
  const query = getValidatedQuery<z.infer<typeof employeeLeaveQuerySchema>>(c)
  const employeeId = query.employee_id
  const startDate = query.start_date
  const endDate = query.end_date
  const userId = getUserId(c)

  let sql = `
    select 
      l.*,
      e.name as employee_name,
      e.department_id,
      d.name as department_name,
      e1.name as creator_name,
      e2.name as approver_name
    from employee_leaves l
    left join employees e on e.id = l.employee_id
    left join departments d on d.id = e.department_id
    left join users u1 on u1.id = l.created_by
    left join employees e1 on e1.email = u1.email
    left join users u2 on u2.id = l.approved_by
    left join employees e2 on e2.email = u2.email
    where 1=1
  `
  const binds: any[] = []

  // 组员只能查看自己创建的请假记录（通过employee_id关联）
  // 组员只能查看自己的请假记录
  if (isTeamMember(c) && userId) {
    const userService = new UserService(c.env.DB)
    const userEmployeeId = await userService.getUserEmployeeId(userId)
    if (userEmployeeId) {
      sql += ' and l.employee_id = ?'
      binds.push(userEmployeeId)
    } else {
      // 如果没有找到对应的employee记录，返回空结果
      return c.json({ results: [] })
    }
  } else if (employeeId) {
    sql += ' and l.employee_id = ?'
    binds.push(employeeId)
  }

  if (startDate) {
    sql += ' and l.start_date >= ?'
    binds.push(startDate)
  }

  if (endDate) {
    sql += ' and l.end_date <= ?'
    binds.push(endDate)
  }

  sql += ' order by l.start_date desc, l.created_at desc'

  const rows = await c.env.DB.prepare(sql).bind(...binds).all()
  return c.json({ results: rows.results ?? [] })
})

// 员工请假管理 - 创建
employeesRoutes.post('/employee-leaves', validateJson(createEmployeeLeaveSchema), async (c) => {
  // 组员可以创建自己的请假，hr和finance可以创建任何人的请假
  if (!getUserPosition(c)) throw Errors.FORBIDDEN()
  const body = getValidatedData<z.infer<typeof createEmployeeLeaveSchema>>(c)

  // 组员角色只能为自己创建请假（通过email匹配验证）
  if (isTeamMember(c)) {
    const userId = getUserId(c)
    if (userId) {
      const user = await c.env.DB.prepare('select email from users where id=?').bind(userId).first<{ email: string }>()
      const emp = await c.env.DB.prepare('select id, email from employees where id=?').bind(body.employee_id).first<{ id: string, email: string }>()
      if (user?.email && emp?.email && user.email !== emp.email) {
        throw Errors.FORBIDDEN('员工只能为自己创建请假')
      }
    }
  }

  // 验证员工是否存在
  const emp = await c.env.DB.prepare('select id, join_date from employees where id=?').bind(body.employee_id).first<{ id: string, join_date: string }>()
  if (!emp) throw Errors.NOT_FOUND('员工')

  // 如果是年假，校验是否超额
  if (body.leave_type === 'annual' && emp.join_date) {
    const validation = await validateAnnualLeaveRequest(c.env.DB, body.employee_id, emp.join_date, body.days)
    if (!validation.valid) {
      throw Errors.BUSINESS_ERROR(validation.message || '年假校验失败')
    }
  }

  const id = uuid()
  const userId = c.get('userId') as string | undefined
  const now = Date.now()

  await c.env.DB.prepare(`
    insert into employee_leaves(
      id, employee_id, leave_type, start_date, end_date, days,
      status, reason, memo, created_by, created_at, updated_at
    ) values(?,?,?,?,?,?,'pending',?,?,?,?,?)
  `).bind(
    id, body.employee_id, body.leave_type, body.start_date, body.end_date,
    body.days, body.reason || null, body.memo || null, userId || null, now, now
  ).run()

  logAuditAction(c, 'create', 'employee_leave', id, JSON.stringify({
    employee_id: body.employee_id,
    leave_type: body.leave_type,
    start_date: body.start_date,
    end_date: body.end_date,
    days: body.days
  }))

  const created = await c.env.DB.prepare(`
    select 
      l.*,
      e.name as employee_name,
      e.department_id,
      d.name as department_name,
      e1.name as creator_name,
      e2.name as approver_name
    from employee_leaves l
    left join employees e on e.id = l.employee_id
    left join departments d on d.id = e.department_id
    left join users u1 on u1.id = l.created_by
    left join employees e1 on e1.email = u1.email
    left join users u2 on u2.id = l.approved_by
    left join employees e2 on e2.email = u2.email
    where l.id=?
  `).bind(id).first()

  return c.json(created)
})

// 员工请假管理 - 更新
employeesRoutes.put('/employee-leaves/:id', async (c) => {
  // 组员可以更新自己的待审批请假，hr和finance可以更新任何人的待审批请假
  if (!getUserPosition(c)) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  const body = await c.req.json<{
    leave_type?: string
    start_date?: string
    end_date?: string
    days?: number
    reason?: string
    memo?: string
  }>()

  const record = await c.env.DB.prepare('select * from employee_leaves where id=?').bind(id).first<any>()
  if (!record) throw Errors.NOT_FOUND('请假记录')

  // 组员角色只能更新自己创建的待审批请假
  const userId = getUserId(c)
  if (isTeamMember(c) && record.created_by !== userId) {
    throw Errors.FORBIDDEN('员工只能更新自己创建的请假')
  }

  // 已审批的记录不允许修改
  if (record.status !== 'pending') {
    throw Errors.BUSINESS_ERROR('已审批或已拒绝的请假不能修改')
  }

  const updates: string[] = []
  const binds: any[] = []

  if (body.leave_type !== undefined) { updates.push('leave_type=?'); binds.push(body.leave_type) }
  if (body.start_date !== undefined) { updates.push('start_date=?'); binds.push(body.start_date) }
  if (body.end_date !== undefined) { updates.push('end_date=?'); binds.push(body.end_date) }
  if (body.days !== undefined) { updates.push('days=?'); binds.push(body.days) }
  if (body.reason !== undefined) { updates.push('reason=?'); binds.push(body.reason || null) }
  if (body.memo !== undefined) { updates.push('memo=?'); binds.push(body.memo || null) }

  if (updates.length === 0) throw Errors.VALIDATION_ERROR('没有需要更新的字段')

  updates.push('updated_at=?')
  binds.push(Date.now())
  binds.push(id)

  await c.env.DB.prepare(`update employee_leaves set ${updates.join(',')} where id=?`).bind(...binds).run()

  logAuditAction(c, 'update', 'employee_leave', id, JSON.stringify(body))

  const updated = await c.env.DB.prepare(`
    select 
      l.*,
      e.name as employee_name,
      e.department_id,
      d.name as department_name,
      e1.name as creator_name,
      e2.name as approver_name
    from employee_leaves l
    left join employees e on e.id = l.employee_id
    left join departments d on d.id = e.department_id
    left join users u1 on u1.id = l.created_by
    left join employees e1 on e1.email = u1.email
    left join users u2 on u2.id = l.approved_by
    left join employees e2 on e2.email = u2.email
    where l.id=?
  `).bind(id).first()

  return c.json(updated)
})

// 员工请假管理 - 审批
employeesRoutes.post('/employee-leaves/:id/approve', validateJson(approveEmployeeLeaveSchema), async (c) => {
  // 有请假审批权限的人可以审批请假
  if (!hasPermission(c, 'hr', 'leave', 'approve')) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  const body = getValidatedData<z.infer<typeof approveEmployeeLeaveSchema>>(c)

  const record = await c.env.DB.prepare('select * from employee_leaves where id=?').bind(id).first<any>()
  if (!record) throw Errors.NOT_FOUND('请假记录')

  if (record.status !== 'pending') {
    throw Errors.BUSINESS_ERROR('请假已处理')
  }

  const userId = c.get('userId') as string | undefined
  const now = Date.now()

  await c.env.DB.prepare(`
    update employee_leaves 
    set status=?, approved_by=?, approved_at=?, updated_at=?, memo=?
    where id=?
  `).bind(
    body.status,
    userId || null,
    now,
    now,
    body.memo || record.memo || null,
    id
  ).run()

  logAuditAction(c, 'approve', 'employee_leave', id, JSON.stringify({
    status: body.status,
    memo: body.memo
  }))

  const updated = await c.env.DB.prepare(`
    select 
      l.*,
      e.name as employee_name,
      e.department_id,
      d.name as department_name,
      e1.name as creator_name,
      e2.name as approver_name
    from employee_leaves l
    left join employees e on e.id = l.employee_id
    left join departments d on d.id = e.department_id
    left join users u1 on u1.id = l.created_by
    left join employees e1 on e1.email = u1.email
    left join users u2 on u2.id = l.approved_by
    left join employees e2 on e2.email = u2.email
    where l.id=?
  `).bind(id).first()

  return c.json(updated)
})

// 员工请假管理 - 删除

employeesRoutes.delete('/employee-leaves/:id', async (c) => {
  if (!hasPermission(c, 'hr', 'leave', 'approve')) throw Errors.FORBIDDEN()
  const id = c.req.param('id')

  const record = await c.env.DB.prepare('select * from employee_leaves where id=?').bind(id).first<any>()
  if (!record) throw Errors.NOT_FOUND('请假记录')

  await c.env.DB.prepare('delete from employee_leaves where id=?').bind(id).run()

  logAuditAction(c, 'delete', 'employee_leave', id, JSON.stringify({
    employee_id: record.employee_id,
    start_date: record.start_date,
    end_date: record.end_date
  }))

  return c.json({ ok: true })
})

// 员工报销管理 - 列表

employeesRoutes.get('/expense-reimbursements', validateQuery(expenseReimbursementQuerySchema), async (c) => {
  if (!getUserPosition(c)) throw Errors.FORBIDDEN()
  try {
    const query = getValidatedQuery<z.infer<typeof expenseReimbursementQuerySchema>>(c)
    const employeeId = query.employee_id
    const startDate = query.start_date
    const endDate = query.end_date
    const status = query.status
    const userId = getUserId(c)

    let sql = `
      select 
        r.*,
        e.name as employee_name,
        e.department_id,
        d.name as department_name,
        cur.code as currency_code,
        cur.name as currency_name,
        a.name as account_name,
        e1.name as creator_name,
        e2.name as approver_name
      from expense_reimbursements r
      left join employees e on e.id = r.employee_id
      left join departments d on d.id = e.department_id
      left join currencies cur on cur.code = r.currency_id
      left join accounts a on a.id = r.account_id
      left join users u1 on u1.id = r.created_by
      left join employees e1 on e1.email = u1.email
      left join users u2 on u2.id = r.approved_by
      left join employees e2 on e2.email = u2.email
      where 1=1
    `
    const binds: any[] = []

    // 组员角色只能查看自己创建的报销记录（通过employee_id关联）
    if (isTeamMember(c) && userId) {
      const userService = new UserService(c.env.DB)
      const userEmployeeId = await userService.getUserEmployeeId(userId)
      if (userEmployeeId) {
        sql += ' and r.employee_id = ?'
        binds.push(userEmployeeId)
      } else {
        // 如果没有找到对应的employee记录，返回空结果
        return c.json({ results: [] })
      }
    } else if (employeeId) {
      sql += ' and r.employee_id = ?'
      binds.push(employeeId)
    }

    if (startDate) {
      sql += ' and r.expense_date >= ?'
      binds.push(startDate)
    }

    if (endDate) {
      sql += ' and r.expense_date <= ?'
      binds.push(endDate)
    }

    if (status) {
      sql += ' and r.status = ?'
      binds.push(status)
    }

    sql += ' order by r.expense_date desc, r.created_at desc'

    const result = await c.env.DB.prepare(sql).bind(...binds).all()
    return c.json(result)
  } catch (error: any) {
    console.error('Error fetching expense reimbursements:', error)
    throw Errors.INTERNAL_ERROR(error.message || '查询报销记录失败')
  }
})

// 员工报销管理 - 创建
employeesRoutes.post('/expense-reimbursements', validateJson(createExpenseSchema), async (c) => {
  // 组员可以创建自己的报销，hr和finance可以创建任何人的报销
  if (!getUserPosition(c)) throw Errors.FORBIDDEN()
  try {
    const body = getValidatedData<z.infer<typeof createExpenseSchema>>(c)

    // 组员角色只能为自己创建报销（通过email匹配验证）
    if (isTeamMember(c)) {
      const userId = getUserId(c)
      if (userId) {
        const user = await c.env.DB.prepare('select email from users where id=?').bind(userId).first<{ email: string }>()
        const emp = await c.env.DB.prepare('select id, email from employees where id=?').bind(body.employee_id).first<{ id: string, email: string }>()
        if (user?.email && emp?.email && user.email !== emp.email) {
          throw Errors.FORBIDDEN('员工只能为自己创建报销')
        }
      }
    }

    // 验证员工是否存在
    const emp = await c.env.DB.prepare('select id from employees where id=?').bind(body.employee_id).first<{ id: string }>()
    if (!emp) throw Errors.NOT_FOUND('员工')

    // 验证币种是否存在
    const currency = await c.env.DB.prepare('select code from currencies where code=?').bind(body.currency_id).first<{ code: string }>()
    if (!currency) throw Errors.NOT_FOUND('币种')

    const id = uuid()
    const userId = c.get('userId') as string | undefined
    const now = Date.now()

    await c.env.DB.prepare(`
      insert into expense_reimbursements(
        id, employee_id, expense_type, amount_cents, expense_date, description,
        currency_id, voucher_url, status, memo, created_by, created_at, updated_at
      ) values(?,?,?,?,?,?,?,?,'pending',?,?,?,?)
    `).bind(
      id, body.employee_id, body.expense_type, body.amount_cents, body.expense_date,
      body.description, body.currency_id, body.voucher_url, body.memo || null, userId || null, now, now
    ).run()

    logAuditAction(c, 'create', 'expense_reimbursement', id, JSON.stringify({
      employee_id: body.employee_id,
      expense_type: body.expense_type,
      amount_cents: body.amount_cents,
      expense_date: body.expense_date
    }))

    const created = await c.env.DB.prepare(`
      select 
        r.*,
        e.name as employee_name,
        e.department_id,
        d.name as department_name,
        cur.code as currency_code,
        cur.name as currency_name,
        a.name as account_name,
        e1.name as creator_name,
        e2.name as approver_name
      from expense_reimbursements r
      left join employees e on e.id = r.employee_id
      left join departments d on d.id = e.department_id
      left join currencies cur on cur.code = r.currency_id
      left join accounts a on a.id = r.account_id
      left join users u1 on u1.id = r.created_by
      left join employees e1 on e1.email = u1.email
      left join users u2 on u2.id = r.approved_by
      left join employees e2 on e2.email = u2.email
      where r.id=?
    `).bind(id).first()

    return c.json(created)
  } catch (error: any) {
    console.error('Error creating expense reimbursement:', error)
    throw Errors.INTERNAL_ERROR(error.message || '创建报销失败')
  }
})

// 员工报销管理 - 更新
employeesRoutes.put('/expense-reimbursements/:id', async (c) => {
  // 组员可以更新自己的待审批报销，hr和finance可以更新任何人的待审批报销
  if (!getUserPosition(c)) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  const body = await c.req.json<{
    expense_type?: string
    amount_cents?: number
    expense_date?: string
    description?: string
    currency_id?: string
    voucher_url?: string
    memo?: string
  }>()

  const record = await c.env.DB.prepare('select * from expense_reimbursements where id=?').bind(id).first<any>()
  if (!record) throw Errors.NOT_FOUND('报销记录')

  // 组员角色只能更新自己创建的待审批报销
  const userId = getUserId(c)
  if (isTeamMember(c) && record.created_by !== userId) {
    throw Errors.FORBIDDEN('员工只能更新自己创建的报销')
  }

  // 已审批或已支付的记录不允许修改
  if (record.status !== 'pending') {
    throw Errors.BUSINESS_ERROR('已审批、已拒绝或已支付的报销不能修改')
  }

  const updates: string[] = []
  const binds: any[] = []

  if (body.expense_type !== undefined) { updates.push('expense_type=?'); binds.push(body.expense_type) }
  if (body.amount_cents !== undefined) { updates.push('amount_cents=?'); binds.push(body.amount_cents) }
  if (body.expense_date !== undefined) { updates.push('expense_date=?'); binds.push(body.expense_date) }
  if (body.description !== undefined) { updates.push('description=?'); binds.push(body.description) }
  if (body.currency_id !== undefined) { updates.push('currency_id=?'); binds.push(body.currency_id) }
  if (body.voucher_url !== undefined) { updates.push('voucher_url=?'); binds.push(body.voucher_url || null) }
  if (body.memo !== undefined) { updates.push('memo=?'); binds.push(body.memo || null) }

  if (updates.length === 0) throw Errors.VALIDATION_ERROR('没有需要更新的字段')

  updates.push('updated_at=?')
  binds.push(Date.now())
  binds.push(id)

  await c.env.DB.prepare(`update expense_reimbursements set ${updates.join(',')} where id=?`).bind(...binds).run()

  logAuditAction(c, 'update', 'expense_reimbursement', id, JSON.stringify(body))

  const updated = await c.env.DB.prepare(`
    select 
      r.*,
      e.name as employee_name,
      e.department_id,
      d.name as department_name,
      cur.code as currency_code,
      cur.name as currency_name,
      a.name as account_name,
      e1.name as creator_name,
      e2.name as approver_name
    from expense_reimbursements r
    left join employees e on e.id = r.employee_id
    left join departments d on d.id = e.department_id
    left join currencies cur on cur.code = r.currency_id
    left join accounts a on a.id = r.account_id
    left join users u1 on u1.id = r.created_by
    left join employees e1 on e1.email = u1.email
    left join users u2 on u2.id = r.approved_by
    left join employees e2 on e2.email = u2.email
    where r.id=?
  `).bind(id).first()

  return c.json(updated)
})

// 员工报销管理 - 审批
employeesRoutes.post('/expense-reimbursements/:id/approve', async (c) => {
  // 有报销审批权限的人可以审批报销
  if (!hasPermission(c, 'hr', 'reimbursement', 'approve')) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  const body = await c.req.json<{ status: 'approved' | 'rejected', account_id?: string, category_id?: string, memo?: string }>()

  if (!body.status || !['approved', 'rejected'].includes(body.status)) {
    throw Errors.VALIDATION_ERROR('status必须为approved或rejected')
  }

  const record = await c.env.DB.prepare('select * from expense_reimbursements where id=?').bind(id).first<any>()
  if (!record) throw Errors.NOT_FOUND('报销记录')

  if (record.status !== 'pending') {
    throw Errors.BUSINESS_ERROR('报销已处理')
  }

  // 如果批准，必须提供账户和类别
  if (body.status === 'approved') {
    if (!body.account_id) throw Errors.VALIDATION_ERROR('审批时必须提供account_id')
    if (!body.category_id) throw Errors.VALIDATION_ERROR('审批时必须提供category_id')

    // 验证账户存在且币种匹配
    const account = await c.env.DB.prepare('select * from accounts where id=?').bind(body.account_id).first<any>()
    if (!account) throw Errors.NOT_FOUND('账户')
    if (account.active === 0) throw Errors.BUSINESS_ERROR('账户已停用')
    if (account.currency !== record.currency_id) {
      throw Errors.BUSINESS_ERROR('账户币种与报销币种不匹配')
    }

    // 验证类别存在
    const category = await c.env.DB.prepare('select * from categories where id=?').bind(body.category_id).first<any>()
    if (!category) throw Errors.NOT_FOUND('类别')
    if (category.kind !== 'expense') {
      throw Errors.BUSINESS_ERROR('类别必须为支出类型')
    }
  }

  const userId = c.get('userId') as string | undefined
  const now = Date.now()

  // 更新报销记录状态
  await c.env.DB.prepare(`
    update expense_reimbursements 
    set status=?, approved_by=?, approved_at=?, account_id=?, updated_at=?, memo=?
    where id=?
  `).bind(
    body.status,
    userId || null,
    now,
    body.status === 'approved' ? body.account_id : null,
    now,
    body.memo || record.memo || null,
    id
  ).run()

  // 如果批准，生成支出记录
  if (body.status === 'approved') {
    const flowId = uuid()
    const amount = record.amount_cents

    // 生成凭证号
    const day = String(record.expense_date).replace(/-/g, '')
    const count = await c.env.DB
      .prepare('select count(1) as n from cash_flows where biz_date=?')
      .bind(record.expense_date).first<{ n: number }>()
    const seq = ((count?.n ?? 0) + 1).toString().padStart(3, '0')
    const voucherNo = `JZ${day}-${seq}`

    // 计算账变前金额
    const financeService = new FinanceService(c.env.DB)
    const balanceBefore = await financeService.getAccountBalanceBefore(body.account_id!, record.expense_date, now)

    // 计算账变金额（支出为负）
    const delta = -amount
    const balanceAfter = balanceBefore + delta

    // 插入cash_flow记录
    await c.env.DB.prepare(`
      insert into cash_flows(
        id,voucher_no,biz_date,type,account_id,category_id,method,amount_cents,
        site_id,department_id,counterparty,memo,voucher_url,created_by,created_at
      ) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      flowId, voucherNo, record.expense_date, 'expense', body.account_id, body.category_id,
      null, amount, null, null,
      record.employee_id, body.memo || record.description || null, record.voucher_url || null,
      userId || 'system', now
    ).run()

    // 生成账变记录
    const transactionId = uuid()
    await c.env.DB.prepare(`
      insert into account_transactions(
        id, account_id, flow_id, transaction_date, transaction_type, amount_cents,
        balance_before_cents, balance_after_cents, created_at
      ) values(?,?,?,?,?,?,?,?,?)
    `).bind(
      transactionId, body.account_id, flowId, record.expense_date, 'expense', amount,
      balanceBefore, balanceAfter, now
    ).run()

    logAuditAction(c, 'approve', 'expense_reimbursement', id, JSON.stringify({
      status: body.status,
      account_id: body.account_id,
      category_id: body.category_id,
      flow_id: flowId,
      voucher_no: voucherNo,
      memo: body.memo
    }))
  } else {
    logAuditAction(c, 'approve', 'expense_reimbursement', id, JSON.stringify({
      status: body.status,
      memo: body.memo
    }))
  }

  const updated = await c.env.DB.prepare(`
    select 
      r.*,
      e.name as employee_name,
      e.department_id,
      d.name as department_name,
      cur.code as currency_code,
      cur.name as currency_name,
      a.name as account_name,
      e1.name as creator_name,
      e2.name as approver_name
    from expense_reimbursements r
    left join employees e on e.id = r.employee_id
    left join departments d on d.id = e.department_id
    left join currencies cur on cur.code = r.currency_id
    left join accounts a on a.id = r.account_id
    left join users u1 on u1.id = r.created_by
    left join employees e1 on e1.email = u1.email
    left join users u2 on u2.id = r.approved_by
    left join employees e2 on e2.email = u2.email
    where r.id=?
  `).bind(id).first()

  return c.json(updated)
})

// 员工报销管理 - 标记已支付
employeesRoutes.post('/expense-reimbursements/:id/pay', async (c) => {
  // 有报销审批权限的人可以标记已支付
  if (!hasPermission(c, 'hr', 'reimbursement', 'approve')) throw Errors.FORBIDDEN()
  const id = c.req.param('id')

  const record = await c.env.DB.prepare('select * from expense_reimbursements where id=?').bind(id).first<any>()
  if (!record) throw Errors.NOT_FOUND('报销记录')

  if (record.status !== 'approved') {
    throw Errors.BUSINESS_ERROR('只有已批准的报销可以标记为已支付')
  }

  const now = Date.now()

  await c.env.DB.prepare(`
    update expense_reimbursements 
    set status='paid', paid_at=?, updated_at=?
    where id=?
  `).bind(now, now, id).run()

  logAuditAction(c, 'pay', 'expense_reimbursement', id, JSON.stringify({
    amount_cents: record.amount_cents
  }))

  const updated = await c.env.DB.prepare(`
    select 
      r.*,
      e.name as employee_name,
      e.department_id,
      d.name as department_name,
      cur.code as currency_code,
      cur.name as currency_name,
      a.name as account_name,
      e1.name as creator_name,
      e2.name as approver_name
    from expense_reimbursements r
    left join employees e on e.id = r.employee_id
    left join departments d on d.id = e.department_id
    left join currencies cur on cur.code = r.currency_id
    left join accounts a on a.id = r.account_id
    left join users u1 on u1.id = r.created_by
    left join employees e1 on e1.email = u1.email
    left join users u2 on u2.id = r.approved_by
    left join employees e2 on e2.email = u2.email
    where r.id=?
  `).bind(id).first()

  return c.json(updated)
})

// 员工报销管理 - 删除

employeesRoutes.delete('/expense-reimbursements/:id', async (c) => {
  if (!hasPermission(c, 'hr', 'reimbursement', 'approve')) throw Errors.FORBIDDEN()
  const id = c.req.param('id')

  const record = await c.env.DB.prepare('select * from expense_reimbursements where id=?').bind(id).first<any>()
  if (!record) throw Errors.NOT_FOUND('报销记录')

  await c.env.DB.prepare('delete from expense_reimbursements where id=?').bind(id).run()

  logAuditAction(c, 'delete', 'expense_reimbursement', id, JSON.stringify({
    employee_id: record.employee_id,
    amount_cents: record.amount_cents,
    expense_date: record.expense_date
  }))

  return c.json({ ok: true })
})

// 个人名单管理 - 列表
