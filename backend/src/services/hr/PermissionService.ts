import { DrizzleD1Database } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import * as schema from '../../db/schema.js'
import { employees, positions } from '../../db/schema.js'

export class PermissionService {
  constructor(private db: DrizzleD1Database<typeof schema>) { }

  /**
   * 检查是否可以查看指定员工的数据
   */
  async canViewEmployee(
    actor: { id: string; departmentId: string | null; orgDepartmentId: string | null },
    actorPosition: { code: string; dataScope?: string },
    targetEmployeeId: string
  ): Promise<boolean> {
    const dataScope = actorPosition.dataScope || 'self'

    // 1. DataScope.ALL
    if (dataScope === 'all') {
      return true
    }

    // 2. DataScope.SELF
    if (dataScope === 'self') {
      return targetEmployeeId === actor.id
    }

    // 获取目标员工信息
    const target = await this.db
      .select({
        id: employees.id,
        departmentId: employees.departmentId,
        orgDepartmentId: employees.orgDepartmentId,
      })
      .from(employees)
      .where(eq(employees.id, targetEmployeeId))
      .get()

    if (!target) { return false }

    // 3. DataScope.PROJECT
    if (dataScope === 'project') {
      return target.departmentId === actor.departmentId
    }

    // 4. DataScope.GROUP
    if (dataScope === 'group') {
      return target.orgDepartmentId === actor.orgDepartmentId
    }

    return false
  }

  /**
   * 检查是否可以审批指定员工的申请（请假/报销）
   */
  async canApproveApplication(
    actor: { id: string; departmentId: string | null; orgDepartmentId: string | null },
    actorPosition: { code: string; canManageSubordinates: number; dataScope?: string },
    applicantEmployeeId: string
  ): Promise<boolean> {
    // 必须有管理下属权限
    if (actorPosition.canManageSubordinates !== 1) { return false }

    const dataScope = actorPosition.dataScope || 'self'

    // 1. DataScope.ALL (总部管理)
    if (dataScope === 'all') {
      return true
    }

    // 获取申请人信息
    const applicant = await this.db
      .select({
        id: employees.id,
        departmentId: employees.departmentId,
        orgDepartmentId: employees.orgDepartmentId,
        positionId: employees.positionId,
      })
      .from(employees)
      .where(eq(employees.id, applicantEmployeeId))
      .get()

    if (!applicant) { return false }

    // 2. DataScope.PROJECT
    if (dataScope === 'project') {
      return applicant.departmentId === actor.departmentId
    }

    // 3. DataScope.GROUP
    if (dataScope === 'group') {
      return applicant.orgDepartmentId === actor.orgDepartmentId
    }

    return false
  }

  /**
   * 检查是否可以审批 (Convenience method using IDs)
   */
  async canApprove(actorId: string, applicantId: string): Promise<boolean> {
    const actor = await this.db
      .select({
        id: employees.id,
        departmentId: employees.departmentId,
        orgDepartmentId: employees.orgDepartmentId,
        positionId: employees.positionId,
      })
      .from(employees)
      .where(eq(employees.id, actorId))
      .get()

    if (!actor) { return false }

    if (!actor.positionId) { return false }

    const position = await this.db
      .select()
      .from(positions)
      .where(eq(positions.id, actor.positionId))
      .get()

    if (!position) { return false }

    return this.canApproveApplication(
      actor,
      {
        ...position,
        canManageSubordinates: position.canManageSubordinates ?? 0,
      },
      applicantId
    )
  }
}
