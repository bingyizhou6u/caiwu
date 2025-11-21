import { env } from 'cloudflare:test';
import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { UserService } from '../../src/services/UserService';
import { uuid } from '../../src/utils/db';
// @ts-ignore
import schema from '../../src/db/schema.sql?raw';

describe('UserService', () => {
    let userService: UserService;

    beforeAll(async () => {
        // Split schema into statements and execute them one by one
        const statements = schema.split(';').filter((s: string) => s.trim().length > 0);
        for (const statement of statements) {
            await env.DB.prepare(statement).run();
        }
    });

    beforeEach(() => {
        userService = new UserService(env.DB);
    });

    it('should get user by id', async () => {
        const id = uuid();
        const email = 'test@example.com';
        await env.DB.prepare('INSERT INTO users (id, email, name, active) VALUES (?, ?, ?, 1)').bind(id, email, 'Test User').run();

        const user = await userService.getUserById(id);
        expect(user).toBeDefined();
        expect(user?.email).toBe(email);
    });

    it('should return null for non-existent user', async () => {
        const user = await userService.getUserById('non-existent-id');
        expect(user).toBeNull();
    });

    it('should get user department id', async () => {
        const userId = uuid();
        const deptId = uuid();
        const email = 'dept@example.com';

        // Setup: Create user and employee record linked to department
        await env.DB.prepare('INSERT INTO users (id, email, name, active) VALUES (?, ?, ?, 1)').bind(userId, email, 'Dept User').run();
        await env.DB.prepare('INSERT INTO employees (id, email, department_id, name, active) VALUES (?, ?, ?, ?, 1)').bind(uuid(), email, deptId, 'Dept Employee').run();
        // Also insert into user_departments as UserService checks this
        await env.DB.prepare('INSERT INTO user_departments (user_id, department_id) VALUES (?, ?)').bind(userId, deptId).run();

        const resultDeptId = await userService.getUserDepartmentId(userId);
        expect(resultDeptId).toBe(deptId);
    });
});
