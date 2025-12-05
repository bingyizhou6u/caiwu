import { v4 as uuid } from 'uuid'
import { DrizzleD1Database, drizzle } from 'drizzle-orm/d1'
import { eq, and, gt } from 'drizzle-orm'
import * as schema from '../db/schema.js'
import { users, sessions, employees, positions, orgDepartments } from '../db/schema.js'

export { uuid }

export function createDb(d1: D1Database) {
  return drizzle(d1, { schema })
}

export async function getUserByEmail(db: DrizzleD1Database<typeof schema>, email: string) {
  return await db.select()
    .from(users)
    .where(eq(users.email, email))
    .get()
}

export async function getUserById(db: DrizzleD1Database<typeof schema>, id: string) {
  return await db.select()
    .from(users)
    .where(eq(users.id, id))
    .get()
}

export async function createSession(db: DrizzleD1Database<typeof schema>, user_id: string) {
  const id = uuid()
  const expires = Date.now() + 1000 * 60 * 60 * 24 * 7

  await db.insert(sessions).values({
    id,
    userId: user_id,
    expiresAt: expires,
    createdAt: Date.now()
  }).execute()

  return { id, expires }
}

export async function getSession(db: DrizzleD1Database<typeof schema>, id: string) {
  const s = await db.select()
    .from(sessions)
    .where(eq(sessions.id, id))
    .get()

  if (!s) return null
  if (s.expiresAt && s.expiresAt < Date.now()) return null
  return s
}

// 获取用户的 employee_id（通过 email 匹配）
export async function getUserEmployeeId(db: DrizzleD1Database<typeof schema>, userId: string): Promise<string | null> {
  const user = await getUserById(db, userId)
  if (!user?.email) return null

  const employee = await db.select({ id: employees.id })
    .from(employees)
    .where(and(
      eq(employees.email, user.email),
      eq(employees.active, 1)
    ))
    .get()

  return employee?.id || null
}

// 获取用户的职位信息（必须从员工记录获取）
export async function getUserPosition(db: DrizzleD1Database<typeof schema>, userId: string): Promise<{
  id: string
  code: string
  name: string
  level: number
  can_manage_subordinates: number
  permissions: any
} | null> {
  const result = await db.select({
    id: positions.id,
    code: positions.code,
    name: positions.name,
    level: positions.level,
    can_manage_subordinates: positions.canManageSubordinates,
    permissions: positions.permissions
  })
    .from(users)
    .innerJoin(employees, and(
      eq(employees.email, users.email),
      eq(employees.active, 1)
    ))
    .innerJoin(positions, and(
      eq(positions.id, employees.positionId),
      eq(positions.active, 1)
    ))
    .where(eq(users.id, userId))
    .get()

  if (!result) return null

  let permissions = {}
  try {
    permissions = JSON.parse(result.permissions || '{}')
  } catch (err) {
    console.error('Failed to parse permissions JSON:', err)
  }

  return {
    id: result.id,
    code: result.code,
    name: result.name,
    level: result.level,
    can_manage_subordinates: result.can_manage_subordinates,
    permissions
  }
}

