import { v4 as uuid } from 'uuid'
import { logAudit } from '../utils/audit'

// 项目部门配置
const PROJECT_DEPARTMENTS = [
    {
        name: '项目管理部',
        code: 'ADMIN',
        description: '项目管理部',
        allowed_modules: '["*"]',
        allowed_positions: '["pos-project-manager", "pos-project-staff"]',
        default_position_id: 'pos-project-staff',
        sort_order: 10
    },
    {
        name: '项目人事',
        code: 'HR',
        description: '项目人事',
        allowed_modules: '["hr.*", "report.*", "self.*"]',
        allowed_positions: '["pos-project-staff"]',
        default_position_id: 'pos-project-staff',
        sort_order: 20
    },
    {
        name: '项目财务',
        code: 'FINANCE',
        description: '项目财务',
        allowed_modules: '["finance.*", "report.*", "self.*"]',
        allowed_positions: '["pos-project-staff"]',
        default_position_id: 'pos-project-staff',
        sort_order: 30
    },
    {
        name: '项目行政',
        code: 'OPERATION',
        description: '项目行政',
        allowed_modules: '["asset.*", "site.*", "self.*"]',
        allowed_positions: '["pos-project-staff"]',
        default_position_id: 'pos-project-staff',
        sort_order: 40
    },
    {
        name: '客服部',
        code: 'CS',
        description: '客服部',
        allowed_modules: '["finance.ar", "finance.ap", "self.*"]',
        allowed_positions: '["pos-project-staff"]',
        default_position_id: 'pos-project-staff',
        sort_order: 50
    },
    {
        name: '开发部',
        code: 'DEV',
        description: '开发部',
        allowed_modules: '["self.*"]',
        allowed_positions: '[]',
        default_position_id: null,
        sort_order: 60
    }
]

// 开发部子组配置
const DEV_GROUPS = [
    { name: '前端组', code: 'FE', sort_order: 61 },
    { name: '后端组', code: 'BE', sort_order: 62 },
    { name: '测试组', code: 'QA', sort_order: 63 },
    { name: '产品组', code: 'PM', sort_order: 64 },
    { name: '美术组', code: 'ART', sort_order: 65 },
    { name: '运维组', code: 'OPS', sort_order: 66 }
]

export class DepartmentService {
    constructor(private db: D1Database) { }

    // 为新项目创建默认组织部门
    async createDefaultOrgDepartments(projectId: string, userId?: string) {
        const now = Date.now()
        const createdIds: string[] = []

        for (const dept of PROJECT_DEPARTMENTS) {
            // 检查是否已存在相同名称的部门
            const existed = await this.db.prepare(`
                select id from org_departments 
                where project_id = ? and parent_id IS NULL and name = ? and active = 1
            `).bind(projectId, dept.name).first<{ id: string }>()

            if (!existed?.id) {
                const id = uuid()
                await this.db.prepare(`
                    insert into org_departments(id, project_id, parent_id, name, code, description, allowed_modules, allowed_positions, default_position_id, active, sort_order, created_at, updated_at)
                    values(?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
                `).bind(
                    id,
                    projectId,
                    null,
                    dept.name,
                    dept.code,
                    dept.description,
                    dept.allowed_modules,
                    dept.allowed_positions,
                    dept.default_position_id,
                    dept.sort_order,
                    now,
                    now
                ).run()

                createdIds.push(id)

                // 如果是开发部，创建子组
                if (dept.name === '开发部') {
                    for (const group of DEV_GROUPS) {
                        const groupId = uuid()
                        await this.db.prepare(`
                            insert into org_departments(id, project_id, parent_id, name, code, description, allowed_modules, allowed_positions, default_position_id, active, sort_order, created_at, updated_at)
                            values(?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
                        `).bind(
                            groupId,
                            projectId,
                            id,
                            group.name,
                            group.code,
                            group.name,
                            '["self.*"]',
                            '["pos-team-leader", "pos-team-engineer"]',
                            'pos-team-engineer',
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
                        name: dept.name,
                        code: dept.code
                    }))
                }
            }
        }

        return createdIds
    }
}
