import { eq, and, like, or, inArray, desc, sql, isNotNull } from 'drizzle-orm'
import { DrizzleD1Database } from 'drizzle-orm/d1'
import { employees, departments, orgDepartments, positions, userDepartments } from '../db/schema.js'
import * as schema from '../db/schema.js'
import { v4 as uuid } from 'uuid'
import { Errors } from '../utils/errors.js'
import { Logger } from '../utils/logger.js'
import { EmailRoutingService } from './EmailRoutingService.js'
import { EmailService } from './EmailService.js'

export class EmployeeService {
  constructor(
    private db: DrizzleD1Database<typeof schema>,
    private emailService: EmailService
  ) {}

  /**
   * 创建员工（包含用户账号创建、邮箱路由创建和欢迎邮件发送）
   */
  async create(
    data: {
      name: string
      personalEmail: string // 真实邮箱，用于接收转发的邮件
      orgDepartmentId: string
      departmentId?: string
      positionId: string
      joinDate: string
      birthday?: string
      phone?: string
      usdtAddress?: string
      address?: string
      emergencyContact?: string
      emergencyPhone?: string
      memo?: string
      workSchedule?: any
      annualLeaveCycleMonths?: number
      annualLeaveDays?: number
    },
    env?: {
      EMAIL_SERVICE?: Fetcher
      EMAIL_TOKEN?: string
      CF_ACCOUNT_ID?: string
      CF_ZONE_ID?: string
      CF_API_TOKEN?: string
      CF_EMAIL_TOKEN?: string
    }
  ): Promise<{
    id: string
    email: string
    personalEmail: string
    user_account_created: boolean
    user_role?: string
    email_sent: boolean
    email_routing_created: boolean
    password?: string
  }> {
    // 注意：D1 不支持传统事务 (BEGIN/COMMIT/ROLLBACK)
    // 我们改用顺序查询。对于原子性，D1 提供 batch() API，但在复杂逻辑中较难应用。

    // 1. 根据员工姓名生成公司邮箱
    const allEmployees = await this.db.select({ email: employees.email }).from(employees)
    const existingEmails = allEmployees.map(e => e.email.toLowerCase())

    const emailRoutingService = new EmailRoutingService({
      CF_ACCOUNT_ID: env?.CF_ACCOUNT_ID || '',
      CF_ZONE_ID: env?.CF_ZONE_ID || '',
      CF_EMAIL_TOKEN: env?.CF_EMAIL_TOKEN || '',
    })

    const companyEmail = await emailRoutingService.generateCompanyEmail(data.name, existingEmails)

    // 邮箱统一转小写（Cloudflare Email Routing 区分大小写）
    data.personalEmail = data.personalEmail.toLowerCase()

    // 2. 检查个人邮箱是否已被使用
    const existingByPersonalEmail = await this.db
      .select()
      .from(employees)
      .where(eq(employees.personalEmail, data.personalEmail))
      .get()
    if (existingByPersonalEmail) {
      throw Errors.DUPLICATE('个人邮箱')
    }

    // 3. 获取组织部门以确定项目/部门
    const orgDept = await this.db
      .select()
      .from(orgDepartments)
      .where(eq(orgDepartments.id, data.orgDepartmentId))
      .get()
    if (!orgDept) {
      throw Errors.NOT_FOUND('组织部门')
    }

    // 4. 确定实际 department_id
    let actualDepartmentId = data.departmentId || orgDept.projectId
    if (!actualDepartmentId) {
      // 如果没有 project_id，则查找“总部”部门
      const hqDept = await this.db
        .select()
        .from(departments)
        .where(eq(departments.name, '总部'))
        .get()
      if (hqDept) {
        actualDepartmentId = hqDept.id
      }
    }

    // 5. 获取职位以确定用户角色
    const position = await this.db
      .select()
      .from(positions)
      .where(eq(positions.id, data.positionId))
      .get()
    if (!position) {
      throw Errors.NOT_FOUND('职位')
    }

    const newEmployeeId = uuid()
    const now = Date.now()

    // 6-0. 确保个人邮箱加入 Cloudflare Email Routing 地址（需要验证）
    if (env?.CF_API_TOKEN && env?.CF_ACCOUNT_ID) {
      try {
        await emailRoutingService.ensureDestinationAddress(data.personalEmail)
      } catch (error) {
        Logger.error('[Employee Create] ensureDestinationAddress error', { error })
      }
    }

    // 跟踪创建的资源以便回滚
    let employeeCreated = false
    let userCreated = false
    let userDepartmentCreated = false
    let newUserId = ''

    try {
      // 6. 创建员工记录
      await this.db
        .insert(employees)
        .values({
          id: newEmployeeId,
          name: data.name,
          email: companyEmail,
          personalEmail: data.personalEmail,
          departmentId: actualDepartmentId,
          orgDepartmentId: data.orgDepartmentId,
          positionId: data.positionId,
          joinDate: data.joinDate,
          birthday: data.birthday,
          phone: data.phone,
          usdtAddress: data.usdtAddress,
          address: data.address,
          emergencyContact: data.emergencyContact,
          emergencyPhone: data.emergencyPhone,
          memo: data.memo,
          workSchedule: data.workSchedule ? JSON.stringify(data.workSchedule) : null,
          annualLeaveCycleMonths: data.annualLeaveCycleMonths,
          annualLeaveDays: data.annualLeaveDays,
          status: 'probation',
          active: 1,
          createdAt: now,
          updatedAt: now,
        })
        .run()
      employeeCreated = true

      // 7. 创建邮件路由规则（将公司邮箱转发到个人邮箱）
      let emailRoutingCreated = false
      if (env?.CF_API_TOKEN && env?.CF_ZONE_ID) {
        try {
          const routingResult = await emailRoutingService.createRoutingRule(
            companyEmail,
            data.personalEmail
          )
          emailRoutingCreated = routingResult.success
          if (!routingResult.success) {
            Logger.error('[Employee Create] Failed to create email routing', { error: routingResult.error })
          }
        } catch (error) {
          Logger.error('[Employee Create] Email routing error', { error })
        }
      }

      // 8. 向员工记录添加认证字段（用于首次设置密码的激活令牌）
      const activationToken = uuid().replace(/-/g, '') + uuid().replace(/-/g, '')
      const activationExpiresAt = Date.now() + 24 * 60 * 60 * 1000 // 24 hours

      // 更新员工记录以包含认证字段
      await this.db
        .update(employees)
        .set({
          passwordHash: null,
          mustChangePassword: 0,
          passwordChanged: 0,
          activationToken: activationToken,
          activationExpiresAt: activationExpiresAt,
        })
        .where(eq(employees.id, newEmployeeId))
        .run()
      userCreated = true // 标记已设置认证字段
      newUserId = newEmployeeId // 使用员工 ID 作为用户 ID

      // 添加到 user_departments
      if (actualDepartmentId) {
        await this.db
          .insert(userDepartments)
          .values({
            id: uuid(),
            userId: newEmployeeId,
            departmentId: actualDepartmentId,
            createdAt: now,
          })
          .run()
        userDepartmentCreated = true
      }

      const userAccountCreated = true

      // 注意：不再自动发送激活邮件
      // 原因：需要等待 Cloudflare 邮箱路由验证通过后，手动点击"发送激活邮件"

      return {
        id: newEmployeeId,
        email: companyEmail,
        personalEmail: data.personalEmail,
        user_account_created: userAccountCreated,
        user_role: position.functionRole || 'employee',
        email_sent: false, // 不再自动发送，需手动触发
        email_routing_created: emailRoutingCreated,
        password: undefined,
      }
    } catch (error) {
      // 回滚：按相反顺序删除已创建的记录
      Logger.error('[Employee Create] Error occurred, rolling back', { error })

      try {
        if (userDepartmentCreated && newUserId) {
          await this.db.delete(userDepartments).where(eq(userDepartments.userId, newUserId)).run()
          Logger.info('[Employee Create] Rolled back user_departments')
        }
        // userCreated 标志现在指的是设置了认证字段，而不是单独的记录
        // 没有单独的 users 表需要回滚 - 删除 employee 记录会一并处理认证字段
        if (employeeCreated) {
          await this.db.delete(employees).where(eq(employees.id, newEmployeeId)).run()
          Logger.info('[Employee Create] Rolled back employees')
        }
      } catch (rollbackError) {
        Logger.error('[Employee Create] Rollback failed', { error: rollbackError })
      }

      // 重新抛出原始错误
      throw error
    }
  }

