import { env } from 'cloudflare:test'
import { describe, it, expect, beforeEach } from 'vitest'
import { DepartmentService } from '../../src/services/DepartmentService'
// @ts-ignore
import schema from '../../src/db/schema.sql?raw'

describe('DepartmentService', () => {
    let db: D1Database

    beforeEach(async () => {
        db = env.DB
        // Apply schema
        const statements = schema
            .split(';')
            .map((s: string) => s.trim())
            .filter((s: string) => s.length > 0)

        for (const statement of statements) {
            await db.prepare(statement).run()
        }
    })

    it('should create default org departments', async () => {
        const service = new DepartmentService(db)
        const projectId = 'test-project-id'

        const createdIds = await service.createDefaultOrgDepartments(projectId)

        expect(createdIds.length).toBeGreaterThan(0)

        // Verify departments
        const departments = await db.prepare('select * from org_departments where project_id = ?').bind(projectId).all<any>()
        const deptNames = departments.results.map((d: any) => d.name)

        expect(deptNames).toContain('人事部')
        expect(deptNames).toContain('财务部')
        expect(deptNames).toContain('行政部')
        expect(deptNames).toContain('开发部')

        // Verify sub-departments for Dev
        const devDept = departments.results.find((d: any) => d.name === '开发部')
        expect(devDept).toBeDefined()

        const subDepts = await db.prepare('select * from org_departments where parent_id = ?').bind(devDept.id).all<any>()
        const subDeptNames = subDepts.results.map((d: any) => d.name)

        expect(subDeptNames).toContain('前端组')
        expect(subDeptNames).toContain('后端组')
    })

    it('should not duplicate departments if they already exist', async () => {
        const service = new DepartmentService(db)
        const projectId = 'test-project-id'

        await service.createDefaultOrgDepartments(projectId)
        const firstCount = (await db.prepare('select count(*) as count from org_departments where project_id = ?').bind(projectId).first<{ count: number }>())?.count

        await service.createDefaultOrgDepartments(projectId)
        const secondCount = (await db.prepare('select count(*) as count from org_departments where project_id = ?').bind(projectId).first<{ count: number }>())?.count

        expect(secondCount).toBe(firstCount)
    })
})
