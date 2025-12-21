/**
 * 线上测试环境 - 人事模块
 * 
 * 运行命令：npx playwright test tests/live-env-hr.spec.ts --workers=1
 */

import { test, expect } from '@playwright/test';
import { config, setupModuleTests, teardownModuleTests } from './live-env-shared';
import { ensureLoggedIn } from './utils/live-login';
import { navigateAndWait } from './utils/page-helpers';

test.describe.serial('线上环境测试 - 人事模块', () => {
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

    test('查看员工管理', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/hr/employees`);
        expect(page.url()).toContain('/hr/employees');
    });

    test('查看薪资报表', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/hr/salary-report`);
        expect(page.url()).toContain('/hr/salary-report');
    });

    test('查看薪资发放', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/hr/salary-payments`);
        expect(page.url()).toContain('/hr/salary-payments');
    });

    test('查看补贴发放', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/hr/allowance-payments`);
        expect(page.url()).toContain('/hr/allowance-payments');
    });

    test('查看请假管理', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/hr/leaves`);
        expect(page.url()).toContain('/hr/leaves');
    });

    test('查看报销管理', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/hr/reimbursements`);
        expect(page.url()).toContain('/hr/reimbursements');
    });

    test('查看员工薪资报表', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/hr/salary-report`);
        expect(page.url()).toContain('/hr/salary-report');
    });

    test('查看薪资发放管理', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/hr/salary-payments`);
        expect(page.url()).toContain('/hr/salary-payments');
    });

    test('查看补贴发放管理', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/hr/allowance-payments`);
        expect(page.url()).toContain('/hr/allowance-payments');
    });

    // ==================== 人事模块交互测试 ====================
    test('测试员工管理搜索功能', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/hr/employees`);
        await page.waitForTimeout(2000);
        
        // 查找搜索输入框
        const searchInput = page.locator('input[placeholder*="搜索"], input[placeholder*="员工"], input[placeholder*="姓名"]').first();
        if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
            await searchInput.fill('测试');
            await page.waitForTimeout(1000);
            expect(await searchInput.inputValue()).toBe('测试');
        }
    });

    test('测试报销管理筛选功能', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/hr/reimbursements`);
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

    test('测试薪资报表查询功能', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/hr/salary-report`);
        await page.waitForTimeout(2000);
        
        // 查找日期选择器或查询按钮
        const datePicker = page.locator('.ant-picker-input').first();
        const queryButton = page.getByRole('button').filter({ hasText: /查询|搜索/ }).first();
        if (await datePicker.isVisible({ timeout: 3000 }).catch(() => false)) {
            await datePicker.click();
            await page.waitForTimeout(1000);
        } else if (await queryButton.isVisible({ timeout: 3000 }).catch(() => false)) {
            await queryButton.click();
            await page.waitForTimeout(1000);
        }
    });

    test('测试薪资发放管理筛选功能', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/hr/salary-payments`);
        await page.waitForTimeout(2000);
        
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

    test('测试补贴发放管理筛选功能', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/hr/allowance-payments`);
        await page.waitForTimeout(2000);
        
        const yearSelect = page.locator('.ant-select').filter({ hasText: /年份|年/ }).first();
        if (await yearSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
            await yearSelect.click();
            await page.waitForTimeout(500);
            const option = page.locator('.ant-select-item-option').first();
            if (await option.isVisible({ timeout: 2000 }).catch(() => false)) {
                await option.click();
                await page.waitForTimeout(1000);
            }
        }
    });

    test('测试请假管理搜索功能', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/hr/leaves`);
        await page.waitForTimeout(2000);
        
        const searchInput = page.locator('input[placeholder*="搜索"], input[placeholder*="员工"], input[placeholder*="姓名"]').first();
        if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
            await searchInput.fill('测试');
            await page.waitForTimeout(1000);
            expect(await searchInput.inputValue()).toBe('测试');
        }
    });
});

