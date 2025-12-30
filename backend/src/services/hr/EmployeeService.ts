import { eq, and, like, or, inArray, desc, sql, isNotNull, SQL } from 'drizzle-orm'
import { DrizzleD1Database } from 'drizzle-orm/d1'
import { employees, projects, orgDepartments, positions } from '../../db/schema.js'
import * as schema from '../../db/schema.js'
import { v4 as uuid } from 'uuid'
import { Errors } from '../../utils/errors.js'
import { Logger } from '../../utils/logger.js'
import { EmailRoutingService } from '../common/EmailRoutingService.js'
import { EmailService } from '../common/EmailService.js'
import { query } from '../../utils/query-helpers.js'
import type { Context } from 'hono'
import type { Env, AppVariables } from '../../types/index.js'
import { PermissionAuditService } from '../system/PermissionAuditService.js'
import { PermissionCache } from '../../utils/permission-cache.js'

export class EmployeeService {
  constructor(
    private db: DrizzleD1Database<typeof schema>,
    private emailService: EmailService,
    private permissionAuditService?: PermissionAuditService,
    private permissionCache?: PermissionCache
  ) { }

  /**
   * 创建员工（包含用户账号创建、邮箱路由创建和欢迎邮件发送）
   */
  async create(
    data: {
      name: string
      personalEmail: string // 真实邮箱，用于接收转发的邮件
      orgDepartmentId: string
      projectId?: string
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
    email_sent: boolean
    email_routing_created: boolean
  }> {
    // 注意：D1 不支持传统事务 (BEGIN/COMMIT/ROLLBACK)
    // 我们改用顺序查询。对于原子性，D1 提供 batch() API，但在复杂逻辑中较难应用。

    // 1. 根据员工姓名生成公司邮箱
    const allEmployees = await query(
      this.db,
      'EmployeeService.create.getAllEmails',
      () => this.db.select({ email: employees.email }).from(employees).all(),
      undefined // create 方法没有 Context
    )
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
    const existingByPersonalEmail = await query(
      this.db,
      'EmployeeService.create.checkPersonalEmail',
      () => this.db
        .select()
        .from(employees)
        .where(eq(employees.personalEmail, data.personalEmail))
        .get(),
      undefined
    )
    if (existingByPersonalEmail) {
      throw Errors.DUPLICATE('个人邮箱')
    }

    // 3. 获取组织部门以确定项目/部门
    const orgDept = await query(
      this.db,
      'EmployeeService.create.getOrgDepartment',
      () => this.db
        .select()
        .from(orgDepartments)
        .where(eq(orgDepartments.id, data.orgDepartmentId))
        .get(),
      undefined
    )
    if (!orgDept) {
      throw Errors.NOT_FOUND('组织部门')
    }

    // 4. 确定实际 project_id
    const actualProjectId = data.projectId || orgDept.projectId
    if (!actualProjectId) {
      throw Errors.VALIDATION_ERROR('组织部门必须关联项目')
    }

    // 5. 获取职位以确定用户角色
    const position = await query(
      this.db,
      'EmployeeService.create.getPosition',
      () => this.db
        .select()
        .from(positions)
        .where(eq(positions.id, data.positionId))
        .get(),
      undefined
    )
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
          projectId: actualProjectId,
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

      // 移除废弃的激活令牌、密码哈希逻辑
      return {
        id: newEmployeeId,
        email: companyEmail,
        personalEmail: data.personalEmail,
        user_account_created: true, // 保留字段兼容性
        email_sent: false,
        email_routing_created: emailRoutingCreated,
      }
    } catch (error) {
      // 回滚逻辑保持不变
      Logger.error('[Employee Create] Error occurred, rolling back', { error })
      try {
        if (employeeCreated) {
          await this.db.delete(employees).where(eq(employees.id, newEmployeeId)).run()
          Logger.info('[Employee Create] Rolled back employees')
        }
      } catch (rollbackError) {
        Logger.error('[Employee Create] Rollback failed', { error: rollbackError })
      }
      throw error
    }
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
        projectId: employees.projectId,
        departmentName: projects.name,
        orgDepartmentId: employees.orgDepartmentId,
        orgDepartmentName: orgDepartments.name,
        orgDepartmentCode: orgDepartments.code,
        positionId: employees.positionId,
        positionName: positions.name,
        positionDataScope: positions.dataScope,
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
        isActivated: sql<boolean>`1`, // Zero Trust 模式下默认激活
      })
      .from(employees)
      .leftJoin(projects, eq(employees.projectId, projects.id))
      .leftJoin(orgDepartments, eq(employees.orgDepartmentId, orgDepartments.id))
      .leftJoin(positions, eq(employees.positionId, positions.id))
  }

  async getAll(
    filters: {
      status?: string
      projectId?: string
      orgDepartmentId?: string
      name?: string
      email?: string
      positionId?: string
      limit?: number
      offset?: number
    },
    accessFilter?: SQL
  ) {
    // D1 兼容性修复：使用顺序查询代替多个 LEFT JOIN
    const conditions: SQL[] = []

    if (accessFilter) {
      conditions.push(accessFilter)
    }

    if (filters.status) {
      conditions.push(eq(employees.status, filters.status))
    }
    if (filters.projectId) {
      conditions.push(eq(employees.projectId, filters.projectId))
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

    // 1. 查询员工记录
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined
    const employeesList = await query(
      this.db,
      'EmployeeService.getAll.getEmployees',
      () => this.db
        .select()
        .from(employees)
        .where(whereClause)
        .orderBy(desc(employees.createdAt))
        .limit(filters.limit || 100)
        .offset(filters.offset || 0)
        .all(),
      undefined
    )

    if (employeesList.length === 0) {
      return []
    }

    // 2. 批量获取关联数据
    const projectIds = [...new Set(employeesList.map(e => e.projectId).filter(Boolean) as string[])]
    const orgDepartmentIds = [...new Set(employeesList.map(e => e.orgDepartmentId).filter(Boolean) as string[])]
    const positionIds = [...new Set(employeesList.map(e => e.positionId).filter(Boolean) as string[])]

    const departmentMap = new Map<string, { name: string }>()
    const orgDepartmentMap = new Map<string, { name: string; code: string }>()
    const positionMap = new Map<string, { name: string; dataScope: string; code: string }>()

    if (projectIds.length > 0) {
      const depts = await query(
        this.db,
        'EmployeeService.getAll.getDepartments',
        () => this.db
          .select({ id: projects.id, name: projects.name })
          .from(projects)
          .where(inArray(projects.id, projectIds))
          .all(),
        undefined
      )
      depts.forEach(d => departmentMap.set(d.id, { name: d.name || '' }))
    }

    if (orgDepartmentIds.length > 0) {
      const orgDepts = await query(
        this.db,
        'EmployeeService.getAll.getOrgDepartments',
        () => this.db
          .select({ id: orgDepartments.id, name: orgDepartments.name, code: orgDepartments.code })
          .from(orgDepartments)
          .where(inArray(orgDepartments.id, orgDepartmentIds))
          .all(),
        undefined
      )
      orgDepts.forEach(d => orgDepartmentMap.set(d.id, { name: d.name || '', code: d.code || '' }))
    }

    if (positionIds.length > 0) {
      const pos = await query(
        this.db,
        'EmployeeService.getAll.getPositions',
        () => this.db
          .select({ id: positions.id, name: positions.name, dataScope: positions.dataScope, code: positions.code })
          .from(positions)
          .where(inArray(positions.id, positionIds))
          .all(),
        undefined
      )
      pos.forEach(p => positionMap.set(p.id, { name: p.name || '', dataScope: p.dataScope || 'self', code: p.code || '' }))
    }

    // 3. 组装结果
    return employeesList.map(emp => {
      const dept = emp.projectId ? departmentMap.get(emp.projectId) : null
      const orgDept = emp.orgDepartmentId ? orgDepartmentMap.get(emp.orgDepartmentId) : null
      const pos = emp.positionId ? positionMap.get(emp.positionId) : null

      return {
        id: emp.id,
        name: emp.name,
        email: emp.email,
        personalEmail: emp.personalEmail,
        projectId: emp.projectId,
        departmentName: dept?.name || null,
        orgDepartmentId: emp.orgDepartmentId,
        orgDepartmentName: orgDept?.name || null,
        orgDepartmentCode: orgDept?.code || null,
        positionId: emp.positionId,
        positionName: pos?.name || null,
        positionDataScope: pos?.dataScope || null,
        positionCode: pos?.code || null,
        joinDate: emp.joinDate,
        status: emp.status,
        active: emp.active,
        phone: emp.phone,
        regularDate: emp.regularDate,
        birthday: emp.birthday,
        usdtAddress: emp.usdtAddress,
        emergencyContact: emp.emergencyContact,
        emergencyPhone: emp.emergencyPhone,
        address: emp.address,
        memo: emp.memo,
        workSchedule: emp.workSchedule,
        annualLeaveCycleMonths: emp.annualLeaveCycleMonths,
        annualLeaveDays: emp.annualLeaveDays,
        createdAt: emp.createdAt,
        updatedAt: emp.updatedAt,
        userId: emp.id,
        userActive: emp.active,
        userLastLoginAt: emp.lastLoginAt,
        isActivated: true,
      }
    })
  }

  async getById(id: string, c?: Context<{ Bindings: Env; Variables: AppVariables }>) {
    // D1/Drizzle Bug workaround: Avoid complex joins by fetching related data sequentially
    const employee = await query(
      this.db,
      'EmployeeService.getById.base',
      () => this.db.select().from(employees).where(eq(employees.id, id)).get(),
      c
    )

    if (!employee) return undefined

    // Fetch related data
    const [department, orgDepartment, position] = await Promise.all([
      employee.projectId
        ? this.db.select().from(projects).where(eq(projects.id, employee.projectId)).get()
        : Promise.resolve(null),
      employee.orgDepartmentId
        ? this.db.select().from(orgDepartments).where(eq(orgDepartments.id, employee.orgDepartmentId)).get()
        : Promise.resolve(null),
      employee.positionId
        ? this.db.select().from(positions).where(eq(positions.id, employee.positionId)).get()
        : Promise.resolve(null)
    ])

    return {
      id: employee.id,
      name: employee.name,
      email: employee.email,
      personalEmail: employee.personalEmail,
      projectId: employee.projectId,
      departmentName: department?.name || null,
      orgDepartmentId: employee.orgDepartmentId,
      orgDepartmentName: orgDepartment?.name || null,
      orgDepartmentCode: orgDepartment?.code || null,
      positionId: employee.positionId,
      positionName: position?.name || null,
      positionDataScope: position?.dataScope || null,
      positionCode: position?.code || null,
      joinDate: employee.joinDate,
      status: employee.status,
      active: employee.active,
      phone: employee.phone,
      regularDate: employee.regularDate,
      birthday: employee.birthday,
      usdtAddress: employee.usdtAddress,
      emergencyContact: employee.emergencyContact,
      emergencyPhone: employee.emergencyPhone,
      address: employee.address,
      memo: employee.memo,
      workSchedule: employee.workSchedule,
      annualLeaveCycleMonths: employee.annualLeaveCycleMonths,
      annualLeaveDays: employee.annualLeaveDays,
      createdAt: employee.createdAt,
      updatedAt: employee.updatedAt,
      userId: employee.id,
      userActive: employee.active,
      userLastLoginAt: employee.lastLoginAt,
      isActivated: true,
    }
  }

  async migrateFromUser(
    userId: string,
    data: {
      orgDepartmentId: string
      positionId: string
      joinDate: string
      birthday?: string
    },
    c?: Context<{ Bindings: Env; Variables: AppVariables }>
  ) {
    return await this.db.transaction(async tx => {
      // 1. 检查用户是否存在
      const user = await query(
        tx as any,
        'EmployeeService.migrateFromUser.getUser',
        () => tx.select().from(employees).where(eq(employees.id, userId)).get(),
        c
      )
      if (!user) {
        throw new Error('User not found')
      }

      // 2. 检查员工是否已存在（合并 users 表后允许同一记录继续补全）
      // 如果存在同邮箱但不同ID则视为冲突
      const existingEmployee = await query(
        tx as any,
        'EmployeeService.migrateFromUser.checkExistingEmployee',
        () => tx
          .select()
          .from(employees)
          .where(eq(employees.email, user.email))
          .get(),
        c
      )
      if (existingEmployee && existingEmployee.id !== userId) {
        throw new Error('Employee already exists')
      }

      // 3. 获取组织部门
      const orgDept = await query(
        tx as any,
        'EmployeeService.migrateFromUser.getOrgDepartment',
        () => tx
          .select()
          .from(orgDepartments)
          .where(eq(orgDepartments.id, data.orgDepartmentId))
          .get(),
        c
      )
      if (!orgDept) {
        throw new Error('Org Department not found')
      }

      // 4. 确定部门 (项目)
      const actualProjectId = orgDept.projectId
      if (!actualProjectId) {
        throw Errors.VALIDATION_ERROR('组织部门必须关联项目')
      }

      // 5. 获取职位
      const position = await query(
        tx as any,
        'EmployeeService.migrateFromUser.getPosition',
        () => tx
          .select()
          .from(positions)
          .where(eq(positions.id, data.positionId))
          .get(),
        c
      )
      if (!position) {
        throw new Error('Position not found')
      }

      const now = Date.now()

      // 6. 更新现有员工 (用户) 的详细信息
      await tx
        .update(employees)
        .set({
          projectId: actualProjectId,
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

      return { id: userId }
    })
  }

  async update(
    id: string,
    data: {
      name?: string
      projectId?: string
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
    },
    c?: Context<{ Bindings: Env; Variables: AppVariables }>,
    operatorId?: string,
    ip?: string
  ) {
    // D1 不支持 begin/transaction，这里改为顺序执行
    const employee = await query(
      this.db,
      'EmployeeService.update.getEmployee',
      () => this.db.select().from(employees).where(eq(employees.id, id)).get(),
      c
    )
    if (!employee) {
      throw Errors.NOT_FOUND('员工')
    }

    // 记录职位变更前的信息
    const oldPositionId = employee.positionId
    const positionChanged = data.positionId !== undefined && data.positionId !== oldPositionId

    const updateData: any = { updatedAt: Date.now() }
    if (data.name !== undefined) { updateData.name = data.name }
    if (data.projectId !== undefined) { updateData.projectId = data.projectId }
    if (data.orgDepartmentId !== undefined) { updateData.orgDepartmentId = data.orgDepartmentId }
    if (data.positionId !== undefined) { updateData.positionId = data.positionId }
    if (data.joinDate !== undefined) { updateData.joinDate = data.joinDate }
    if (data.active !== undefined) { updateData.active = Number(data.active) }
    if (data.phone !== undefined) { updateData.phone = data.phone }
    if (data.personalEmail !== undefined) { updateData.personalEmail = data.personalEmail.toLowerCase() }
    if (data.usdtAddress !== undefined) { updateData.usdtAddress = data.usdtAddress }
    if (data.emergencyContact !== undefined) { updateData.emergencyContact = data.emergencyContact }
    if (data.emergencyPhone !== undefined) { updateData.emergencyPhone = data.emergencyPhone }
    if (data.address !== undefined) { updateData.address = data.address }
    if (data.memo !== undefined) { updateData.memo = data.memo }
    if (data.birthday !== undefined) { updateData.birthday = data.birthday }
    if (data.annualLeaveCycleMonths !== undefined) { updateData.annualLeaveCycleMonths = Number(data.annualLeaveCycleMonths) || null }
    if (data.annualLeaveDays !== undefined) { updateData.annualLeaveDays = Number(data.annualLeaveDays) || null }
    if (data.workSchedule !== undefined) {
      updateData.workSchedule =
        typeof data.workSchedule === 'string'
          ? data.workSchedule
          : JSON.stringify(data.workSchedule)
    }

    await this.db.update(employees).set(updateData).where(eq(employees.id, id)).run()

    // 记录职位变更审计
    if (positionChanged && this.permissionAuditService && operatorId) {
      // 获取新旧职位信息
      let oldPosition = null
      let newPosition = null

      if (oldPositionId) {
        oldPosition = await this.db
          .select({ id: positions.id, name: positions.name, code: positions.code })
          .from(positions)
          .where(eq(positions.id, oldPositionId))
          .get()
      }

      if (data.positionId) {
        newPosition = await this.db
          .select({ id: positions.id, name: positions.name, code: positions.code })
          .from(positions)
          .where(eq(positions.id, data.positionId))
          .get()
      }

      await this.permissionAuditService.logPermissionChange({
        changeType: 'employee_position_change',
        entityType: 'employee',
        entityId: id,
        beforeData: {
          positionId: oldPositionId,
          positionName: oldPosition?.name || null,
          positionCode: oldPosition?.code || null,
        },
        afterData: {
          positionId: data.positionId,
          positionName: newPosition?.name || null,
          positionCode: newPosition?.code || null,
        },
        operatorId,
        ip,
      })
    }

    // 失效权限缓存（如果权限相关字段有变更）
    const permissionRelatedFieldsChanged = 
      data.positionId !== undefined ||
      data.orgDepartmentId !== undefined

    if (permissionRelatedFieldsChanged && this.permissionCache) {
      // 异步失效缓存，不阻塞响应
      this.permissionCache.invalidateByEmployeeId(id).catch(err => {
        // 静默失败，已在 PermissionCache 中记录日志
      })
    }

    return { id }
  }

  async regularize(id: string, date: string, c?: Context<{ Bindings: Env; Variables: AppVariables }>) {
    const employee = await query(
      this.db,
      'EmployeeService.regularize.getEmployee',
      () => this.db.select().from(employees).where(eq(employees.id, id)).get(),
      c
    )
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

  async leave(id: string, date: string, reason?: string, c?: Context<{ Bindings: Env; Variables: AppVariables }>) {
    const employee = await query(
      this.db,
      'EmployeeService.leave.getEmployee',
      () => this.db.select().from(employees).where(eq(employees.id, id)).get(),
      c
    )
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

  async rejoin(id: string, date: string, c?: Context<{ Bindings: Env; Variables: AppVariables }>) {
    const employee = await query(
      this.db,
      'EmployeeService.rejoin.getEmployee',
      () => this.db.select().from(employees).where(eq(employees.id, id)).get(),
      c
    )
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
        projectId: schema.employees.projectId,
        orgDepartmentId: schema.employees.orgDepartmentId,
      })
      .from(schema.employees)
      .where(eq(schema.employees.id, userId))
      .get()

    if (!employee || !employee.positionId) { return [] }

    const position = await this.db
      .select()
      .from(schema.positions)
      .where(eq(schema.positions.id, employee.positionId))
      .get()
    if (!position || !position.canManageSubordinates) { return [] }

    const DataScope = {
      ALL: 'all',
      PROJECT: 'project',
      GROUP: 'group',
      SELF: 'self',
    }

    // 1. DataScope.ALL: View all employees
    if (position.dataScope === DataScope.ALL) {
      const all = await this.db
        .select({ id: employees.id })
        .from(employees)
        .where(eq(employees.active, 1))
        .execute()
      return all.map(e => e.id)
    }

    // 2. DataScope.PROJECT: View project employees
    if (position.dataScope === DataScope.PROJECT && employee?.projectId) {
      const deptEmployees = await this.db
        .select({ id: employees.id })
        .from(employees)
        .where(and(eq(employees.projectId, employee.projectId), eq(employees.active, 1)))
        .execute()
      return deptEmployees.map(e => e.id)
    }

    // 3. DataScope.GROUP: View group employees
    if (position.dataScope === DataScope.GROUP && employee?.orgDepartmentId) {
      const teamEmployees = await this.db
        .select({ id: employees.id })
        .from(employees)
        .where(
          and(eq(employees.orgDepartmentId, employee.orgDepartmentId), eq(employees.active, 1))
        )
        .execute()
      return teamEmployees.map(e => e.id)
    }

    // 4. DataScope.SELF: View self (though usually not called for "subordinates")
    if (position.dataScope === DataScope.SELF) {
      return []
    }

    return []
  }

  // ========== 用户相关方法（原 UserService 已合并） ==========

  /**
   * 根据 ID 获取员工信息
   */
  async getUserById(id: string) {
    return this.getById(id)
  }

  /**
   * 根据邮箱获取员工信息
   */
  async getUserByEmail(email: string, c?: Context<{ Bindings: Env; Variables: AppVariables }>) {
    const user = await query(
      this.db,
      'EmployeeService.getUserByEmail',
      () => this.db
        .select()
        .from(employees)
        .where(eq(employees.personalEmail, email))
        .get(),
      c
    )
    return user || null
  }

  /**
   * 获取用户职位信息（包含权限）
   */
  async getUserPosition(userId: string, c?: Context<{ Bindings: Env; Variables: AppVariables }>) {
    const employee = await query(
      this.db,
      'EmployeeService.getUserPosition.getEmployee',
      () => this.db
        .select({
          positionId: employees.positionId,
        })
        .from(employees)
        .where(and(eq(employees.id, userId), eq(employees.active, 1)))
        .get(),
      c
    )

    if (!employee?.positionId) { return null }

    const { positions } = await import('../../db/schema.js')
    const posId = employee.positionId
    const result = await query(
      this.db,
      'EmployeeService.getUserPosition.getPosition',
      () => this.db
        .select({
          id: positions.id,
          code: positions.code,
          name: positions.name,
          canManageSubordinates: positions.canManageSubordinates,
          dataScope: positions.dataScope,
          permissions: positions.permissions,
        })
        .from(positions)
        .where(and(eq(positions.id, posId), eq(positions.active, 1)))
        .get(),
      c
    )

    if (!result) { return null }

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
      canManageSubordinates: result.canManageSubordinates,
      dataScope: result.dataScope || 'self',
      permissions,
    }
  }

  /**
   * 检查用户是否有全公司数据访问权限
   * 通过职位的 dataScope === 'all' 判断
   */
  async isHQUser(userId: string): Promise<boolean> {
    const { positions } = await import('../../db/schema.js')
    const employee = await this.db.query.employees.findFirst({
      where: and(eq(employees.id, userId), eq(employees.active, 1)),
    })
    if (!employee?.positionId) { return false }

    const position = await this.db
      .select({ dataScope: positions.dataScope })
      .from(positions)
      .where(and(eq(positions.id, employee.positionId), eq(positions.active, 1)))
      .get()

    return position?.dataScope === 'all'
  }

  /**
   * 获取用户组 ID（组织部门）
   */
  async getUserGroupId(userId: string): Promise<string | null> {
    const employee = await this.getUserById(userId)
    if (!employee?.orgDepartmentId) { return null }

    const { orgDepartments } = await import('../../db/schema.js')
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
  async getUserOrgProjectId(userId: string): Promise<string | null> {
    const employee = await this.getUserById(userId)
    return employee?.orgDepartmentId || null
  }

  /**
   * 获取用户部门 ID
   * (简化版 - 使用 employees.projectId)
   */
  async getUserProjectId(userId: string): Promise<string | null> {
    const employee = await this.getUserById(userId)
    return employee?.projectId || null
  }
}
