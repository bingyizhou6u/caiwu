import { Errors } from '../utils/errors.js'

export class UserService {
    constructor(private db: D1Database) { }

    async getUserById(id: string) {
        return this.db.prepare('select * from users where id=?').bind(id).first<any>()
    }

    async getUserByEmail(email: string) {
        return this.db.prepare('select * from users where email=?').bind(email).first<any>()
    }

    async getUserEmployeeId(userId: string): Promise<string | null> {
        const user = await this.getUserById(userId)
        if (!user?.email) return null

        const employee = await this.db.prepare('select id from employees where email=? and active=1').bind(user.email).first<{ id: string }>()
        return employee?.id || null
    }

    async getUserPosition(userId: string) {
        const result = await this.db.prepare(`
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


    async isHQUser(userId: string): Promise<boolean> {
        // Optimized query using EXISTS
        const result = await this.db.prepare(`
      select 1 as is_hq
      from user_departments ud
      join departments d on ud.department_id = d.id
      where ud.user_id = ? and d.name = '总部'
    `).first<{ is_hq: number }>()

        if (result?.is_hq) return true

        // Fallback for backward compatibility (department_id on user)
        const user = await this.getUserById(userId)
        if (user?.department_id) {
            const dept = await this.db.prepare('select name from departments where id=?').bind(user.department_id).first<{ name: string }>()
            return dept?.name === '总部'
        }

        return false
    }

    async getUserGroupId(userId: string): Promise<string | null> {
        const user = await this.getUserById(userId)
        if (!user?.email) return null

        // 获取员工的组织部门
        const employee = await this.db.prepare('select org_department_id from employees where email=? and active=1').bind(user.email).first<{ org_department_id: string }>()
        if (!employee?.org_department_id) return null

        // 检查该部门是否是某个组的子部门（parent_id不为NULL）
        const group = await this.db.prepare('select id from org_departments where id=? and parent_id is not null').bind(employee.org_department_id).first<{ id: string }>()
        return group?.id || null
    }

    async getUserOrgDepartmentId(userId: string): Promise<string | null> {
        const user = await this.getUserById(userId)
        if (!user || !user.email) return null

        // 必须从员工记录获取org_department_id（员工记录是唯一权威来源）
        const employee = await this.db.prepare('select org_department_id from employees where email=? and active=1').bind(user.email).first<{ org_department_id: string }>()
        return employee?.org_department_id || null
    }

    async getUserDepartmentIds(userId: string): Promise<string[]> {
        try {
            // 首先检查新的多项目关联表
            const userDepts = await this.db.prepare('select department_id from user_departments where user_id=?').bind(userId).all<{ department_id: string }>()
            if (userDepts.results && userDepts.results.length > 0) {
                return userDepts.results.map(r => r.department_id)
            }
        } catch (err: any) {
            // 如果表不存在，忽略错误，继续向后兼容逻辑
            console.warn('user_departments table may not exist:', err.message)
        }

        // 向后兼容：如果没有多项目关联，检查旧的department_id字段
        const user = await this.getUserById(userId)
        if (user?.department_id) {
            return [user.department_id]
        }

        return []
    }

    async getUserDepartmentId(userId: string): Promise<string | null> {
        const ids = await this.getUserDepartmentIds(userId)
        return ids.length > 0 ? ids[0] : null
    }
}
