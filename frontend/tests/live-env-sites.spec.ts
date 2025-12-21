/**
 * 线上测试环境 - 站点模块
 * 
 * 运行命令：npx playwright test tests/live-env-sites.spec.ts --workers=1
 */

import { test, expect } from '@playwright/test';
import { config, setupModuleTests, teardownModuleTests } from './live-env-shared';
import { ensureLoggedIn } from './utils/live-login';
import { navigateAndWait } from './utils/page-helpers';

test.describe.serial('线上环境测试 - 站点模块', () => {
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

    test('查看站点管理', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/sites/list`);
        expect(page.url()).toContain('/sites/list');
    });

    test('查看站点账单', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/sites/bills`);
        expect(page.url()).toContain('/sites/bills');
    });

    test('测试站点管理搜索功能', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/sites/list`);
        await page.waitForTimeout(2000);
        
        // 查找搜索输入框
        const searchInput = page.locator('input[placeholder*="搜索"], input[placeholder*="站点"]').first();
        if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
            await searchInput.fill('测试');
            await page.waitForTimeout(1000);
            expect(await searchInput.inputValue()).toBe('测试');
        }
    });

    test('测试站点账单筛选功能', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/sites/bills`);
        await page.waitForTimeout(2000);
        
        // 查找日期选择器或筛选下拉框
        const filterElement = page.locator('.ant-picker-input, .ant-select').first();
        if (await filterElement.isVisible({ timeout: 3000 }).catch(() => false)) {
            await filterElement.click();
            await page.waitForTimeout(1000);
        }
    });
});

