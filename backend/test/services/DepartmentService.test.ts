import { env } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import { DepartmentService } from '../../src/services/DepartmentService';
import schema from '../../src/db/schema.sql?raw';
import { createDb } from '../../src/utils/db';

describe('DepartmentService', () => {
    beforeAll(async () => {
        // Split schema into statements and execute them one by one
        const statements = schema.split(';').filter((s: string) => s.trim().length > 0);
        for (const statement of statements) {
            await env.DB.prepare(statement).run();
        }
    });

    it('should create default org departments', async () => {
        const db = createDb(env.DB);
        const service = new DepartmentService(db);
        const projectId = 'test-project-id'

        const createdIds = await service.createDefaultOrgDepartments(projectId)

        expect(createdIds.length).toBeGreaterThan(0)

        // Verify departments using raw D1Database
        const departments = await env.DB.prepare('select * from org_departments where project_id = ?').bind(projectId).all<any>()
        const deptNames = departments.results.map((d: any) => d.name)

        expect(deptNames).toContain('项目人事')
        expect(deptNames).toContain('项目财务')
        expect(deptNames).toContain('项目行政')
        expect(deptNames).toContain('开发部')

        // Verify sub-departments for Dev
        const devDept = departments.results.find((d: any) => d.name === '开发部')
        expect(devDept).toBeDefined()

        const subDepts = await env.DB.prepare('select * from org_departments where parent_id = ?').bind(devDept.id).all<any>()
        const subDeptNames = subDepts.results.map((d: any) => d.name)

        expect(subDeptNames).toContain('前端组')
        expect(subDeptNames).toContain('后端组')
    })

    it('should not duplicate departments if they already exist', async () => {
        const db = createDb(env.DB);
        const service = new DepartmentService(db);
        const projectId = 'test-project-id'

        await service.createDefaultOrgDepartments(projectId)
        const firstCount = (await env.DB.prepare('select count(*) as count from org_departments where project_id = ?').bind(projectId).first<{ count: number }>())?.count

        await service.createDefaultOrgDepartments(projectId)
        const secondCount = (await env.DB.prepare('select count(*) as count from org_departments where project_id = ?').bind(projectId).first<{ count: number }>())?.count

        expect(secondCount).toBe(firstCount)
    })
})
