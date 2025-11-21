import { env } from 'cloudflare:test';
import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { FinanceService } from '../../src/services/FinanceService';
import { uuid } from '../../src/utils/db';
// @ts-ignore
import schema from '../../src/db/schema.sql?raw';

describe('FinanceService', () => {
    let financeService: FinanceService;

    beforeAll(async () => {
        // Split schema into statements and execute them one by one
        const statements = schema.split(';').filter((s: string) => s.trim().length > 0);
        for (const statement of statements) {
            await env.DB.prepare(statement).run();
        }
    });

    beforeEach(() => {
        financeService = new FinanceService(env.DB);
    });

    it('should calculate account balance before a date', async () => {
        const accountId = uuid();
        const date = '2023-01-10';
        const now = Date.now();

        // Setup: Opening balance
        await env.DB.prepare('INSERT INTO opening_balances (id, type, ref_id, amount_cents, created_at) VALUES (?, ?, ?, ?, ?)')
            .bind(uuid(), 'account', accountId, 1000, now - 10000).run();

        // Setup: Transactions before date
        await env.DB.prepare('INSERT INTO cash_flows (id, account_id, type, amount_cents, biz_date, created_at) VALUES (?, ?, ?, ?, ?, ?)')
            .bind(uuid(), accountId, 'income', 500, '2023-01-05', now - 5000).run();

        // Setup: Transactions on date (should NOT be included if we query with same timestamp)
        await env.DB.prepare('INSERT INTO cash_flows (id, account_id, type, amount_cents, biz_date, created_at) VALUES (?, ?, ?, ?, ?, ?)')
            .bind(uuid(), accountId, 'expense', 200, '2023-01-10', now).run();

        // Setup: Transactions after date
        await env.DB.prepare('INSERT INTO cash_flows (id, account_id, type, amount_cents, biz_date, created_at) VALUES (?, ?, ?, ?, ?, ?)')
            .bind(uuid(), accountId, 'income', 300, '2023-01-15', now + 5000).run();

        // Query with 'now'. Since expense was created at 'now', created_at < now is FALSE.
        const balance = await financeService.getAccountBalanceBefore(accountId, date, now);

        // Expected: 1000 (opening) + 500 (income before) = 1500
        expect(balance).toBe(1500);
    });

    it('should return 0 if no balance or flows', async () => {
        const accountId = uuid();
        const balance = await financeService.getAccountBalanceBefore(accountId, '2023-01-01', Date.now());
        expect(balance).toBe(0);
    });
});
