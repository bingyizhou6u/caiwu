import { test, expect } from './fixtures';
import { setupCommonMocks } from './utils/mock-api';
import { createPageObjects } from './utils/page-objects';

test.describe('Reports Complete', () => {
    test.beforeEach(async ({ page }) => {
        await setupCommonMocks(page);
    });

    test('AR汇总报表 - 筛选和导出', async ({ page }) => {
        // Mock AR汇总报表 API
        await page.route('**/api/v2/reports/ar-summary*', async route => {
            await route.fulfill({
                json: {
                    results: [
                        {
                            departmentName: 'Sales Dept',
                            totalAmountCents: 1000000,
                            settledAmountCents: 500000,
                            outstandingAmountCents: 500000
                        }
                    ],
                    total: 1,
                    summary: {
                        totalAmountCents: 1000000,
                        settledAmountCents: 500000,
                        outstandingAmountCents: 500000
                    }
                }
            });
        });

        // Mock 导出 API
        await page.route('**/api/v2/reports/ar-summary/export*', async route => {
            await route.fulfill({
                status: 200,
                headers: {
                    'Content-Type': 'text/csv',
                    'Content-Disposition': 'attachment; filename="ar-summary.csv"'
                },
                body: '部门,总金额,已结算,未结算\nSales Dept,10000.00,5000.00,5000.00'
            });
        });

        // 登录
        const pages = createPageObjects(page);
        await pages.login.login('admin@example.com', 'password');
        await pages.login.expectLoginSuccess();

        // 导航到AR汇总报表页面
        await pages.reportARSummary.goto();
        await expect(page.locator('h1').filter({ hasText: /AR汇总/ })).toBeVisible({ timeout: 10000 });

        // 筛选
        await pages.reportARSummary.filterByDateRange('2024-01-01', '2024-12-31');

        // 验证数据显示
        await expect(page.getByText('Sales Dept')).toBeVisible();

        // 导出
        await pages.reportARSummary.export();
    });

    test('AP汇总报表 - 筛选和导出', async ({ page }) => {
        // Mock AP汇总报表 API
        await page.route('**/api/v2/reports/ap-summary*', async route => {
            await route.fulfill({
                json: {
                    results: [
                        {
                            departmentName: 'Sales Dept',
                            totalAmountCents: 800000,
                            settledAmountCents: 300000,
                            outstandingAmountCents: 500000
                        }
                    ],
                    total: 1,
                    summary: {
                        totalAmountCents: 800000,
                        settledAmountCents: 300000,
                        outstandingAmountCents: 500000
                    }
                }
            });
        });

        // Mock 导出 API
        await page.route('**/api/v2/reports/ap-summary/export*', async route => {
            await route.fulfill({
                status: 200,
                headers: {
                    'Content-Type': 'text/csv',
                    'Content-Disposition': 'attachment; filename="ap-summary.csv"'
                },
                body: '部门,总金额,已结算,未结算\nSales Dept,8000.00,3000.00,5000.00'
            });
        });

        // 登录
        const pages = createPageObjects(page);
        await pages.login.login('admin@example.com', 'password');
        await pages.login.expectLoginSuccess();

        // 导航到AP汇总报表页面
        await pages.reportAPSummary.goto();
        await expect(page.locator('h1').filter({ hasText: /AP汇总/ })).toBeVisible({ timeout: 10000 });

        // 筛选
        await pages.reportAPSummary.filterByDateRange('2024-01-01', '2024-12-31');

        // 验证数据显示
        await expect(page.getByText('Sales Dept')).toBeVisible();

        // 导出
        await pages.reportAPSummary.export();
    });

    test('部门现金流报表', async ({ page }) => {
        // Mock 部门现金流报表 API
        await page.route('**/api/v2/reports/dept-cash*', async route => {
            await route.fulfill({
                json: {
                    results: [
                        {
                            departmentName: 'Sales Dept',
                            incomeCents: 2000000,
                            expenseCents: 1500000,
                            balanceCents: 500000
                        }
                    ],
                    total: 1
                }
            });
        });

        // 登录
        const pages = createPageObjects(page);
        await pages.login.login('admin@example.com', 'password');
        await pages.login.expectLoginSuccess();

        // 导航到部门现金流报表页面
        await pages.reportDepartmentCash.goto();
        await expect(page.locator('h1').filter({ hasText: /部门现金流/ })).toBeVisible({ timeout: 10000 });

        // 筛选
        await pages.reportDepartmentCash.filterByDepartment('Sales Dept');

        // 验证数据显示
        await expect(page.getByText('Sales Dept')).toBeVisible();
    });

    test('账户余额报表', async ({ page }) => {
        // Mock 账户余额报表 API
        await page.route('**/api/v2/reports/account-balance*', async route => {
            await route.fulfill({
                json: {
                    results: [
                        {
                            accountName: 'Bank Account',
                            currency: 'CNY',
                            balanceCents: 10000000,
                            openingBalanceCents: 5000000
                        }
                    ],
                    total: 1
                }
            });
        });

        // 登录
        const pages = createPageObjects(page);
        await pages.login.login('admin@example.com', 'password');
        await pages.login.expectLoginSuccess();

        // 导航到账户余额报表页面
        await pages.reportAccountBalance.goto();
        await expect(page.locator('h1').filter({ hasText: /账户余额/ })).toBeVisible({ timeout: 10000 });

        // 筛选
        await pages.reportAccountBalance.filterByAccount('Bank Account');

        // 验证数据显示
        await expect(page.getByText('Bank Account')).toBeVisible();
    });

    test('费用汇总报表', async ({ page }) => {
        // Mock 费用汇总报表 API
        await page.route('**/api/v2/reports/expense-summary*', async route => {
            await route.fulfill({
                json: {
                    results: [
                        {
                            categoryName: 'Travel',
                            totalAmountCents: 500000,
                            count: 10
                        }
                    ],
                    total: 1,
                    summary: {
                        totalAmountCents: 500000,
                        totalCount: 10
                    }
                }
            });
        });

        // 登录
        const pages = createPageObjects(page);
        await pages.login.login('admin@example.com', 'password');
        await pages.login.expectLoginSuccess();

        // 导航到费用汇总报表页面
        await page.goto('http://localhost:5173/reports/expense-summary');
        await expect(page.locator('h1').filter({ hasText: /费用汇总/ })).toBeVisible({ timeout: 10000 });

        // 验证数据显示
        await expect(page.getByText('Travel')).toBeVisible();
    });
});

