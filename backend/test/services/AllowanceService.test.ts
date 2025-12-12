
import { env } from 'cloudflare:test';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { AllowanceService } from '../../src/services/AllowanceService';
import schemaSql from '../../src/db/schema.sql?raw';
import * as schema from '../../src/db/schema';
import { createDb } from '../../src/utils/db';
import { v4 as uuid } from 'uuid';

describe('AllowanceService', () => {
    let service: AllowanceService;
    let db: any;

    beforeAll(async () => {
        const statements = schemaSql.split(';').filter((s: string) => s.trim().length > 0);
        for (const statement of statements) {
            await env.DB.prepare(statement).run();
        }
        db = createDb(env.DB);
        service = new AllowanceService(db);
    });

    beforeEach(async () => {
        await db.delete(schema.employeeAllowances).execute();
        await db.delete(schema.employees).execute();
        await db.delete(schema.currencies).execute();
    });

    it('should create and get allowance', async () => {
        const empId = uuid();
        await db.insert(schema.employees).values({ id: empId, name: 'Emp 1', active: 1, email: 'e1@test.com' }).execute();
        await db.insert(schema.currencies).values({ code: 'USD', name: 'US Dollar', active: 1 }).execute();

        const created = await service.create({
            employeeId: empId,
            allowanceType: 'housing',
            currencyId: 'USD',
            amountCents: 50000
        });

        expect(created).toBeDefined();
        expect(created?.allowance.amountCents).toBe(50000);
        expect(created?.currencyName).toBe('US Dollar');
        expect(created?.employeeName).toBe('Emp 1');

        const fetched = await service.get(created!.allowance.id);
        expect(fetched).toBeDefined();
        expect(fetched?.allowance.id).toBe(created!.allowance.id);
    });

    it('should list allowances', async () => {
        const empId = uuid();
        await db.insert(schema.employees).values({ id: empId, name: 'Emp 1', active: 1, email: 'e1@test.com' }).execute();
        await db.insert(schema.currencies).values({ code: 'USD', name: 'US Dollar', active: 1 }).execute();
        await db.insert(schema.currencies).values({ code: 'CNY', name: 'Yuan', active: 1 }).execute();

        await service.create({ employeeId: empId, allowanceType: 'housing', currencyId: 'USD', amountCents: 100 });
        await service.create({ employeeId: empId, allowanceType: 'meal', currencyId: 'CNY', amountCents: 200 });

        const all = await service.list(empId);
        expect(all.length).toBe(2);

        const housing = await service.list(empId, 'housing');
        expect(housing.length).toBe(1);
        expect(housing[0].allowance.allowanceType).toBe('housing');
    });

    it('should update allowance', async () => {
        const empId = uuid();
        await db.insert(schema.employees).values({ id: empId, name: 'Emp 1', active: 1, email: 'e1@test.com' }).execute();
        await db.insert(schema.currencies).values({ code: 'USD', name: 'US Dollar', active: 1 }).execute();

        const created = await service.create({
            employeeId: empId,
            allowanceType: 'housing',
            currencyId: 'USD',
            amountCents: 50000
        });

        const updated = await service.update(created!.allowance.id, { amountCents: 60000 });
        expect(updated?.allowance.amountCents).toBe(60000);
    });

    it('should delete allowance', async () => {
        const empId = uuid();
        await db.insert(schema.employees).values({ id: empId, name: 'Emp 1', active: 1, email: 'e1@test.com' }).execute();
        await db.insert(schema.currencies).values({ code: 'USD', name: 'US Dollar', active: 1 }).execute();

        const created = await service.create({
            employeeId: empId,
            allowanceType: 'housing',
            currencyId: 'USD',
            amountCents: 50000
        });

        const deleted = await service.delete(created!.allowance.id);
        expect(deleted).toBeDefined();

        const fetched = await service.get(created!.allowance.id);
        expect(fetched).toBeUndefined();
    });

    it('should batch update allowances', async () => {
        const empId = uuid();
        await db.insert(schema.employees).values({ id: empId, name: 'Emp 1', active: 1, email: 'e1@test.com' }).execute();
        await db.insert(schema.currencies).values({ code: 'USD', name: 'US Dollar', active: 1 }).execute();
        await db.insert(schema.currencies).values({ code: 'CNY', name: 'Yuan', active: 1 }).execute();

        // Initial set
        await service.create({ employeeId: empId, allowanceType: 'housing', currencyId: 'USD', amountCents: 100 });

        // Batch update: replace housing with CNY and USD
        const result = await service.batchUpdate(empId, 'housing', [
            { currencyId: 'CNY', amountCents: 1000 },
            { currencyId: 'USD', amountCents: 2000 }
        ]);

        expect(result.length).toBe(2);
        const cny = result.find(r => r.allowance.currencyId === 'CNY');
        const usd = result.find(r => r.allowance.currencyId === 'USD');
        expect(cny?.allowance.amountCents).toBe(1000);
        expect(usd?.allowance.amountCents).toBe(2000);

        // Verify old one is gone (by ID check or just count)
        const allHousing = await service.list(empId, 'housing');
        expect(allHousing.length).toBe(2);
    });
});
