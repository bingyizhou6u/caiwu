import { DrizzleD1Database } from 'drizzle-orm/d1'
import { eq, and, desc, sql, like, or, gte, lte } from 'drizzle-orm'
import * as schema from '../db/schema.js'
import { auditLogs, users, employees } from '../db/schema.js'
import { Errors } from '../utils/errors.js'

export class AuditService {
    constructor(private db: DrizzleD1Database<typeof schema>) { }

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
                like(users.email, `%${query.actor_keyword}%`)
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
            actorEmail: users.email
        })
            .from(auditLogs)
            .leftJoin(users, eq(users.id, auditLogs.actorId))
            .leftJoin(employees, eq(employees.email, users.email))
            .where(and(...conditions))
            .orderBy(desc(auditLogs.at))

        const limit = query.limit ?? 100
        const offset = query.offset ?? 0

        const results = await baseQuery.limit(limit).offset(offset).all()

        // Count total
        const totalResult = await this.db.select({ count: sql<number>`count(*)` })
            .from(auditLogs)
            .leftJoin(users, eq(users.id, auditLogs.actorId))
            .leftJoin(employees, eq(employees.email, users.email))
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
            id: users.id,
            name: employees.name,
            email: users.email
        })
            .from(auditLogs)
            .innerJoin(users, eq(users.id, auditLogs.actorId))
            .leftJoin(employees, eq(employees.email, users.email))
            .orderBy(employees.name, users.email)
            .all()

        return {
            actions: actions.map(r => r.action),
            entities: entities.map(r => r.entity),
            actors
        }
    }
}
