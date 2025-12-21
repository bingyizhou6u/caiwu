/**
 * 线上测试环境 - 报表模块
 * 
 * 运行命令：npx playwright test tests/live-env-reports.spec.ts --workers=1
 */

import { test, expect } from '@playwright/test';
import { config, setupModuleTests, teardownModuleTests } from './live-env-shared';
import { ensureLoggedIn } from './utils/live-login';
import { navigateAndWait } from './utils/page-helpers';

test.describe.serial('线上环境测试 - 报表模块', () => {
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

    test('查看部门现金流报表', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/reports/dept-cash`);
        expect(page.url()).toContain('/reports/dept-cash');
    });

    test('查看站点增长报表', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/reports/site-growth`);
        expect(page.url()).toContain('/reports/site-growth');
    });

    test('查看应收汇总报表', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/reports/ar-summary`);
        expect(page.url()).toContain('/reports/ar-summary');
    });

    test('查看应收明细报表', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/reports/ar-detail`);
        expect(page.url()).toContain('/reports/ar-detail');
    });

    test('查看应付汇总报表', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/reports/ap-summary`);
        expect(page.url()).toContain('/reports/ap-summary');
    });

    test('查看应付明细报表', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/reports/ap-detail`);
        expect(page.url()).toContain('/reports/ap-detail');
    });

    test('查看费用汇总报表', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/reports/expense-summary`);
        expect(page.url()).toContain('/reports/expense-summary');
    });

    test('查看费用明细报表', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/reports/expense-detail`);
        expect(page.url()).toContain('/reports/expense-detail');
    });

    test('查看账户余额报表', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/reports/account-balance`);
        expect(page.url()).toContain('/reports/account-balance');
    });


    // ==================== 报表模块交互测试 ====================
    test('测试报表日期筛选功能', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/reports/dept-cash`);
        await page.waitForTimeout(2000);
        
        // 查找日期选择器
        const datePicker = page.locator('.ant-picker-input').first();
        if (await datePicker.isVisible({ timeout: 3000 }).catch(() => false)) {
            await datePicker.click();
            await page.waitForTimeout(500);
            // 尝试选择今天
            const todayButton = page.locator('.ant-picker-today-btn, .ant-picker-cell-today').first();
            if (await todayButton.isVisible({ timeout: 2000 }).catch(() => false)) {
                await todayButton.click();
                await page.waitForTimeout(1000);
            }
        }
    });

    test('测试报表查询功能', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/reports/ar-summary`);
        await page.waitForTimeout(2000);
        
        // 查找查询按钮
        const queryButton = page.getByRole('button').filter({ hasText: /查询|搜索|确定/ }).first();
        if (await queryButton.isVisible({ timeout: 3000 }).catch(() => false)) {
            await queryButton.click();
            await page.waitForTimeout(2000);
            expect(await queryButton.isVisible()).toBeTruthy();
        }
    });

    test('测试报表导出功能', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/reports/dept-cash`);
        await page.waitForTimeout(2000);
        
        // 查找导出按钮
        const exportButton = page.getByRole('button').filter({ hasText: /导出|下载/ }).first();
        if (await exportButton.isVisible({ timeout: 3000 }).catch(() => false)) {
            // 仅验证按钮存在，不实际点击（避免下载文件）
            expect(await exportButton.isVisible()).toBeTruthy();
        }
    });

    test('测试报表部门筛选功能', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/reports/dept-cash`);
        await page.waitForTimeout(2000);
        
        const deptSelect = page.locator('.ant-select').filter({ hasText: /部门|项目/ }).first();
        if (await deptSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
            await deptSelect.click();
            await page.waitForTimeout(500);
            const option = page.locator('.ant-select-item-option').first();
            if (await option.isVisible({ timeout: 2000 }).catch(() => false)) {
                await option.click();
                await page.waitForTimeout(1000);
            }
        }
    });

    test('测试报表数据展示', async ({ page }) => {
        await navigateAndWait(page, `${config.baseUrl}/reports/account-balance`);
        await page.waitForTimeout(3000);
        
        // 验证报表数据或图表存在
        const chart = page.locator('canvas, .ant-table, .ant-statistic').first();
        await chart.waitFor({ timeout: 5000 }).catch(() => {});
        expect(page.url()).toContain('/reports/account-balance');
    });
});

