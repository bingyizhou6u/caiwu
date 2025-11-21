import { v4 as uuid } from 'uuid'

export { uuid }

export async function getUserByEmail(db: D1Database, email: string) {
  return db.prepare('select * from users where email=?').bind(email).first<any>()
}

export async function getUserById(db: D1Database, id: string) {
  return db.prepare('select * from users where id=?').bind(id).first<any>()
}

// 根据职位代码获取用户角色（用于向后兼容，权限由职位决定）
export function getRoleByPositionCode(positionCode: string): string {
  if (positionCode === 'hq_admin' || positionCode === 'project_manager') {
    return 'manager'
  }
  if (positionCode.includes('finance')) {
    return 'finance'
  }
  if (positionCode.includes('hr')) {
    return 'hr'
  }
  if (positionCode.includes('admin_dept')) {
    return 'admin'
  }
  return 'employee' // Default for tech, group leaders, and general employees
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
export async function getUserPosition(db: D1Database, userId: string): Promise<{ id: string, code: string, name: string, level: string, scope: string, permissions: any } | null> {
  // 使用单个JOIN查询获取用户、员工和职位信息
  const result = await db.prepare(`
    select 
      p.id,
      p.code,
      p.name,
      p.level,
      p.scope,
      p.permissions
    from users u
    inner join employees e on e.email = u.email and e.active = 1
    inner join positions p on p.id = e.position_id and p.active = 1
    where u.id = ?
  `).bind(userId).first<{
    id: string
    code: string
    name: string
    level: string
    scope: string
    permissions: string
  }>()

  if (!result) {
    return null
  }

  return {
    id: result.id,
    code: result.code,
    name: result.name,
    level: result.level,
    scope: result.scope,
    permissions: JSON.parse(result.permissions || '{}')
  }
}

// 优化版本：一次性获取session、user、position和employee信息，并计算role
export async function getSessionWithUserAndPosition(db: D1Database, sessionId: string): Promise<{
  session: { id: string, user_id: string, expires_at: number } | null
  user: { id: string, email: string, name: string } | null
  position: { id: string, code: string, name: string, level: string, scope: string, permissions: any } | null
  employee: { org_department_id: string | null, department_id: string | null } | null
  role: string | null
} | null> {
  const result = await db.prepare(`
    select 
      s.id as session_id,
      s.user_id,
      s.expires_at,
      u.id as user_id,
      u.email,
      u.name,
      p.id as position_id,
      p.code as position_code,
      p.name as position_name,
      p.level as position_level,
      p.scope as position_scope,
      p.permissions as position_permissions,
      e.org_department_id,
      e.department_id as employee_department_id
    from sessions s
    inner join users u on u.id = s.user_id
    left join employees e on e.email = u.email and e.active = 1
    left join positions p on p.id = e.position_id and p.active = 1
    where s.id = ? and s.expires_at > ?
  `).bind(sessionId, Date.now()).first<{
    session_id: string
    user_id: string
    expires_at: number
    email: string
    name: string
    position_id: string | null
    position_code: string | null
    position_name: string | null
    position_level: string | null
    position_scope: string | null
    position_permissions: string | null
    org_department_id: string | null
    employee_department_id: string | null
  }>()

  if (!result) {
    return null
  }

  const position = result.position_id ? {
    id: result.position_id,
    code: result.position_code!,
    name: result.position_name!,
    level: result.position_level!,
    scope: result.position_scope!,
    permissions: JSON.parse(result.position_permissions || '{}')
  } : null

  const employee = result.org_department_id !== null || result.employee_department_id !== null ? {
    org_department_id: result.org_department_id,
    department_id: result.employee_department_id
  } : null

  // 计算role（如果position存在）
  const role = position ? getRoleByPositionCode(position.code) : null

  return {
    session: {
      id: result.session_id,
      user_id: result.user_id,
      expires_at: result.expires_at
    },
    user: {
      id: result.user_id,
      email: result.email,
      name: result.name
    },
    position,
    employee,
    role
  }
}

