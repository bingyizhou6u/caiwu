import { v4 as uuid } from 'uuid'
import { logAudit } from './audit.js'

export { uuid }

export async function getUserByEmail(db: D1Database, email: string) {
  return db.prepare('select * from users where email=?').bind(email).first<any>()
}

export async function getUserById(db: D1Database, id: string) {
  return db.prepare('select * from users where id=?').bind(id).first<any>()
}

export async function getOrCreateDefaultHQ(db: D1Database) {
  const hq = await db.prepare('select id,name from headquarters where active=1 limit 1').first<{ id: string, name: string }>()
  if (hq?.id) {
    // 确保总部有默认部门（如果还没有）
    await createDefaultOrgDepartments(db, null, undefined)
    return hq
  }
  const id = uuid()
  await db.prepare('insert into headquarters(id,name,active) values(?,?,1)').bind(id, '总部').run()
  // 为总部创建默认部门
  await createDefaultOrgDepartments(db, null, undefined)
  return { id, name: '总部' }
}

export async function ensureDefaultCurrencies(db: D1Database) {
  const defaults = [
    { code: 'CNY', name: '人民币' },
    { code: 'USD', name: '美元' }
  ]
  for (const cur of defaults) {
    await db.prepare('insert into currencies(code,name,active) values(?,?,1) ON CONFLICT(code) DO NOTHING')
      .bind(cur.code, cur.name).run()
  }
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

// 根据role获取默认职位代码
// 已移除 getDefaultPositionCodeByRole 和 createUser 函数
// 用户账号现在完全通过员工管理创建，不需要单独创建用户

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
// 如果用户没有员工记录，返回null（不允许访问系统）
export async function getUserPosition(db: D1Database, userId: string): Promise<{ id: string, code: string, name: string, level: string, scope: string, permissions: any } | null> {
  const user = await getUserById(db, userId)
  if (!user || !user.email) return null
  
  // 必须从员工记录获取职位（员工记录是唯一权威来源）
  const employee = await db.prepare('select position_id from employees where email=? and active=1').bind(user.email).first<{ position_id: string }>()
  if (!employee?.position_id) {
    // 没有员工记录，不允许访问系统
    return null
  }
  
  const position = await db.prepare('select * from positions where id=? and active=1').bind(employee.position_id).first<any>()
  if (!position) {
    return null
  }
  
  return {
    id: position.id,
    code: position.code,
    name: position.name,
    level: position.level,
    scope: position.scope,
    permissions: JSON.parse(position.permissions || '{}')
  }
}

// 获取用户所属的组ID（通过org_department_id查找父部门是开发部的子组）
export async function getUserGroupId(db: D1Database, userId: string): Promise<string | null> {
  const user = await getUserById(db, userId)
  if (!user?.email) return null
  
  // 获取员工的组织部门
  const employee = await db.prepare('select org_department_id from employees where email=? and active=1').bind(user.email).first<{ org_department_id: string }>()
  if (!employee?.org_department_id) return null
  
  // 检查该部门是否是某个组的子部门（parent_id不为NULL）
  const group = await db.prepare('select id from org_departments where id=? and parent_id is not null').bind(employee.org_department_id).first<{ id: string }>()
  return group?.id || null
}

// 获取用户的组织部门ID
export async function getUserOrgDepartmentId(db: D1Database, userId: string): Promise<string | null> {
  const user = await getUserById(db, userId)
  if (!user || !user.email) return null
  
  // 必须从员工记录获取org_department_id（员工记录是唯一权威来源）
  const employee = await db.prepare('select org_department_id from employees where email=? and active=1').bind(user.email).first<{ org_department_id: string }>()
  return employee?.org_department_id || null
}

// 检查用户是否是总部用户（department_id是"总部"项目）
export async function isHQUser(db: D1Database, userId: string): Promise<boolean> {
  const deptIds = await getUserDepartmentIds(db, userId)
  if (deptIds.length === 0) return false
  
  // 检查是否有"总部"项目
  for (const deptId of deptIds) {
    const dept = await db.prepare('select name from departments where id=?').bind(deptId).first<{ name: string }>()
    if (dept?.name === '总部') {
      return true
    }
  }
  return false
}

// 数据权限过滤：获取用户项目ID列表
export async function getUserDepartmentIds(db: D1Database, userId: string): Promise<string[]> {
  try {
    // 首先检查新的多项目关联表
    const userDepts = await db.prepare('select department_id from user_departments where user_id=?').bind(userId).all<{ department_id: string }>()
    if (userDepts.results && userDepts.results.length > 0) {
      return userDepts.results.map(r => r.department_id)
    }
  } catch (err: any) {
    // 如果表不存在，忽略错误，继续向后兼容逻辑
    console.warn('user_departments table may not exist:', err.message)
  }
  
  // 向后兼容：如果没有多项目关联，检查旧的department_id字段
  const user = await getUserById(db, userId)
  if (user?.department_id) {
    return [user.department_id]
  }
  
  return []
}

// 向后兼容：保留getUserDepartmentId函数（返回第一个项目ID）
export async function getUserDepartmentId(db: D1Database, userId: string): Promise<string | null> {
  const deptIds = await getUserDepartmentIds(db, userId)
  return deptIds.length > 0 ? deptIds[0] : null
}

// 创建默认组织部门（人事部、财务部、行政部、开发部）
export async function createDefaultOrgDepartments(db: D1Database, projectId: string | null, userId?: string) {
  const defaultDepartments = [
    { name: '人事部', code: 'HR', sort_order: 1 },
    { name: '财务部', code: 'FIN', sort_order: 2 },
    { name: '行政部', code: 'ADM', sort_order: 3 },
    { name: '开发部', code: 'DEV', sort_order: 4 }
  ]
  
  const now = Date.now()
  const createdIds: string[] = []
  
  for (const dept of defaultDepartments) {
    // 检查是否已存在相同名称的部门
    const existed = await db.prepare(`
      select id from org_departments 
      where COALESCE(project_id, '') = COALESCE(?, '') 
        and COALESCE(parent_id, '') = '' 
        and name=? 
        and active=1
    `).bind(projectId || null, dept.name).first<{ id: string }>()
    
    if (!existed?.id) {
      const id = uuid()
      await db.prepare(`
        insert into org_departments(id, project_id, parent_id, name, code, description, active, sort_order, created_at, updated_at)
        values(?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
      `).bind(
        id,
        projectId || null,
        null,
        dept.name,
        dept.code || null,
        null,
        dept.sort_order,
        now,
        now
      ).run()
      
      createdIds.push(id)
      
      // 如果是开发部，创建子组（前端组、后端组、产品组等）
      if (dept.name === '开发部') {
        const devGroups = [
          { name: '前端组', code: 'FE', sort_order: 1 },
          { name: '后端组', code: 'BE', sort_order: 2 },
          { name: '产品组', code: 'PM', sort_order: 3 },
          { name: '测试组', code: 'QA', sort_order: 4 },
          { name: '运维组', code: 'OPS', sort_order: 5 },
          { name: 'UI组', code: 'UI', sort_order: 6 }
        ]
        
        for (const group of devGroups) {
          const groupId = uuid()
          await db.prepare(`
            insert into org_departments(id, project_id, parent_id, name, code, description, active, sort_order, created_at, updated_at)
            values(?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
          `).bind(
            groupId,
            projectId || null,
            id,
            group.name,
            group.code,
            null,
            group.sort_order,
            now,
            now
          ).run()
        }
      }
      
      // 记录审计日志
      if (userId) {
        await logAudit(db, userId, 'create', 'org_department', id, JSON.stringify({
          project_id: projectId,
          parent_id: null,
          name: dept.name,
          code: dept.code,
          sort_order: dept.sort_order
        }))
      }
    }
  }
  
  return createdIds
}

// 计算账户当前余额（账变前金额）
export async function getAccountBalanceBefore(db: D1Database, accountId: string, transactionDate: string, transactionTime: number): Promise<number> {
  // 期初余额
  const ob = await db.prepare('select coalesce(sum(case when type="account" and ref_id=? then amount_cents else 0 end),0) as ob from opening_balances')
    .bind(accountId).first<{ ob: number }>()
  
  // 计算账变前的所有交易
  // 需要考虑同一天的情况：只计算在此交易时间之前的交易
  const pre = await db.prepare(`
    select coalesce(sum(case when type='income' then amount_cents when type='expense' then -amount_cents else 0 end),0) as s
    from cash_flows 
    where account_id=? 
    and (biz_date < ? or (biz_date = ? and created_at < ?))
  `).bind(accountId, transactionDate, transactionDate, transactionTime).first<{ s: number }>()
  
  return (ob?.ob ?? 0) + (pre?.s ?? 0)
}

