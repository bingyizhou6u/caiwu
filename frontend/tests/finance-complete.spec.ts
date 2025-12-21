import { test, expect } from './fixtures';
import { setupCommonMocks } from './utils/mock-api';
import { createPageObjects } from './utils/page-objects';
import { TestDataFactory } from './utils/test-data-factory';

test.describe('Finance Complete', () => {
    test.beforeEach(async ({ page }) => {
        await setupCommonMocks(page);
    });

    test('账户转账 - 创建转账记录', async ({ page }) => {
        let createdTransfer: any = null;

        // Mock 转账 API
        await page.route('**/api/v2/transfers*', async route => {
            const method = route.request().method();
            if (method === 'POST') {
                createdTransfer = route.request().postDataJSON();
                await route.fulfill({
                    json: {
                        id: 'transfer1',
                        ...createdTransfer,
                        created_at: Date.now()
                    }
                });
            } else {
                await route.fulfill({ json: { results: [], total: 0 } });
            }
        });

        // 登录
        const pages = createPageObjects(page);
        await pages.login.login('admin@example.com', 'password');
        await pages.login.expectLoginSuccess();

        // 导航到转账页面
        await pages.accountTransfer.goto();
        await expect(page.locator('h1').filter({ hasText: /转账/ })).toBeVisible({ timeout: 10000 });

        // 创建转账
        const transferData = TestDataFactory.createAccountTransfer();
        await pages.accountTransfer.createTransfer({
            fromAccount: 'Bank Account',
            toAccount: 'Bank Account',
            amount: String(transferData.amountCents / 100),
            exchangeRate: '1'
        });

        // 验证成功
        await pages.accountTransfer.waitForMessage('success');
        expect(createdTransfer).toBeTruthy();
    });

    test('账户交易查询', async ({ page }) => {
        // Mock 交易查询 API
        await page.route('**/api/v2/account-transactions*', async route => {
            await route.fulfill({
                json: {
                    results: [
                        {
                            id: 'tx1',
                            accountId: 'acc1',
                            type: 'income',
                            amountCents: 100000,
                            createdAt: Date.now()
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

        // 导航到交易页面
        await page.goto('http://localhost:5173/finance/transactions');
        await expect(page.locator('h1').filter({ hasText: /交易/ })).toBeVisible({ timeout: 10000 });

        // 验证交易列表显示
        await expect(page.locator('.ant-table-wrapper')).toBeVisible();
    });

    test('AR单据 - 查看和筛选', async ({ page }) => {
        // Mock AR API
        await page.route('**/api/v2/ar*', async route => {
            await route.fulfill({
                json: {
                    results: [
                        {
                            id: 'ar1',
                            customerName: 'Customer A',
                            amountCents: 100000,
                            status: 'open',
                            createdAt: Date.now()
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

        // 导航到AR页面
        await pages.ar.goto();
        await expect(page.locator('h1').filter({ hasText: /应收/ })).toBeVisible({ timeout: 10000 });

        // 验证列表显示
        await expect(page.getByText('Customer A')).toBeVisible();

        // 筛选
        await pages.ar.filterByDepartment('Sales Dept');
        await pages.ar.filterByStatus('open');
    });

    test('AP单据 - 查看和筛选', async ({ page }) => {
        // Mock AP API
        await page.route('**/api/v2/ap*', async route => {
            await route.fulfill({
                json: {
                    results: [
                        {
                            id: 'ap1',
                            vendorName: 'Vendor A',
                            amountCents: 50000,
                            status: 'open',
                            createdAt: Date.now()
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

        // 导航到AP页面
        await pages.ap.goto();
        await expect(page.locator('h1').filter({ hasText: /应付/ })).toBeVisible({ timeout: 10000 });

        // 验证列表显示
        await expect(page.getByText('Vendor A')).toBeVisible();

        // 筛选
        await pages.ap.filterByDepartment('Sales Dept');
        await pages.ap.filterByStatus('open');
    });
});

