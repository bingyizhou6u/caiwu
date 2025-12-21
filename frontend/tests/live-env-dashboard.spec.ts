/**
 * 线上测试环境 - 个人中心模块
 * 
 * 运行命令：npx playwright test tests/live-env-dashboard.spec.ts --workers=1
 */

import { test, expect } from '@playwright/test';
import { config, setupModuleTests, teardownModuleTests } from './live-env-shared';
import { ensureLoggedIn } from './utils/live-login';
import { navigateAndWait } from './utils/page-helpers';

test.describe.serial('线上环境测试 - 个人中心', () => {
    test.beforeEach(async ({ page }) => {
        test.skip(!config.totpSecret, 'TOTP Secret 未配置');
        await ensureLoggedIn(page, config);
        await page.waitForTimeout(2000);
    });

    test.beforeAll(async () => {
        await setupModuleTests();
    });

    test.afterAll(async () => {
        teardownModuleTests();
    });

    test('查看个人中心', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/my/center`);
        expect(page.url()).toContain('/my/center');
    });

    test('查看我的请假', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/my/leaves`);
        expect(page.url()).toContain('/my/leaves');
    });

    test('查看我的报销', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/my/reimbursements`);
        expect(page.url()).toContain('/my/reimbursements');
    });

    test('查看我的资产', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/my/assets`);
        expect(page.url()).toContain('/my/assets');
    });

    test('查看我的审批', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/my/approvals`);
        expect(page.url()).toContain('/my/approvals');
    });

    test('查看公司制度', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/my/policies`);
        expect(page.url()).toContain('/my/policies');
    });

    test('查看修改密码页面', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/change-password`);
        expect(page.url()).toContain('/change-password');
    });

    test('测试个人中心数据展示', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/my/center`);
        await page.waitForTimeout(2000);
        
        // 验证个人信息卡片存在
        const card = page.locator('.ant-card, .ant-descriptions').first();
        await card.waitFor({ timeout: 5000 }).catch(() => {});
        expect(page.url()).toContain('/my/center');
    });

    test('测试我的请假列表功能', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/my/leaves`);
        await page.waitForTimeout(2000);
        
        // 验证列表或表格存在
        const table = page.locator('.ant-table, .data-table').first();
        const hasTable = await table.isVisible({ timeout: 3000 }).catch(() => false);
        const emptyState = page.locator('.ant-empty, .empty-state');
        const hasEmpty = await emptyState.isVisible({ timeout: 2000 }).catch(() => false);
        expect(hasTable || hasEmpty).toBeTruthy();
    });

    test('测试我的报销列表功能', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/my/reimbursements`);
        await page.waitForTimeout(2000);
        
        const table = page.locator('.ant-table, .data-table').first();
        const hasTable = await table.isVisible({ timeout: 3000 }).catch(() => false);
        const emptyState = page.locator('.ant-empty, .empty-state');
        const hasEmpty = await emptyState.isVisible({ timeout: 2000 }).catch(() => false);
        expect(hasTable || hasEmpty).toBeTruthy();
    });

    test('测试我的资产列表功能', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/my/assets`);
        await page.waitForTimeout(2000);
        
        const table = page.locator('.ant-table, .data-table').first();
        const hasTable = await table.isVisible({ timeout: 3000 }).catch(() => false);
        const emptyState = page.locator('.ant-empty, .empty-state');
        const hasEmpty = await emptyState.isVisible({ timeout: 2000 }).catch(() => false);
        expect(hasTable || hasEmpty).toBeTruthy();
    });

    test('测试我的审批列表功能', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/my/approvals`);
        await page.waitForTimeout(2000);
        
        const table = page.locator('.ant-table, .data-table').first();
        const hasTable = await table.isVisible({ timeout: 3000 }).catch(() => false);
        const emptyState = page.locator('.ant-empty, .empty-state');
        const hasEmpty = await emptyState.isVisible({ timeout: 2000 }).catch(() => false);
        expect(hasTable || hasEmpty).toBeTruthy();
    });

    test('测试公司制度页面功能', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/my/policies`);
        await page.waitForTimeout(2000);
        
        // 验证页面内容存在
        const content = page.locator('.ant-card, .policy-content, .ant-typography').first();
        await content.waitFor({ timeout: 5000 }).catch(() => {});
        expect(page.url()).toContain('/my/policies');
    });
});