// 优化版本：一次性获取session、user、position、employee和部门模块信息
export async function getSessionWithUserAndPosition(db: DrizzleD1Database<typeof schema>, sessionId: string): Promise<{
  session: { id: string, user_id: string, expires_at: number } | null
  user: { id: string, email: string, name: string } | null
  position: {
    id: string
    code: string
    name: string
    level: number
    can_manage_subordinates: number
    permissions: any
  } | null
  employee: {
    id: string
    org_department_id: string | null
    department_id: string | null
  } | null
  departmentModules: string[] // 部门允许的模块列表
} | null> {
  const now = Date.now()

  const result = await db.select({
    // session
    sessionId: sessions.id,
    userId: sessions.userId,
    expiresAt: sessions.expiresAt,
    // user
    userEmail: users.email,
    // employee
    employeeName: employees.name,
    employeeId: employees.id,
    orgDepartmentId: employees.orgDepartmentId,
    employeeDepartmentId: employees.departmentId,
    // position
    positionId: positions.id,
    positionCode: positions.code,
    positionName: positions.name,
    positionLevel: positions.level,
    positionCanManageSubordinates: positions.canManageSubordinates,
    positionPermissions: positions.permissions,
    // org department
    departmentAllowedModules: orgDepartments.allowedModules
  })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .leftJoin(employees, and(
      eq(employees.email, users.email),
      eq(employees.active, 1)
    ))
    .leftJoin(positions, and(
      eq(positions.id, employees.positionId),
      eq(positions.active, 1)
    ))
    .leftJoin(orgDepartments, and(
      eq(orgDepartments.id, employees.orgDepartmentId),
      eq(orgDepartments.active, 1)
    ))
    .where(and(
      eq(sessions.id, sessionId),
      gt(sessions.expiresAt, now)
    ))
    .get()

  if (!result || !result.expiresAt) return null

  const position = result.positionId ? {
    id: result.positionId,
    code: result.positionCode!,
    name: result.positionName!,
    level: result.positionLevel!,
    can_manage_subordinates: result.positionCanManageSubordinates!,
    permissions: JSON.parse(result.positionPermissions || '{}')
  } : null

  const employee = result.employeeId ? {
    id: result.employeeId,
    org_department_id: result.orgDepartmentId,
    department_id: result.employeeDepartmentId
  } : null

  // 解析部门允许的模块
  let departmentModules: string[] = ['*'] // 默认允许所有模块
  if (result.departmentAllowedModules) {
    try {
      departmentModules = JSON.parse(result.departmentAllowedModules)
    } catch {
      departmentModules = ['*']
    }
  }

  return {
    session: {
      id: result.sessionId,
      user_id: result.userId,
      expires_at: result.expiresAt
    },
    user: {
      id: result.userId,
      email: result.userEmail,
      name: result.employeeName || result.userEmail.split('@')[0]
    },
    position,
    employee,
    departmentModules
  }
}

// 获取用户完整的上下文信息（用于生成 Session 缓存）
export async function getUserFullContext(db: DrizzleD1Database<typeof schema>, userId: string): Promise<{
  user: { id: string, email: string, name: string }
  position: {
    id: string
    code: string
    name: string
    level: number
    can_manage_subordinates: number
    permissions: any
  } | null
  employee: {
    id: string
    org_department_id: string | null
    department_id: string | null
  } | null
  departmentModules: string[]
} | null> {
  const result = await db.select({
    // user
    userId: users.id,
    userEmail: users.email,
    // employee
    employeeName: employees.name,
    employeeId: employees.id,
    orgDepartmentId: employees.orgDepartmentId,
    employeeDepartmentId: employees.departmentId,
    // position
    positionId: positions.id,
    positionCode: positions.code,
    positionName: positions.name,
    positionLevel: positions.level,
    positionCanManageSubordinates: positions.canManageSubordinates,
    positionPermissions: positions.permissions,
    // org department
    departmentAllowedModules: orgDepartments.allowedModules
  })
    .from(users)
    .leftJoin(employees, and(
      eq(employees.email, users.email),
      eq(employees.active, 1)
    ))
    .leftJoin(positions, and(
      eq(positions.id, employees.positionId),
      eq(positions.active, 1)
    ))
    .leftJoin(orgDepartments, and(
      eq(orgDepartments.id, employees.orgDepartmentId),
      eq(orgDepartments.active, 1)
    ))
    .where(eq(users.id, userId))
    .get()

  if (!result) return null

  const position = result.positionId ? {
    id: result.positionId,
    code: result.positionCode!,
    name: result.positionName!,
    level: result.positionLevel!,
    can_manage_subordinates: result.positionCanManageSubordinates!,
    permissions: JSON.parse(result.positionPermissions || '{}')
  } : null

  const employee = result.employeeId ? {
    id: result.employeeId,
    org_department_id: result.orgDepartmentId,
    department_id: result.employeeDepartmentId
  } : null

  let departmentModules: string[] = ['*']
  if (result.departmentAllowedModules) {
    try {
      departmentModules = JSON.parse(result.departmentAllowedModules)
    } catch {
      departmentModules = ['*']
    }
  }

  return {
    user: {
      id: result.userId,
      email: result.userEmail,
      name: result.employeeName || result.userEmail.split('@')[0]
    },
    position,
    employee,
    departmentModules
  }
}