  async resendActivationEmail(id: string, env: { EMAIL_SERVICE?: Fetcher; EMAIL_TOKEN?: string }) {
    const employee = await this.db.select().from(employees).where(eq(employees.id, id)).get()
    if (!employee) {
      throw Errors.NOT_FOUND('员工')
    }

    if (employee.active === 1 && employee.passwordHash) {
      throw Errors.BUSINESS_ERROR('账号已激活，无需重新发送')
    }

    const activationToken = uuid().replace(/-/g, '') + uuid().replace(/-/g, '')
    const activationExpiresAt = Date.now() + 24 * 60 * 60 * 1000 // 24 hours

    await this.db
      .update(employees)
      .set({
        activationToken,
        activationExpiresAt,
        updatedAt: Date.now(),
      })
      .where(eq(employees.id, id))
      .run()

    // 使用个人邮箱进行激活
    const emailTarget = employee.personalEmail || employee.email || ''

    try {
      const result = await this.emailService.sendActivationEmail(
        emailTarget,
        employee.name || '',
        activationToken
      )
      return result
    } catch (error: any) {
      Logger.error('[Employee Resend Activation] Email send error', { error })
      return { success: false, error: error.message }
    }
  }

  async resetTotp(id: string) {
    const employee = await this.db.select().from(employees).where(eq(employees.id, id)).get()
    if (!employee) {
      throw Errors.NOT_FOUND('员工')
    }

    await this.db.update(employees).set({ totpSecret: null }).where(eq(employees.id, id)).run()

    return { success: true }
  }

