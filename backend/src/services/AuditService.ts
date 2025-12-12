import { DrizzleD1Database } from 'drizzle-orm/d1'
import { eq, and, desc, sql, like, or, gte, lte } from 'drizzle-orm'
import * as schema from '../db/schema.js'
import { auditLogs, employees } from '../db/schema.js'
import { Errors } from '../utils/errors.js'
import { v4 as uuid } from 'uuid'

// 标准化审计操作类型
export const AUDIT_ACTIONS = {
    // 认证相关
    LOGIN: 'login',
    LOGOUT: 'logout',
    PASSWORD_CHANGE: 'password_change',
    PASSWORD_RESET: 'password_reset',
    TOTP_BIND: 'totp_bind',
    TOTP_RESET: 'totp_reset',

    // CRUD 操作
    CREATE: 'create',
    UPDATE: 'update',
    DELETE: 'delete',

    // 状态变更
    STATUS_CHANGE: 'status_change',
    APPROVE: 'approve',
    REJECT: 'reject',

    // 财务操作
    TRANSFER: 'transfer',
    PAYMENT: 'payment',
    SETTLEMENT: 'settlement',

    // 员工操作
    REGULARIZE: 'regularize',
    LEAVE: 'leave',
    REJOIN: 'rejoin',
} as const

// 标准化实体类型
export const AUDIT_ENTITIES = {
    USER: 'user',
    EMPLOYEE: 'employee',
    DEPARTMENT: 'department',
    ORG_DEPARTMENT: 'org_department',
    POSITION: 'position',
    ACCOUNT: 'account',
    CASH_FLOW: 'cash_flow',
    AR_AP: 'ar_ap',
    SALARY: 'salary',
    SALARY_PAYMENT: 'salary_payment',
    ALLOWANCE: 'allowance',
    BORROWING: 'borrowing',
    REPAYMENT: 'repayment',
    EXPENSE: 'expense',
    FIXED_ASSET: 'fixed_asset',
    RENTAL: 'rental',
    LEAVE: 'leave',
    APPROVAL: 'approval',
} as const

export class AuditService {
    constructor(private db: DrizzleD1Database<typeof schema>) { }

    async log(
        actorId: string,
        action: string,
        entity: string,
        entityId?: string,
        detail?: string,
        ip?: string | null,
        ipLocation?: string | null
    ) {
        const id = uuid()
        await this.db.insert(auditLogs).values({
            id,
            actorId,
            action,
            entity,
            entityId: entityId ?? null,
            at: Date.now(),
            detail: detail ?? null,
            ip: ip ?? null,
            ipLocation: ipLocation ?? null
        }).execute()
    }

    // 便捷方法：记录创建操作
    async logCreate(actorId: string, entity: string, entityId: string, data?: object, ip?: string | null) {
        await this.log(actorId, AUDIT_ACTIONS.CREATE, entity, entityId, data ? JSON.stringify(data) : undefined, ip)
    }

    // 便捷方法：记录更新操作
    async logUpdate(actorId: string, entity: string, entityId: string, changes?: object, ip?: string | null) {
        await this.log(actorId, AUDIT_ACTIONS.UPDATE, entity, entityId, changes ? JSON.stringify(changes) : undefined, ip)
    }

    // 便捷方法：记录删除操作
    async logDelete(actorId: string, entity: string, entityId: string, reason?: string, ip?: string | null) {
        await this.log(actorId, AUDIT_ACTIONS.DELETE, entity, entityId, reason, ip)
    }

    // 便捷方法：记录审批操作
    async logApproval(actorId: string, entity: string, entityId: string, approved: boolean, comment?: string, ip?: string | null) {
        const action = approved ? AUDIT_ACTIONS.APPROVE : AUDIT_ACTIONS.REJECT
        await this.log(actorId, action, entity, entityId, comment, ip)
    }

    // 便捷方法：记录状态变更
    async logStatusChange(actorId: string, entity: string, entityId: string, fromStatus: string, toStatus: string, ip?: string | null) {
        await this.log(actorId, AUDIT_ACTIONS.STATUS_CHANGE, entity, entityId, JSON.stringify({ from: fromStatus, to: toStatus }), ip)
    }

    async getAuditLogs(query: {
        action?: string
        entity?: string
        actor_id?: string
        actor_keyword?: string
        start_time?: number
        end_time?: number
        limit?: number
        offset?: number
    }) {
        const conditions = []

        if (query.action) {
            conditions.push(eq(auditLogs.action, query.action))
        }
        if (query.entity) {
            conditions.push(eq(auditLogs.entity, query.entity))
        }
        if (query.actor_id) {
            conditions.push(eq(auditLogs.actorId, query.actor_id))
        }
        if (query.actor_keyword) {
            conditions.push(or(
                like(employees.name, `%${query.actor_keyword}%`),
                like(employees.personalEmail, `%${query.actor_keyword}%`)
            ))
        }
        if (query.start_time) {
            conditions.push(gte(auditLogs.at, query.start_time))
        }
        if (query.end_time) {
            conditions.push(lte(auditLogs.at, query.end_time))
        }

        const baseQuery = this.db.select({
            id: auditLogs.id,
            actorId: auditLogs.actorId,
            action: auditLogs.action,
            entity: auditLogs.entity,
            entityId: auditLogs.entityId,
            at: auditLogs.at,
            detail: auditLogs.detail,
            ip: auditLogs.ip,
            ipLocation: auditLogs.ipLocation,
            actorName: employees.name,
            actorEmail: employees.personalEmail
        })
            .from(auditLogs)
            .leftJoin(employees, eq(employees.id, auditLogs.actorId))
            .where(and(...conditions))
            .orderBy(desc(auditLogs.at))

        const limit = query.limit ?? 100
        const offset = query.offset ?? 0

        const results = await baseQuery.limit(limit).offset(offset).all()

        // 统计总数
        const totalResult = await this.db.select({ count: sql<number>`count(*)` })
            .from(auditLogs)
            .leftJoin(employees, eq(employees.id, auditLogs.actorId))
            .where(and(...conditions))
            .get()

        return {
            results,
            total: totalResult?.count ?? 0
        }
    }

    async getAuditLogOptions() {
        const actions = await this.db.selectDistinct({ action: auditLogs.action })
            .from(auditLogs)
            .where(sql`${auditLogs.action} IS NOT NULL`)
            .orderBy(auditLogs.action)
            .all()

        const entities = await this.db.selectDistinct({ entity: auditLogs.entity })
            .from(auditLogs)
            .where(sql`${auditLogs.entity} IS NOT NULL`)
            .orderBy(auditLogs.entity)
            .all()

        const actors = await this.db.selectDistinct({
            id: employees.id,
            name: employees.name,
            email: employees.personalEmail
        })
            .from(auditLogs)
            .innerJoin(employees, eq(employees.id, auditLogs.actorId))
            .orderBy(employees.name, employees.personalEmail)
            .all()

        return {
            actions: actions.map(r => r.action).filter((a): a is string => a !== null),
            entities: entities.map(r => r.entity).filter((e): e is string => e !== null),
            actors
        }
    }
}
