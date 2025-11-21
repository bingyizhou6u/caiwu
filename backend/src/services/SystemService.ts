import { v4 as uuid } from 'uuid'
import { DepartmentService } from './DepartmentService'

export class SystemService {
    constructor(private db: D1Database) { }

    async getOrCreateDefaultHQ() {
        const hq = await this.db.prepare('select id,name from headquarters where active=1 limit 1').first<{ id: string, name: string }>()
        if (hq?.id) {
            // 确保总部有默认部门（如果还没有）
            const deptService = new DepartmentService(this.db)
            await deptService.createDefaultOrgDepartments(null, undefined)
            return hq
        }
        const id = uuid()
        await this.db.prepare('insert into headquarters(id,name,active) values(?,?,1)').bind(id, '总部').run()
        // 为总部创建默认部门
        const deptService = new DepartmentService(this.db)
        await deptService.createDefaultOrgDepartments(null, undefined)
        return { id, name: '总部' }
    }

    async ensureDefaultCurrencies() {
        const defaults = [
            { code: 'CNY', name: '人民币' },
            { code: 'USD', name: '美元' }
        ]
        for (const cur of defaults) {
            await this.db.prepare('insert into currencies(code,name,active) values(?,?,1) ON CONFLICT(code) DO NOTHING')
                .bind(cur.code, cur.name).run()
        }
    }
}
