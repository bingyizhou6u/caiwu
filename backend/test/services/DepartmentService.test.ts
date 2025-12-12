import { env } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import { DepartmentService } from '../../src/services/DepartmentService';
import { AuditService } from '../../src/services/AuditService';
import schemaSql from '../../src/db/schema.sql?raw';
import * as schema from '../../src/db/schema';
import { createDb } from '../../src/utils/db';
import { eq } from 'drizzle-orm';

describe('DepartmentService', () => {
    beforeAll(async () => {
        // Split schema into statements and execute them one by one
        const statements = schemaSql.split(';').filter((s: string) => s.trim().length > 0);
        for (const statement of statements) {
            await env.DB.prepare(statement).run();
        }
    });

    it('should create default org departments', async () => {
        const db = createDb(env.DB);
        const auditService = new AuditService(db);
        const service = new DepartmentService(db, auditService);
        const projectId = 'test-project-id'

        const createdIds = await service.createDefaultOrgDepartments(projectId)

        expect(createdIds.length).toBeGreaterThan(0)

        // Verify departments using Drizzle
        const departments = await db.select().from(schema.orgDepartments).where(eq(schema.orgDepartments.projectId, projectId)).all()
        const deptNames = departments.map(d => d.name)

        expect(deptNames).toContain('项目人事')
        expect(deptNames).toContain('项目财务')
        expect(deptNames).toContain('项目行政')
        expect(deptNames).toContain('开发部')

        // Verify sub-departments for Dev
        const devDept = departments.find(d => d.name === '开发部')
        expect(devDept).toBeDefined()

        if (!devDept) return; // TS guard

        const subDepts = await db.select().from(schema.orgDepartments).where(eq(schema.orgDepartments.parentId, devDept.id)).all()
        const subDeptNames = subDepts.map(d => d.name)

        expect(subDeptNames).toContain('前端组')
        expect(subDeptNames).toContain('后端组')
    })

    it('should not duplicate departments if they already exist', async () => {
        const db = createDb(env.DB);
        const auditService = new AuditService(db);
        const service = new DepartmentService(db, auditService);
        const projectId = 'test-project-id'

        await service.createDefaultOrgDepartments(projectId)
        const firstCount = await db.$count(schema.orgDepartments, eq(schema.orgDepartments.projectId, projectId))

        await service.createDefaultOrgDepartments(projectId)
        const secondCount = await db.$count(schema.orgDepartments, eq(schema.orgDepartments.projectId, projectId))

        expect(secondCount).toBe(firstCount)
    })
})
