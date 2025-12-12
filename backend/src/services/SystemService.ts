import { v4 as uuid } from 'uuid'
import { DepartmentService } from './DepartmentService'
import { AuditService } from './AuditService'
import { DrizzleD1Database } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { headquarters, currencies } from '../db/schema.js'
import * as schema from '../db/schema.js'

export class SystemService {
    constructor(private db: DrizzleD1Database<typeof schema>) { }

    async getOrCreateDefaultHQ() {
        const hq = await this.db.select({ id: headquarters.id, name: headquarters.name })
            .from(headquarters)
            .where(eq(headquarters.active, 1))
            .limit(1)
            .get()

        if (hq?.id) {
            // 确保总部有默认部门（如果还没有）
            const auditService = new AuditService(this.db)
            const deptService = new DepartmentService(this.db, auditService)
            await deptService.createDefaultOrgDepartments(null, undefined)
            return hq
        }

        const id = uuid()
        await this.db.insert(headquarters).values({
            id,
            name: '总部',
            active: 1
        }).execute()

        // 为总部创建默认部门
        const auditService = new AuditService(this.db)
        const deptService = new DepartmentService(this.db, auditService)
        await deptService.createDefaultOrgDepartments(null, undefined)
        return { id, name: '总部' }
    }

    async ensureDefaultCurrencies() {
        const defaults = [
            { code: 'CNY', name: '人民币' },
            { code: 'USD', name: '美元' }
        ]

        for (const cur of defaults) {
            // Drizzle 可能不支持 ON CONFLICT，使用 try-catch 或先检查
            const existing = await this.db.select({ code: currencies.code })
                .from(currencies)
                .where(eq(currencies.code, cur.code))
                .get()

            if (!existing) {
                await this.db.insert(currencies).values({
                    code: cur.code,
                    name: cur.name,
                    active: 1
                }).execute()
            }
        }
    }
}
