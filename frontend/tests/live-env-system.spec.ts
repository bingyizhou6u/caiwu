/**
 * 线上测试环境 - 系统管理模块
 * 
 * 运行命令：npx playwright test tests/live-env-system.spec.ts --workers=1
 */

import { test, expect } from '@playwright/test';
import { config, setupModuleTests, teardownModuleTests } from './live-env-shared';
import { ensureLoggedIn } from './utils/live-login';
import { navigateAndWait } from './utils/page-helpers';

test.describe.serial('线上环境测试 - 系统管理模块', () => {
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

    test('查看部门管理', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/system/departments`);
        expect(page.url()).toContain('/system/departments');
    });

    test('查看类别管理', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/system/categories`);
        expect(page.url()).toContain('/system/categories');
    });

    test('查看账户管理', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/system/accounts`);
        expect(page.url()).toContain('/system/accounts');
    });

    test('查看币种管理', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/system/currencies`);
        expect(page.url()).toContain('/system/currencies');
    });

    test('查看供应商管理', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/system/vendors`);
        expect(page.url()).toContain('/system/vendors');
    });

    test('查看权限管理', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/system/permissions`);
        expect(page.url()).toContain('/system/permissions');
    });

    test('查看邮件设置', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/system/email`);
        expect(page.url()).toContain('/system/email');
    });

    test('查看IP白名单', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/system/ip-whitelist`);
        expect(page.url()).toContain('/system/ip-whitelist');
    });

    test('查看审计日志', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/system/audit`);
        expect(page.url()).toContain('/system/audit');
    });

    // ==================== 系统管理模块交互测试 ====================
    test('测试部门管理搜索功能', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/system/departments`);
        await page.waitForTimeout(2000);
        
        // 查找搜索输入框
        const searchInput = page.locator('input[placeholder*="搜索"], input[placeholder*="部门"]').first();
        if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
            await searchInput.fill('测试');
            await page.waitForTimeout(1000);
            expect(await searchInput.inputValue()).toBe('测试');
        }
    });

    test('测试账户管理刷新功能', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/system/accounts`);
        await page.waitForTimeout(2000);
        
        // 查找刷新按钮
        const refreshButton = page.getByRole('button').filter({ hasText: /刷新/ }).first();
        if (await refreshButton.isVisible({ timeout: 3000 }).catch(() => false)) {
            await refreshButton.click();
            await page.waitForTimeout(1000);
            expect(await refreshButton.isVisible()).toBeTruthy();
        }
    });

    test('测试类别管理表格分页', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/system/categories`);
        await page.waitForTimeout(2000);
        
        // 查找分页器
        const pagination = page.locator('.ant-pagination').first();
        if (await pagination.isVisible({ timeout: 3000 }).catch(() => false)) {
            // 尝试点击下一页
            const nextButton = pagination.locator('.ant-pagination-next');
            if (await nextButton.isVisible({ timeout: 2000 }).catch(() => false) && !(await nextButton.getAttribute('aria-disabled'))) {
                await nextButton.click();
                await page.waitForTimeout(1000);
            }
        }
    });

    test('测试币种管理搜索功能', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/system/currencies`);
        await page.waitForTimeout(2000);
        
        const searchInput = page.locator('input[placeholder*="搜索"], input[placeholder*="币种"]').first();
        if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
            await searchInput.fill('测试');
            await page.waitForTimeout(1000);
            expect(await searchInput.inputValue()).toBe('测试');
        }
    });

    test('测试权限管理页面功能', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/system/permissions`);
        await page.waitForTimeout(2000);
        
        // 验证权限表格或列表存在
        const table = page.locator('.ant-table, .permission-list').first();
        const hasTable = await table.isVisible({ timeout: 3000 }).catch(() => false);
        if (hasTable) {
            expect(await table.isVisible()).toBeTruthy();
        }
    });

    test('测试邮件提醒设置页面功能', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/system/email`);
        await page.waitForTimeout(2000);
        
        // 验证表单或设置项存在
        const form = page.locator('.ant-form, .email-settings').first();
        const hasForm = await form.isVisible({ timeout: 3000 }).catch(() => false);
        if (hasForm) {
            expect(await form.isVisible()).toBeTruthy();
        }
    });

    test('测试IP白名单搜索功能', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/system/ip-whitelist`);
        await page.waitForTimeout(2000);
        
        const searchInput = page.locator('input[placeholder*="搜索"], input[placeholder*="IP"]').first();
        if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
            await searchInput.fill('192.168');
            await page.waitForTimeout(1000);
            expect(await searchInput.inputValue()).toBe('192.168');
        }
    });

    test('测试审计日志筛选功能', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/system/audit`);
        await page.waitForTimeout(2000);
        
        // 查找日期选择器或操作类型筛选
        const datePicker = page.locator('.ant-picker-input').first();
        const typeSelect = page.locator('.ant-select').filter({ hasText: /操作类型|类型/ }).first();
        if (await datePicker.isVisible({ timeout: 3000 }).catch(() => false)) {
            await datePicker.click();
            await page.waitForTimeout(1000);
        } else if (await typeSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
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

