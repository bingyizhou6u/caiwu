/**
 * 职位管理服务
 */

import { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from '../db/schema.js'
import { positions, orgDepartments, departments } from '../db/schema.js'
import { eq, and, or } from 'drizzle-orm'
import { Errors } from '../utils/errors.js'

export class PositionService {
  constructor(private db: DrizzleD1Database<typeof schema>) {}

  async getPositions() {
    return this.db
      .select()
      .from(positions)
      .where(eq(positions.active, 1))
      .orderBy(positions.sortOrder, positions.name)
      .all()
  }

  async getAvailablePositions(orgDepartmentId: string) {
    // 1. 获取组织部门信息
    const dept = await this.db
      .select({
        id: orgDepartments.id,
        projectId: orgDepartments.projectId,
        name: orgDepartments.name,
        code: orgDepartments.code,
        allowedPositions: orgDepartments.allowedPositions,
        projectName: departments.name,
      })
      .from(orgDepartments)
      .leftJoin(departments, eq(departments.id, orgDepartments.projectId))
      .where(
        and(eq(orgDepartments.id, orgDepartmentId), eq(orgDepartments.active, 1))
      )
      .get()

    if (!dept) {throw Errors.NOT_FOUND('部门')}

    const isHQ = dept.projectId === null
    const projectIdValue = isHQ ? 'hq' : dept.projectId
    const projectName = isHQ ? '总部' : dept.projectName

    // 2. 按级别筛选职位
    let levelCondition
    if (isHQ) {
      levelCondition = eq(positions.level, 1)
    } else {
      levelCondition = or(eq(positions.level, 2), eq(positions.level, 3))
    }

    let positionsList = await this.db
      .select()
      .from(positions)
      .where(and(eq(positions.active, 1), levelCondition))
      .orderBy(positions.level, positions.sortOrder, positions.name)
      .all()

    // 3. 如果配置了 allowed_positions，则按其筛选
    if (dept.allowedPositions) {
      try {
        const allowedIds = JSON.parse(dept.allowedPositions) as string[]
        if (Array.isArray(allowedIds) && allowedIds.length > 0) {
          positionsList = positionsList.filter(p => allowedIds.includes(p.id))
        }
      } catch {
        // 忽略解析错误
      }
    }

    // 4. 按级别分组
    const LEVEL_LABELS: Record<number, string> = {
      1: '总部职位',
      2: '项目职位',
      3: '组级职位',
    }
    const groupedPositions: Record<string, typeof positionsList> = {}
    for (const pos of positionsList) {
      const groupKey = LEVEL_LABELS[pos.level] || `其他(level=${pos.level})`
      if (!groupedPositions[groupKey]) {
        groupedPositions[groupKey] = []
      }
      groupedPositions[groupKey].push(pos)
    }

    return {
      results: positionsList,
      grouped: groupedPositions,
      department_info: {
        project_id: projectIdValue,
        project_name: projectName,
        department_id: orgDepartmentId,
        department_name: dept.name,
        is_hq: isHQ,
      },
    }
  }
}