  /**
   * 构建员工关联查询（提取公共逻辑）
   */
  private buildEmployeeQuery() {
    return this.db
      .select({
        id: employees.id,
        name: employees.name,
        email: employees.email,
        personalEmail: employees.personalEmail,
        departmentId: employees.departmentId,
        departmentName: departments.name,
        orgDepartmentId: employees.orgDepartmentId,
        orgDepartmentName: orgDepartments.name,
        orgDepartmentCode: orgDepartments.code,
        positionId: employees.positionId,
        positionName: positions.name,
        positionLevel: positions.level,
        positionCode: positions.code,
        joinDate: employees.joinDate,
        status: employees.status,
        active: employees.active,
        phone: employees.phone,
        regularDate: employees.regularDate,
        birthday: employees.birthday,
        usdtAddress: employees.usdtAddress,
        emergencyContact: employees.emergencyContact,
        emergencyPhone: employees.emergencyPhone,
        address: employees.address,
        memo: employees.memo,
        workSchedule: employees.workSchedule,
        annualLeaveCycleMonths: employees.annualLeaveCycleMonths,
        annualLeaveDays: employees.annualLeaveDays,
        createdAt: employees.createdAt,
        updatedAt: employees.updatedAt,
        userId: employees.id,
        userActive: employees.active,
        userLastLoginAt: employees.lastLoginAt,
        isActivated: sql<boolean>`${employees.passwordHash} IS NOT NULL`,
        totpEnabled: sql<boolean>`${employees.totpSecret} IS NOT NULL`,
      })
      .from(employees)
      .leftJoin(departments, eq(employees.departmentId, departments.id))
      .leftJoin(orgDepartments, eq(employees.orgDepartmentId, orgDepartments.id))
      .leftJoin(positions, eq(employees.positionId, positions.id))
  }

  async getAll(filters: {
    status?: string
    departmentId?: string
    orgDepartmentId?: string
    name?: string
    email?: string
    positionId?: string
    limit?: number
    offset?: number
  }) {
    const conditions = []

    if (filters.status) {
      conditions.push(eq(employees.status, filters.status))
    }
    if (filters.departmentId) {
      conditions.push(eq(employees.departmentId, filters.departmentId))
    }
    if (filters.orgDepartmentId) {
      conditions.push(eq(employees.orgDepartmentId, filters.orgDepartmentId))
    }
    if (filters.name) {
      conditions.push(like(employees.name, `%${filters.name}%`))
    }
    if (filters.email) {
      conditions.push(like(employees.email, `%${filters.email}%`))
    }
    if (filters.positionId) {
      conditions.push(eq(employees.positionId, filters.positionId))
    }

    return await this.buildEmployeeQuery()
      .where(and(...conditions))
      .orderBy(desc(employees.createdAt))
      .limit(filters.limit || 100)
      .offset(filters.offset || 0)
  }

  async getById(id: string) {
    return await this.buildEmployeeQuery()
      .where(eq(employees.id, id))
      .get()
  }

