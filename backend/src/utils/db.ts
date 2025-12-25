import { v4 as uuid } from 'uuid'
import { DrizzleD1Database, drizzle } from 'drizzle-orm/d1'
import { eq, and, gt } from 'drizzle-orm'
import * as schema from '../db/schema.js'
import { sessions, employees, positions, orgDepartments } from '../db/schema.js'

export { uuid }

export function createDb(d1: D1Database) {
  return drizzle(d1, { schema })
}

// getUserByEmail now queries employees table by personalEmail

export async function createSession(db: DrizzleD1Database<typeof schema>, user_id: string) {
  const id = uuid()
  const expires = Date.now() + 1000 * 60 * 60 * 24 * 7

  await db
    .insert(sessions)
    .values({
      id,
      userId: user_id,
      expiresAt: expires,
      createdAt: Date.now(),
    })
    .execute()

  return { id, expires }
}

export async function getSession(db: DrizzleD1Database<typeof schema>, id: string) {
  const s = await db.select().from(sessions).where(eq(sessions.id, id)).get()

  if (!s) { return null }
  if (s.expiresAt && s.expiresAt < Date.now()) { return null }
  return s
}

// getUserEmployeeId - since users and employees are merged, just return the id

// 获取用户的职位信息（从员工记录获取）

// 优化版本：一次性获取session、user、position、employee和部门模块信息
export async function getSessionWithUserAndPosition(
  d1: D1Database,
  sessionId: string
): Promise<{
  session: { id: string; user_id: string; expires_at: number } | null
  user: { id: string; email: string; name: string } | null
  position: {
    id: string
    code: string
    name: string
    canManageSubordinates: number
    dataScope: string
    permissions: any
  } | null
  employee: {
    id: string
    orgDepartmentId: string | null
    departmentId: string | null
  } | null
  departmentModules: string[] // 部门允许的模块列表
} | null> {
  const db = drizzle(d1, { schema })
  const now = Date.now()

  const result = await db
    .select({
      // session
      sessionId: sessions.id,
      userId: sessions.userId,
      expiresAt: sessions.expiresAt,
      // employee (merged with user)
      employeeEmail: employees.personalEmail,
      employeeName: employees.name,
      employeeId: employees.id,
      orgDepartmentId: employees.orgDepartmentId,
      employeeDepartmentId: employees.departmentId,
      // position
      positionId: positions.id,
      positionCode: positions.code,
      positionName: positions.name,
      positionCanManageSubordinates: positions.canManageSubordinates,
      positionDataScope: positions.dataScope,
      positionPermissions: positions.permissions,
      // org department
      departmentAllowedModules: orgDepartments.allowedModules,
    })
    .from(sessions)
    .innerJoin(employees, eq(employees.id, sessions.userId))
    .leftJoin(positions, and(eq(positions.id, employees.positionId), eq(positions.active, 1)))
    .leftJoin(
      orgDepartments,
      and(eq(orgDepartments.id, employees.orgDepartmentId), eq(orgDepartments.active, 1))
    )
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, now), eq(employees.active, 1)))
    .get()

  if (!result || !result.expiresAt) { return null }

  const position = result.positionId
    ? {
      id: result.positionId,
      code: result.positionCode!,
      name: result.positionName!,
      canManageSubordinates: result.positionCanManageSubordinates!,
      dataScope: result.positionDataScope || 'self',
      permissions: JSON.parse(result.positionPermissions || '{}'),
    }
    : null

  const employee = result.employeeId
    ? {
      id: result.employeeId,
      orgDepartmentId: result.orgDepartmentId,
      departmentId: result.employeeDepartmentId,
    }
    : null

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
      expires_at: result.expiresAt,
    },
    user: {
      id: result.employeeId!,
      email: result.employeeEmail || '',
      name: result.employeeName || (result.employeeEmail || '').split('@')[0],
    },
    position,
    employee,
    departmentModules,
  }
}

// 获取用户完整的上下文信息（用于生成 Session 缓存）
export async function getUserFullContext(
  db: DrizzleD1Database<typeof schema>,
  userId: string
): Promise<{
  user: { id: string; email: string; name: string }
  position: {
    id: string
    code: string
    name: string
    canManageSubordinates: number
    dataScope: string
    permissions: any
  } | null
  employee: {
    id: string
    orgDepartmentId: string | null
    departmentId: string | null
  } | null
  departmentModules: string[]
} | null> {
  const result = await db
    .select({
      // employee (merged user)
      userId: employees.id,
      userEmail: employees.personalEmail,
      employeeName: employees.name,
      employeeId: employees.id,
      orgDepartmentId: employees.orgDepartmentId,
      employeeDepartmentId: employees.departmentId,
      // position
      positionId: positions.id,
      positionCode: positions.code,
      positionName: positions.name,
      positionCanManageSubordinates: positions.canManageSubordinates,
      positionDataScope: positions.dataScope,
      positionPermissions: positions.permissions,
      // org department
      departmentAllowedModules: orgDepartments.allowedModules,
    })
    .from(employees)
    .leftJoin(positions, and(eq(positions.id, employees.positionId), eq(positions.active, 1)))
    .leftJoin(
      orgDepartments,
      and(eq(orgDepartments.id, employees.orgDepartmentId), eq(orgDepartments.active, 1))
    )
    .where(and(eq(employees.id, userId), eq(employees.active, 1)))
    .get()

  if (!result) { return null }

  const position = result.positionId
    ? {
      id: result.positionId,
      code: result.positionCode!,
      name: result.positionName!,
      canManageSubordinates: result.positionCanManageSubordinates!,
      dataScope: result.positionDataScope || 'self',
      permissions: JSON.parse(result.positionPermissions || '{}'),
    }
    : null

  const employee = result.employeeId
    ? {
      id: result.employeeId,
      orgDepartmentId: result.orgDepartmentId,
      departmentId: result.employeeDepartmentId,
    }
    : null

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
      email: result.userEmail || '',
      name: result.employeeName || (result.userEmail || '').split('@')[0],
    },
    position,
    employee,
    departmentModules,
  }
}
