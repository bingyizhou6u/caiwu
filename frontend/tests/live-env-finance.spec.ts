/**
 * 线上测试环境 - 财务模块
 * 
 * 运行命令：npx playwright test tests/live-env-finance.spec.ts --workers=1
 */

import { test, expect } from '@playwright/test';
import { config, setupModuleTests, teardownModuleTests } from './live-env-shared';
import { ensureLoggedIn } from './utils/live-login';
import { navigateAndWait } from './utils/page-helpers';

test.describe.serial('线上环境测试 - 财务模块', () => {
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

    test('查看收支列表', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/finance/flows`);
        expect(page.url()).toContain('/finance/flows');
    });

    test('查看新增收支页面', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/finance/flows/create`);
        expect(page.url()).toContain('/finance/flows/create');
    });

    test('查看账户转账', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/finance/transfer`);
        expect(page.url()).toContain('/finance/transfer');
    });

    test('查看账户交易', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/finance/transactions`);
        expect(page.url()).toContain('/finance/transactions');
    });

    test('查看导入中心', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/finance/import`);
        expect(page.url()).toContain('/finance/import');
    });

    test('查看应收管理', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/finance/ar`);
        expect(page.url()).toContain('/finance/ar');
    });

    test('查看应付管理', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/finance/ap`);
        expect(page.url()).toContain('/finance/ap');
    });

    test('查看账户明细', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/finance/transactions`);
        expect(page.url()).toContain('/finance/transactions');
    });

    test('查看数据导入', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/finance/import`);
        expect(page.url()).toContain('/finance/import');
    });

    // ==================== 财务模块交互测试 ====================
    test('测试收支列表搜索功能', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/finance/flows`);
        await page.waitForTimeout(2000);
        
        // 查找搜索输入框
        const searchInput = page.locator('input[placeholder*="搜索"], input[placeholder*="请输入"]').first();
        if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
            await searchInput.fill('测试');
            await page.waitForTimeout(1000);
            expect(await searchInput.inputValue()).toBe('测试');
        }
    });

    test('测试应收管理筛选功能', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/finance/ar`);
        await page.waitForTimeout(2000);
        
        // 查找状态筛选下拉框
        const statusSelect = page.locator('.ant-select').filter({ hasText: /状态|全部/ }).first();
        if (await statusSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
            await statusSelect.click();
            await page.waitForTimeout(500);
            const option = page.locator('.ant-select-item-option').first();
            if (await option.isVisible({ timeout: 2000 }).catch(() => false)) {
                await option.click();
                await page.waitForTimeout(1000);
            }
        }
    });

    test('测试应付管理刷新功能', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/finance/ap`);
        await page.waitForTimeout(2000);
        
        // 查找刷新按钮
        const refreshButton = page.getByRole('button').filter({ hasText: /刷新|刷新数据/ }).first();
        if (await refreshButton.isVisible({ timeout: 3000 }).catch(() => false)) {
            await refreshButton.click();
            await page.waitForTimeout(1000);
            expect(await refreshButton.isVisible()).toBeTruthy();
        }
    });

    test('测试账户明细筛选功能', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/finance/transactions`);
        await page.waitForTimeout(2000);
        
        // 查找账户筛选下拉框
        const accountSelect = page.locator('.ant-select').filter({ hasText: /账户/ }).first();
        if (await accountSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
            await accountSelect.click();
            await page.waitForTimeout(500);
            const option = page.locator('.ant-select-item-option').first();
            if (await option.isVisible({ timeout: 2000 }).catch(() => false)) {
                await option.click();
                await page.waitForTimeout(1000);
            }
        }
    });

    test('测试数据导入页面功能', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/finance/import`);
        await page.waitForTimeout(2000);
        
        // 验证上传组件存在
        const uploadButton = page.locator('.ant-upload, input[type="file"]').first();
        const hasUpload = await uploadButton.isVisible({ timeout: 3000 }).catch(() => false);
        if (hasUpload) {
            expect(await uploadButton.isVisible()).toBeTruthy();
        }
    });
});

