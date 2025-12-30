import { v4 as uuid } from 'uuid'
import { DrizzleD1Database, drizzle } from 'drizzle-orm/d1'
import { eq, and, gt } from 'drizzle-orm'
import * as schema from '../db/schema.js'
import { sessions, employees, positions, orgDepartments } from '../db/schema.js'

export { uuid }

export function createDb(d1: D1Database) {
  return drizzle(d1, { schema })
}

// getUserByEmail 现在通过 personalEmail 查询 employees 表

export async function createSession(db: DrizzleD1Database<typeof schema>, employeeId: string) {
  const id = uuid()
  const expires = Date.now() + 1000 * 60 * 60 * 24 * 7

  await db
    .insert(sessions)
    .values({
      id,
      employeeId,
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

// getUserEmployeeId - 由于用户和员工已合并，直接返回 ID

// 获取用户的职位信息（从员工记录获取）

// 优化版本：一次性获取session、user、position、employee和部门模块信息
// D1 兼容性修复：使用顺序查询代替复杂 JOIN
export async function getSessionWithUserAndPosition(
  d1: D1Database,
  sessionId: string
): Promise<{
  session: { id: string; employeeId: string; expires_at: number } | null
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
    projectId: string | null
  } | null
  departmentModules: string[] // 部门允许的模块列表
} | null> {
  const db = drizzle(d1, { schema })
  const now = Date.now()

  // 1. 查询 session
  const session = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, now)))
    .get()

  if (!session || !session.expiresAt) { return null }

  // 2. 查询 employee
  const employee = await db
    .select()
    .from(employees)
    .where(and(eq(employees.id, session.employeeId), eq(employees.active, 1)))
    .get()

  if (!employee) { return null }

  // 3. 查询 position
  let position = null
  if (employee.positionId) {
    const pos = await db
      .select()
      .from(positions)
      .where(and(eq(positions.id, employee.positionId), eq(positions.active, 1)))
      .get()

    if (pos) {
      position = {
        id: pos.id,
        code: pos.code,
        name: pos.name,
        canManageSubordinates: pos.canManageSubordinates ?? 0,
        dataScope: pos.dataScope || 'self',
        permissions: JSON.parse(pos.permissions || '{}'),
      }
    }
  }

  // 4. 查询 org department modules
  let departmentModules: string[] = ['*']
  if (employee.orgDepartmentId) {
    const dept = await db
      .select()
      .from(orgDepartments)
      .where(and(eq(orgDepartments.id, employee.orgDepartmentId), eq(orgDepartments.active, 1)))
      .get()

    if (dept && dept.allowedModules) {
      try {
        departmentModules = JSON.parse(dept.allowedModules)
      } catch {
        departmentModules = ['*']
      }
    }
  }

  return {
    session: {
      id: session.id,
      employeeId: session.employeeId,
      expires_at: session.expiresAt,
    },
    user: {
      id: employee.id,
      email: employee.personalEmail || '',
      name: employee.name || (employee.personalEmail || '').split('@')[0],
    },
    position,
    employee: {
      id: employee.id,
      orgDepartmentId: employee.orgDepartmentId,
      projectId: employee.projectId,
    },
    departmentModules,
  }
}

// 获取用户完整的上下文信息（用于生成 Session 缓存）
// 优化：并行化 position 和 department 查询
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
    projectId: string | null
  } | null
  departmentModules: string[]
} | null> {
  const employee = await db
    .select()
    .from(employees)
    .where(and(eq(employees.id, userId), eq(employees.active, 1)))
    .get()

  if (!employee) return null

  // 并行查询 position 和 department
  const [posResult, deptResult] = await Promise.all([
    employee.positionId
      ? db
        .select()
        .from(positions)
        .where(and(eq(positions.id, employee.positionId), eq(positions.active, 1)))
        .get()
      : Promise.resolve(null),
    employee.orgDepartmentId
      ? db
        .select()
        .from(orgDepartments)
        .where(and(eq(orgDepartments.id, employee.orgDepartmentId), eq(orgDepartments.active, 1)))
        .get()
      : Promise.resolve(null),
  ])

  // 处理 position
  let position = null
  if (posResult) {
    position = {
      id: posResult.id,
      code: posResult.code,
      name: posResult.name,
      canManageSubordinates: posResult.canManageSubordinates ?? 0,
      dataScope: posResult.dataScope,
      permissions: JSON.parse(posResult.permissions || '{}'),
    }
  }

  // 处理 department modules
  let departmentModules: string[] = ['*']
  if (deptResult && deptResult.allowedModules) {
    try {
      departmentModules = JSON.parse(deptResult.allowedModules)
    } catch {
      departmentModules = ['*']
    }
  }

  return {
    user: {
      id: employee.id,
      email: employee.personalEmail || '',
      name: employee.name || (employee.personalEmail || '').split('@')[0],
    },
    position,
    employee: {
      id: employee.id,
      orgDepartmentId: employee.orgDepartmentId,
      projectId: employee.projectId,
    },
    departmentModules,
  }
}