  async migrateFromUser(
    userId: string,
    data: {
      orgDepartmentId: string
      positionId: string
      joinDate: string
      birthday?: string
    }
  ) {
    return await this.db.transaction(async tx => {
      // 1. 检查用户是否存在
      const user = await tx.select().from(employees).where(eq(employees.id, userId)).get()
      if (!user) {
        throw new Error('User not found')
      }

      // 2. 检查员工是否已存在（合并 users 表后允许同一记录继续补全）
      // 如果存在同邮箱但不同ID则视为冲突
      const existingEmployee = await tx
        .select()
        .from(employees)
        .where(eq(employees.email, user.email))
        .get()
      if (existingEmployee && existingEmployee.id !== userId) {
        throw new Error('Employee already exists')
      }

      // 3. 获取组织部门
      const orgDept = await tx
        .select()
        .from(orgDepartments)
        .where(eq(orgDepartments.id, data.orgDepartmentId))
        .get()
      if (!orgDept) {
        throw new Error('Org Department not found')
      }

      // 4. 确定部门 (项目)
      let actualDepartmentId = orgDept.projectId
      if (!actualDepartmentId) {
        // 如果没有 project_id，假设是总部。查找或创建 '总部' 部门。
        // 为简单起见，假设 '总部' 部门存在，或者我们能找到名为 '总部' 的部门
        const hqDept = await tx.select().from(departments).where(eq(departments.name, '总部')).get()
        if (hqDept) {
          actualDepartmentId = hqDept.id
        } else {
          // 回退或错误？原始代码有查找总部的逻辑。
          throw new Error('Headquarters department not found')
        }
      }

      // 5. 获取职位
      const position = await tx
        .select()
        .from(positions)
        .where(eq(positions.id, data.positionId))
        .get()
      if (!position) {
        throw new Error('Position not found')
      }

      const now = Date.now()

      // 6. 更新现有员工 (用户) 的详细信息
      await tx
        .update(employees)
        .set({
          departmentId: actualDepartmentId,
          orgDepartmentId: data.orgDepartmentId,
          positionId: data.positionId,
          joinDate: data.joinDate,
          status: 'probation', // 迁移时默认为试用期
          active: 1,
          birthday: data.birthday,
          updatedAt: now,
        })
        .where(eq(employees.id, userId))
        .run()

      // 同步 user_departments
      const existingUd = await tx
        .select()
        .from(userDepartments)
        .where(
          and(
            eq(userDepartments.userId, userId),
            eq(userDepartments.departmentId, actualDepartmentId)
          )
        )
        .get()

      if (!existingUd) {
        await tx
          .insert(userDepartments)
          .values({
            id: uuid(),
            userId: userId,
            departmentId: actualDepartmentId,
            createdAt: now,
          })
          .run()
      }

      return { id: userId }
    })
  }

