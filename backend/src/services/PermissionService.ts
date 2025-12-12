import { DrizzleD1Database } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import * as schema from '../db/schema.js'
import { employees, positions } from '../db/schema.js'

export class PermissionService {
    constructor(private db: DrizzleD1Database<typeof schema>) { }

    /**
     * 检查是否可以查看指定员工的数据
     */
    async canViewEmployee(
        actor: { id: string, departmentId: string | null, orgDepartmentId: string | null },
        actorPosition: { level: number, code: string },
        targetEmployeeId: string
    ): Promise<boolean> {
        // 总部人员可以查看所有人
        if (actorPosition.level === 1) {
            return true
        }

        // 工程师只能查看自己
        if (actorPosition.code === 'team_engineer') {
            return targetEmployeeId === actor.id
        }

        // 获取目标员工信息
        const target = await this.db.select({
            id: employees.id,
            departmentId: employees.departmentId,
            orgDepartmentId: employees.orgDepartmentId
        })
            .from(employees)
            .where(eq(employees.id, targetEmployeeId))
            .get()

        if (!target) return false

        // 项目级别：可以查看本项目所有人
        if (actorPosition.level === 2) {
            // 比较 departmentId
            return target.departmentId === actor.departmentId
        }

        // 组长可以查看本组所有人
        if (actorPosition.code === 'team_leader') {
            // 比较 orgDepartmentId
            return target.orgDepartmentId === actor.orgDepartmentId
        }

        return false
    }

    /**
     * 检查是否可以审批指定员工的申请（请假/报销）
     */
    async canApproveApplication(
        actor: { id: string, departmentId: string | null, orgDepartmentId: string | null },
        actorPosition: { level: number, code: string, canManageSubordinates: number },
        applicantEmployeeId: string
    ): Promise<boolean> {
        // 必须有管理下属权限
        if (actorPosition.canManageSubordinates !== 1) return false

        // 总部主管可以审批所有人
        if (actorPosition.code === 'hq_manager') {
            return true
        }

        // 获取申请人信息
        const applicant = await this.db.select({
            id: employees.id,
            departmentId: employees.departmentId,
            orgDepartmentId: employees.orgDepartmentId,
            positionId: employees.positionId
        })
            .from(employees)
            .where(eq(employees.id, applicantEmployeeId))
            .get()

        if (!applicant) return false

        // 项目主管可以审批本项目所有人
        if (actorPosition.code === 'project_manager') {
            return applicant.departmentId === actor.departmentId
        }

        // 组长只能审批本组工程师
        if (actorPosition.code === 'team_leader') {
            // 必须是同一个组
            if (applicant.orgDepartmentId !== actor.orgDepartmentId) return false

            // 必须是工程师
            if (!applicant.positionId) return false

            const applicantPosition = await this.db.select({ code: positions.code })
                .from(positions)
                .where(eq(positions.id, applicant.positionId))
                .get()

            return applicantPosition ? applicantPosition.code === 'team_engineer' : false
        }

        return false
    }

    /**
     * 检查是否可以审批 (Convenience method using IDs)
     */
    async canApprove(actorId: string, applicantId: string): Promise<boolean> {
        const actor = await this.db.select({
            id: employees.id,
            departmentId: employees.departmentId,
            orgDepartmentId: employees.orgDepartmentId,
            positionId: employees.positionId
        })
            .from(employees)
            .where(eq(employees.id, actorId))
            .get()

        if (!actor) return false

        if (!actor.positionId) return false

        const position = await this.db.select()
            .from(positions)
            .where(eq(positions.id, actor.positionId))
            .get()

        if (!position) return false

        return this.canApproveApplication(actor, {
            ...position,
            canManageSubordinates: position.canManageSubordinates ?? 0
        }, applicantId)
    }
}
