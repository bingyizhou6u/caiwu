import { v4 as uuid } from 'uuid'
import { DrizzleD1Database } from 'drizzle-orm/d1'
import { eq, and, isNull } from 'drizzle-orm'
import { orgDepartments, projects } from '../../db/schema.js'
import * as schema from '../../db/schema.js'
import { AuditService } from './AuditService.js'
import { ProjectDepartmentService } from './ProjectDepartmentService.js'

// 项目部门配置
const PROJECT_DEPARTMENTS = [
  {
    name: '项目管理部',
    code: 'ADMIN',
    description: '项目管理部',
    allowed_modules: '["*"]',
    allowed_positions: '["pos-project-manager", "pos-project-staff"]',
    default_position_id: 'pos-project-staff',
    sort_order: 10,
  },
  {
    name: '项目人事',
    code: 'HR',
    description: '项目人事',
    allowed_modules: '["hr.*", "report.*", "self.*"]',
    allowed_positions: '["pos-project-staff"]',
    default_position_id: 'pos-project-staff',
    sort_order: 20,
  },
  {
    name: '项目财务',
    code: 'FINANCE',
    description: '项目财务',
    allowed_modules: '["finance.*", "report.*", "self.*"]',
    allowed_positions: '["pos-project-staff"]',
    default_position_id: 'pos-project-staff',
    sort_order: 30,
  },
  {
    name: '项目行政',
    code: 'OPERATION',
    description: '项目行政',
    allowed_modules: '["asset.*", "site.*", "self.*"]',
    allowed_positions: '["pos-project-staff"]',
    default_position_id: 'pos-project-staff',
    sort_order: 40,
  },
  {
    name: '客服部',
    code: 'CS',
    description: '客服部',
    allowed_modules: '["finance.ar", "finance.ap", "self.*"]',
    allowed_positions: '["pos-project-staff"]',
    default_position_id: 'pos-project-staff',
    sort_order: 50,
  },
  {
    name: '开发部',
    code: 'DEV',
    description: '开发部',
    allowed_modules: '["self.*"]',
    allowed_positions: '[]',
    default_position_id: null,
    sort_order: 60,
  },
]

// 开发部子组配置
const DEV_GROUPS = [
  { name: '前端组', code: 'FE', sort_order: 61 },
  { name: '后端组', code: 'BE', sort_order: 62 },
  { name: '测试组', code: 'QA', sort_order: 63 },
  { name: '产品组', code: 'PM', sort_order: 64 },
  { name: '美术组', code: 'ART', sort_order: 65 },
  { name: '运维组', code: 'OPS', sort_order: 66 },
]

export class DepartmentService {
  private projectDepartmentService: ProjectDepartmentService

  constructor(
    private db: DrizzleD1Database<typeof schema>,
    private auditService: AuditService
  ) {
    this.projectDepartmentService = new ProjectDepartmentService(db)
  }

  // 为新项目创建默认组织部门
  async createDefaultOrgDepartments(projectId: string | null, userId?: string) {
    const now = Date.now()
    const createdIds: string[] = []

    // 如果 projectId 为 null，获取或创建总部的 department ID
    let actualProjectId = projectId
    if (!actualProjectId) {
      actualProjectId = await this.projectDepartmentService.getOrCreateHQProjectId()
    }

    for (const dept of PROJECT_DEPARTMENTS) {
      // 检查是否已存在相同名称的部门
      const existed = await this.db
        .select({ id: orgDepartments.id })
        .from(orgDepartments)
        .where(
          and(
            eq(orgDepartments.projectId, actualProjectId),
            isNull(orgDepartments.parentId),
            eq(orgDepartments.name, dept.name),
            eq(orgDepartments.active, 1)
          )
        )
        .get()

      if (!existed?.id) {
        const id = uuid()
        await this.db
          .insert(orgDepartments)
          .values({
            id,
            projectId: actualProjectId,
            parentId: null,
            name: dept.name,
            code: dept.code,
            description: dept.description,
            allowedModules: dept.allowed_modules,
            allowedPositions: dept.allowed_positions,
            defaultPositionId: dept.default_position_id,
            active: 1,
            sortOrder: dept.sort_order,
            createdAt: now,
            updatedAt: now,
          })
          .execute()

        createdIds.push(id)

        // 如果是开发部，创建子组
        if (dept.name === '开发部') {
          for (const group of DEV_GROUPS) {
            const groupId = uuid()
            await this.db
              .insert(orgDepartments)
              .values({
                id: groupId,
                projectId,
                parentId: id,
                name: group.name,
                code: group.code,
                description: group.name,
                allowedModules: '["self.*"]',
                allowedPositions: '["pos-team-leader", "pos-team-engineer"]',
                defaultPositionId: 'pos-team-engineer',
                active: 1,
                sortOrder: group.sort_order,
                createdAt: now,
                updatedAt: now,
              })
              .execute()
          }
        }

        // 记录审计日志
        if (userId) {
          await this.auditService.log(
            userId,
            'create',
            'org_department',
            id,
            JSON.stringify({
              project_id: actualProjectId,
              name: dept.name,
              code: dept.code,
            })
          )
        }
      }
    }

    return createdIds
  }
}