  async update(
    id: string,
    data: {
      name?: string
      departmentId?: string
      orgDepartmentId?: string
      positionId?: string
      joinDate?: string
      active?: number
      phone?: string
      personalEmail?: string
      usdtAddress?: string
      emergencyContact?: string
      emergencyPhone?: string
      address?: string
      memo?: string
      birthday?: string
      workSchedule?: any
      annualLeaveCycleMonths?: number
      annualLeaveDays?: number
    }
  ) {
    // D1 不支持 begin/transaction，这里改为顺序执行
    const employee = await this.db.select().from(employees).where(eq(employees.id, id)).get()
    if (!employee) {
      throw new Error('Employee not found')
    }

    const updateData: any = { updatedAt: Date.now() }
    if (data.name !== undefined) {updateData.name = data.name}
    if (data.departmentId !== undefined) {updateData.departmentId = data.departmentId}
    if (data.orgDepartmentId !== undefined) {updateData.orgDepartmentId = data.orgDepartmentId}
    if (data.positionId !== undefined) {updateData.positionId = data.positionId}
    if (data.joinDate !== undefined) {updateData.joinDate = data.joinDate}
    if (data.active !== undefined) {updateData.active = Number(data.active)}
    if (data.phone !== undefined) {updateData.phone = data.phone}
    if (data.personalEmail !== undefined) {updateData.personalEmail = data.personalEmail.toLowerCase()}
    if (data.usdtAddress !== undefined) {updateData.usdtAddress = data.usdtAddress}
    if (data.emergencyContact !== undefined) {updateData.emergencyContact = data.emergencyContact}
    if (data.emergencyPhone !== undefined) {updateData.emergencyPhone = data.emergencyPhone}
    if (data.address !== undefined) {updateData.address = data.address}
    if (data.memo !== undefined) {updateData.memo = data.memo}
    if (data.birthday !== undefined) {updateData.birthday = data.birthday}
    if (data.annualLeaveCycleMonths !== undefined)
      {updateData.annualLeaveCycleMonths = Number(data.annualLeaveCycleMonths) || null}
    if (data.annualLeaveDays !== undefined)
      {updateData.annualLeaveDays = Number(data.annualLeaveDays) || null}
    if (data.workSchedule !== undefined) {
      updateData.workSchedule =
        typeof data.workSchedule === 'string'
          ? data.workSchedule
          : JSON.stringify(data.workSchedule)
    }

    await this.db.update(employees).set(updateData).where(eq(employees.id, id)).run()

    if (data.departmentId) {
      const existingUd = await this.db
        .select()
        .from(userDepartments)
        .where(
          and(eq(userDepartments.userId, id), eq(userDepartments.departmentId, data.departmentId))
        )
        .get()
      if (!existingUd) {
        await this.db
          .insert(userDepartments)
          .values({
            id: uuid(),
            userId: id,
            departmentId: data.departmentId,
            createdAt: Date.now(),
          })
          .run()
      }
    }

    return { id }
  }

  async regularize(id: string, date: string) {
    const employee = await this.db.select().from(employees).where(eq(employees.id, id)).get()
    if (!employee) {
      throw Errors.NOT_FOUND('员工')
    }

    await this.db
      .update(employees)
      .set({
        status: 'regular',
        regularDate: date,
        updatedAt: Date.now(),
      })
      .where(eq(employees.id, id))
      .execute()

    return { id }
  }

  async leave(id: string, date: string, reason?: string) {
    const employee = await this.db.select().from(employees).where(eq(employees.id, id)).get()
    if (!employee) {
      throw Errors.NOT_FOUND('员工')
    }

    await this.db
      .update(employees)
      .set({
        status: 'resigned',
        active: 0,
        memo: reason
          ? employee.memo
            ? `${employee.memo}\n离职原因：${reason}`
            : `离职原因：${reason}`
          : employee.memo,
        updatedAt: Date.now(),
      })
      .where(eq(employees.id, id))
      .execute()

    // 禁用用户登录
    if (employee.email) {
      await this.db
        .update(employees)
        .set({ active: 0 })
        .where(eq(employees.personalEmail, employee.email))
        .execute()
    }

    return { id }
  }

  async rejoin(id: string, date: string) {
    const employee = await this.db.select().from(employees).where(eq(employees.id, id)).get()
    if (!employee) {
      throw Errors.NOT_FOUND('员工')
    }

    await this.db
      .update(employees)
      .set({
        status: 'probation',
        active: 1,
        joinDate: date,
        updatedAt: Date.now(),
      })
      .where(eq(employees.id, id))
      .execute()

    // 启用用户登录
    if (employee.email) {
      await this.db
        .update(employees)
        .set({ active: 1 })
        .where(eq(employees.personalEmail, employee.email))
        .execute()
    }

    return { id }
  }

  async getSubordinateEmployeeIds(userId: string): Promise<string[]> {
    const employee = await this.db
      .select({
        id: schema.employees.id,
        email: schema.employees.personalEmail,
        positionId: schema.employees.positionId,
        departmentId: schema.employees.departmentId,
        orgDepartmentId: schema.employees.orgDepartmentId,
      })
      .from(schema.employees)
      .where(eq(schema.employees.id, userId))
      .get()

    if (!employee || !employee.positionId) {return []}

    const position = await this.db
      .select()
      .from(schema.positions)
      .where(eq(schema.positions.id, employee.positionId))
      .get()
    if (!position || !position.canManageSubordinates) {return []}

    // Level 1: 总部 (查看所有员工)
    if (position.level === 1) {
      const all = await this.db
        .select({ id: employees.id })
        .from(employees)
        .where(eq(employees.active, 1))
        .execute()
      return all.map(e => e.id)
    }

    // Level 2: 项目主管 (查看同一部门的员工)
    if (position.level === 2 && employee?.departmentId) {
      const deptEmployees = await this.db
        .select({ id: employees.id })
        .from(employees)
        .where(and(eq(employees.departmentId, employee.departmentId), eq(employees.active, 1)))
        .execute()
      return deptEmployees.map(e => e.id)
    }

    // 组长 (查看同一组织部门的员工)
    if (position.code === 'team_leader' && employee?.orgDepartmentId) {
      const teamEmployees = await this.db
        .select({ id: employees.id })
        .from(employees)
        .where(
          and(eq(employees.orgDepartmentId, employee.orgDepartmentId), eq(employees.active, 1))
        )
        .execute()
      return teamEmployees.map(e => e.id)
    }

    return []
  }

