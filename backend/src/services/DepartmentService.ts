import { v4 as uuid } from 'uuid'
import { logAudit } from '../utils/audit'

export class DepartmentService {
    constructor(private db: D1Database) { }

    // 创建默认组织部门（人事部、财务部、行政部、开发部）
    async createDefaultOrgDepartments(projectId: string | null, userId?: string) {
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
            const existed = await this.db.prepare(`
        select id from org_departments 
        where COALESCE(project_id, '') = COALESCE(?, '') 
          and COALESCE(parent_id, '') = '' 
          and name=? 
          and active=1
      `).bind(projectId || null, dept.name).first<{ id: string }>()

            if (!existed?.id) {
                const id = uuid()
                await this.db.prepare(`
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
                        await this.db.prepare(`
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
                    await logAudit(this.db, userId, 'create', 'org_department', id, JSON.stringify({
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
}
