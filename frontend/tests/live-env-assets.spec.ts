/**
 * 线上测试环境 - 资产模块
 * 
 * 运行命令：npx playwright test tests/live-env-assets.spec.ts --workers=1
 */

import { test, expect } from '@playwright/test';
import { config, setupModuleTests, teardownModuleTests } from './live-env-shared';
import { ensureLoggedIn } from './utils/live-login';
import { navigateAndWait } from './utils/page-helpers';

test.describe.serial('线上环境测试 - 资产模块', () => {
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

    test('查看固定资产', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/assets/list`);
        expect(page.url()).toContain('/assets/list');
    });

    test('查看租赁物业', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/assets/rental`);
        expect(page.url()).toContain('/assets/rental');
    });

    // ==================== 资产模块交互测试 ====================
    test('测试固定资产搜索功能', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/assets/list`);
        await page.waitForTimeout(2000);
        
        // 查找搜索输入框
        const searchInput = page.locator('input[placeholder*="搜索"], input[placeholder*="资产"]').first();
        if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
            await searchInput.fill('测试');
            await page.waitForTimeout(1000);
            expect(await searchInput.inputValue()).toBe('测试');
        }
    });

    test('测试固定资产筛选功能', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/assets/list`);
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

    test('测试租赁物业筛选功能', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/assets/rental`);
        await page.waitForTimeout(2000);
        
        // 查找类型筛选下拉框
        const typeSelect = page.locator('.ant-select').filter({ hasText: /类型|全部/ }).first();
        if (await typeSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
            await typeSelect.click();
            await page.waitForTimeout(500);
            const option = page.locator('.ant-select-item-option').first();
            if (await option.isVisible({ timeout: 2000 }).catch(() => false)) {
                await option.click();
                await page.waitForTimeout(1000);
            }
        }
    });
});