  // ========== UserService 方法（已合并，users 表已废弃） ==========

  /**
   * 根据 ID 获取员工信息（兼容 UserService）
   * @deprecated 使用 getById 代替
   */
  async getUserById(id: string) {
    return this.getById(id)
  }

  /**
   * 根据邮箱获取员工信息（兼容 UserService）
   */
  async getUserByEmail(email: string) {
    const user = await this.db
      .select()
      .from(employees)
      .where(eq(employees.personalEmail, email))
      .get()
    return user || null
  }

  /**
   * 获取用户职位信息（包含权限）
   */
  async getUserPosition(userId: string) {
    const employee = await this.db
      .select({
        positionId: employees.positionId,
      })
      .from(employees)
      .where(and(eq(employees.id, userId), eq(employees.active, 1)))
      .get()

    if (!employee?.positionId) {return null}

    const { positions } = await import('../db/schema.js')
    const result = await this.db
      .select({
        id: positions.id,
        code: positions.code,
        name: positions.name,
        level: positions.level,
        functionRole: positions.functionRole,
        canManageSubordinates: positions.canManageSubordinates,
        permissions: positions.permissions,
      })
      .from(positions)
      .where(and(eq(positions.id, employee.positionId), eq(positions.active, 1)))
      .get()

    if (!result) {return null}

    let permissions = {}
    try {
      permissions = JSON.parse(result.permissions || '{}')
    } catch (err) {
      Logger.error('Failed to parse permissions JSON', { error: err })
    }

    return {
      id: result.id,
      code: result.code,
      name: result.name,
      level: result.level,
      functionRole: result.functionRole,
      canManageSubordinates: result.canManageSubordinates,
      permissions,
    }
  }

  /**
   * 检查用户是否为总部用户
   */
  async isHQUser(userId: string): Promise<boolean> {
    const { userDepartments, departments } = await import('../db/schema.js')
    const result = await this.db
      .select({ isHq: departments.name })
      .from(userDepartments)
      .innerJoin(departments, eq(departments.id, userDepartments.departmentId))
      .where(and(eq(userDepartments.userId, userId), eq(departments.name, '总部')))
      .get()

    return !!result
  }

  /**
   * 获取用户组 ID（组织部门）
   */
  async getUserGroupId(userId: string): Promise<string | null> {
    const employee = await this.getUserById(userId)
    if (!employee?.orgDepartmentId) {return null}

    const { orgDepartments } = await import('../db/schema.js')
    const { isNotNull } = await import('drizzle-orm')
    const group = await this.db
      .select({ id: orgDepartments.id })
      .from(orgDepartments)
      .where(
        and(eq(orgDepartments.id, employee.orgDepartmentId), isNotNull(orgDepartments.parentId))
      )
      .get()

    return group?.id || null
  }

  /**
   * 获取用户组织部门 ID
   */
  async getUserOrgDepartmentId(userId: string): Promise<string | null> {
    const employee = await this.getUserById(userId)
    return employee?.orgDepartmentId || null
  }

  /**
   * 获取用户部门 ID 列表
   */
  async getUserDepartmentIds(userId: string): Promise<string[]> {
    const { userDepartments } = await import('../db/schema.js')
    const userDepts = await this.db
      .select({ departmentId: userDepartments.departmentId })
      .from(userDepartments)
      .where(eq(userDepartments.userId, userId))
      .all()

    return userDepts.map(r => r.departmentId)
  }

  /**
   * 获取用户主部门 ID
   */
  async getUserDepartmentId(userId: string): Promise<string | null> {
    const ids = await this.getUserDepartmentIds(userId)
    return ids.length > 0 ? ids[0] : null
  }
}
