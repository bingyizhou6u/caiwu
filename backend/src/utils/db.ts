import { v4 as uuid } from 'uuid'

export { uuid }

import { drizzle } from 'drizzle-orm/d1'
import * as schema from '../db/schema.js'

export function createDb(d1: D1Database) {
  return drizzle(d1, { schema })
}

export async function getUserByEmail(db: D1Database, email: string) {
  return db.prepare('select * from users where email=?').bind(email).first<any>()
}

export async function getUserById(db: D1Database, id: string) {
  return db.prepare('select * from users where id=?').bind(id).first<any>()
}


export async function createSession(db: D1Database, user_id: string) {
  const id = uuid()
  const expires = Date.now() + 1000 * 60 * 60 * 24 * 7
  await db.prepare('insert into sessions(id,user_id,expires_at) values(?,?,?)').bind(id, user_id, expires).run()
  return { id, expires }
}

export async function getSession(db: D1Database, id: string) {
  const s = await db.prepare('select * from sessions where id=?').bind(id).first<any>()
  if (!s) return null
  if (s.expires_at && s.expires_at < Date.now()) return null
  return s
}

// 获取用户的 employee_id（通过 email 匹配）
export async function getUserEmployeeId(db: D1Database, userId: string): Promise<string | null> {
  const user = await getUserById(db, userId)
  if (!user?.email) return null

  const employee = await db.prepare('select id from employees where email=? and active=1').bind(user.email).first<{ id: string }>()
  return employee?.id || null
}

// 获取用户的职位信息（必须从员工记录获取）
export async function getUserPosition(db: D1Database, userId: string): Promise<{
  id: string
  code: string
  name: string
  level: number
  function_role: string
  can_manage_subordinates: number
  permissions: any
} | null> {
  const result = await db.prepare(`
    select 
      p.id,
      p.code,
      p.name,
      p.level,
      p.function_role,
      p.can_manage_subordinates,
      p.permissions
    from users u
    inner join employees e on e.email = u.email and e.active = 1
    inner join positions p on p.id = e.position_id and p.active = 1
    where u.id = ?
  `).bind(userId).first<{
    id: string
    code: string
    name: string
    level: number
    function_role: string
    can_manage_subordinates: number
    permissions: string
  }>()

  if (!result) return null

  return {
    id: result.id,
    code: result.code,
    name: result.name,
    level: result.level,
    function_role: result.function_role,
    can_manage_subordinates: result.can_manage_subordinates,
    permissions: JSON.parse(result.permissions || '{}')
  }
}

// 优化版本：一次性获取session、user、position、employee和部门模块信息
export async function getSessionWithUserAndPosition(db: D1Database, sessionId: string): Promise<{
  session: { id: string, user_id: string, expires_at: number } | null
  user: { id: string, email: string, name: string } | null
  position: {
    id: string
    code: string
    name: string
    level: number
    function_role: string
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
  const result = await db.prepare(`
    select 
      s.id as session_id,
      s.user_id,
      s.expires_at,
      u.id as user_id,
      u.email,
      e.name,
      p.id as position_id,
      p.code as position_code,
      p.name as position_name,
      p.level as position_level,
      p.function_role as position_function_role,
      p.can_manage_subordinates as position_can_manage_subordinates,
      p.permissions as position_permissions,
      e.id as employee_id,
      e.org_department_id,
      e.department_id as employee_department_id,
      od.allowed_modules as department_allowed_modules
    from sessions s
    inner join users u on u.id = s.user_id
    left join employees e on e.email = u.email and e.active = 1
    left join positions p on p.id = e.position_id and p.active = 1
    left join org_departments od on od.id = e.org_department_id and od.active = 1
    where s.id = ? and s.expires_at > ?
  `).bind(sessionId, Date.now()).first<{
    session_id: string
    user_id: string
    expires_at: number
    email: string
    name: string | null
    position_id: string | null
    position_code: string | null
    position_name: string | null
    position_level: number | null
    position_function_role: string | null
    position_can_manage_subordinates: number | null
    position_permissions: string | null
    employee_id: string | null
    org_department_id: string | null
    employee_department_id: string | null
    department_allowed_modules: string | null
  }>()

  if (!result) return null

  const position = result.position_id ? {
    id: result.position_id,
    code: result.position_code!,
    name: result.position_name!,
    level: result.position_level!,
    function_role: result.position_function_role!,
    can_manage_subordinates: result.position_can_manage_subordinates!,
    permissions: JSON.parse(result.position_permissions || '{}')
  } : null

  const employee = result.employee_id ? {
    id: result.employee_id,
    org_department_id: result.org_department_id,
    department_id: result.employee_department_id
  } : null

  // 解析部门允许的模块
  let departmentModules: string[] = ['*'] // 默认允许所有模块
  if (result.department_allowed_modules) {
    try {
      departmentModules = JSON.parse(result.department_allowed_modules)
    } catch {
      departmentModules = ['*']
    }
  }

  return {
    session: {
      id: result.session_id,
      user_id: result.user_id,
      expires_at: result.expires_at
    },
    user: {
      id: result.user_id,
      email: result.email,
      name: result.name || result.email.split('@')[0]
    },
    position,
    employee,
    departmentModules
  }
}

// 获取用户完整的上下文信息（用于生成 Session 缓存）
export async function getUserFullContext(db: D1Database, userId: string): Promise<{
  user: { id: string, email: string, name: string }
  position: {
    id: string
    code: string
    name: string
    level: number
    function_role: string
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
  const result = await db.prepare(`
    select 
      u.id as user_id,
      u.email,
      e.name,
      p.id as position_id,
      p.code as position_code,
      p.name as position_name,
      p.level as position_level,
      p.function_role as position_function_role,
      p.can_manage_subordinates as position_can_manage_subordinates,
      p.permissions as position_permissions,
      e.id as employee_id,
      e.org_department_id,
      e.department_id as employee_department_id,
      od.allowed_modules as department_allowed_modules
    from users u
    left join employees e on e.email = u.email and e.active = 1
    left join positions p on p.id = e.position_id and p.active = 1
    left join org_departments od on od.id = e.org_department_id and od.active = 1
    where u.id = ?
  `).bind(userId).first<{
    user_id: string
    email: string
    name: string | null
    position_id: string | null
    position_code: string | null
    position_name: string | null
    position_level: number | null
    position_function_role: string | null
    position_can_manage_subordinates: number | null
    position_permissions: string | null
    employee_id: string | null
    org_department_id: string | null
    employee_department_id: string | null
    department_allowed_modules: string | null
  }>()

  if (!result) return null

  const position = result.position_id ? {
    id: result.position_id,
    code: result.position_code!,
    name: result.position_name!,
    level: result.position_level!,
    function_role: result.position_function_role!,
    can_manage_subordinates: result.position_can_manage_subordinates!,
    permissions: JSON.parse(result.position_permissions || '{}')
  } : null

  const employee = result.employee_id ? {
    id: result.employee_id,
    org_department_id: result.org_department_id,
    department_id: result.employee_department_id
  } : null

  let departmentModules: string[] = ['*']
  if (result.department_allowed_modules) {
    try {
      departmentModules = JSON.parse(result.department_allowed_modules)
    } catch {
      departmentModules = ['*']
    }
  }

  return {
    user: {
      id: result.user_id,
      email: result.email,
      name: result.name || result.email.split('@')[0]
    },
    position,
    employee,
    departmentModules
  }
}

