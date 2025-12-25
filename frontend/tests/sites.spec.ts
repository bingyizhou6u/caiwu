import { test, expect } from './fixtures';
import { setupCommonMocks } from './utils/mock-api';
import { createPageObjects } from './utils/page-objects';
import { TestDataFactory } from './utils/test-data-factory';

test.describe('Sites Management', () => {
    test.beforeEach(async ({ page }) => {
        await setupCommonMocks(page);
    });

    test('站点列表 - 查看和创建', async ({ page }) => {
        let createdSite: any = null;

        // Mock 站点 API
        await page.route('**/api/v2/sites*', async route => {
            const method = route.request().method();
            if (method === 'POST') {
                createdSite = route.request().postDataJSON();
                await route.fulfill({
                    json: {
                        id: 'site-new',
                        ...createdSite,
                        created_at: Date.now()
                    }
                });
            } else {
                await route.fulfill({
                    json: {
                        results: [
                            {
                                id: 'site1',
                                name: 'Site A',
                                departmentId: 'dept1',
                                departmentName: 'Sales Dept',
                                active: 1
                            }
                        ],
                        total: 1
                    }
                });
            }
        });

        // 登录
        const pages = createPageObjects(page);
        await pages.login.login('admin@example.com', 'password');
        await pages.login.expectLoginSuccess();

        // 导航到站点管理页面
        await page.goto('http://localhost:5173/sites/list');
        await expect(page.locator('h1').filter({ hasText: /站点管理/ })).toBeVisible({ timeout: 10000 });

        // 验证列表显示
        await expect(page.getByText('Site A')).toBeVisible();

        // 创建站点
        const siteData = TestDataFactory.createSite();
        await page.click('button:has-text("新建站点")');

        // 填写表单
        const modal = page.locator('.ant-modal-content:visible');
        await modal.locator('input#name').fill(siteData.name);
        await modal.locator('#departmentId').locator('xpath=./ancestor::div[contains(@class, "ant-select-selector")]').click();
        await page.locator('.ant-select-item-option').filter({ hasText: 'Sales Dept' }).click();

        // 提交
        await modal.locator('button:has-text("保存")').click();

        // 验证成功
        await expect(page.getByText('创建成功')).toBeVisible();
        expect(createdSite).toBeTruthy();
    });

    test('站点账单 - 创建和查看', async ({ page }) => {
        let createdBill: any = null;

        // Mock 站点账单 API
        await page.route('**/api/v2/site-bills*', async route => {
            const method = route.request().method();
            if (method === 'POST') {
                createdBill = route.request().postDataJSON();
                await route.fulfill({
                    json: {
                        id: 'bill-new',
                        ...createdBill,
                        created_at: Date.now()
                    }
                });
            } else {
                await route.fulfill({
                    json: {
                        results: [
                            {
                                id: 'bill1',
                                siteName: 'Site A',
                                accountName: 'Bank Account',
                                categoryName: 'Rent',
                                amountCents: 100000,
                                billDate: '2024-01-15'
                            }
                        ],
                        total: 1
                    }
                });
            }
        });

        // Mock 站点列表
        await page.route('**/api/v2/sites*', async route => {
            await route.fulfill({
                json: {
                    results: [
                        { id: 'site1', name: 'Site A', active: 1 }
                    ],
                    total: 1
                }
            });
        });

        // 登录
        const pages = createPageObjects(page);
        await pages.login.login('admin@example.com', 'password');
        await pages.login.expectLoginSuccess();

        // 导航到站点账单页面
        await page.goto('http://localhost:5173/sites/bills');
        await expect(page.locator('h1').filter({ hasText: /站点账单/ })).toBeVisible({ timeout: 10000 });

        // 验证列表显示
        await expect(page.getByText('Site A')).toBeVisible();

        // 创建账单
        const billData = TestDataFactory.createSiteBill();
        await page.click('button:has-text("新建账单")');

        // 填写表单
        const modal = page.locator('.ant-modal-content:visible');
        await modal.locator('#siteId').locator('xpath=./ancestor::div[contains(@class, "ant-select-selector")]').click();
        await page.locator('.ant-select-item-option').filter({ hasText: 'Site A' }).click();

        await modal.locator('#accountId').locator('xpath=./ancestor::div[contains(@class, "ant-select-selector")]').click();
        await page.locator('.ant-select-item-option').filter({ hasText: 'Bank Account' }).click();

        await modal.locator('#categoryId').locator('xpath=./ancestor::div[contains(@class, "ant-select-selector")]').click();
        await page.locator('.ant-select-item-option').filter({ hasText: 'Office Expense' }).click();

        await modal.locator('input#amountCents').fill(String(billData.amountCents / 100));
        await modal.locator('input#billDate').fill(billData.billDate);

        // 提交
        await modal.locator('button:has-text("保存")').click();

        // 验证成功
        await expect(page.getByText('创建成功')).toBeVisible();
        expect(createdBill).toBeTruthy();
    });

    test('站点删除 - 有流水时阻止删除', async ({ page }) => {
        // Mock 站点列表
        await page.route('**/api/v2/sites*', async route => {
            const method = route.request().method();
            const url = route.request().url();

            if (method === 'DELETE') {
                // 模拟有流水记录时的删除失败
                await route.fulfill({
                    status: 400,
                    json: {
                        success: false,
                        error: {
                            code: 'BUS_GENERAL',
                            message: '无法删除，该站点还有流水记录'
                        }
                    }
                });
            } else {
                await route.fulfill({
                    json: {
                        results: [
                            {
                                id: 'site-with-flows',
                                name: 'Site With Flows',
                                departmentId: 'dept1',
                                departmentName: 'Sales',
                                active: 1
                            },
                            {
                                id: 'site-empty',
                                name: 'Empty Site',
                                departmentId: 'dept1',
                                departmentName: 'Sales',
                                active: 1
                            }
                        ],
                        total: 2
                    }
                });
            }
        });

        // 登录
        const pages = createPageObjects(page);
        await pages.login.login('admin@example.com', 'password');
        await pages.login.expectLoginSuccess();

        // 导航到站点管理
        await page.goto('http://localhost:5173/sites/list');
        await expect(page.getByText('Site With Flows')).toBeVisible({ timeout: 10000 });

        // 尝试删除有流水的站点
        const siteRow = page.locator('tr', { hasText: 'Site With Flows' });
        await siteRow.locator('button').filter({ hasText: '删除' }).click();

        // 确认删除
        const confirmModal = page.locator('.ant-modal-confirm-body:visible').or(
            page.locator('.ant-popconfirm:visible')
        );
        if (await confirmModal.isVisible()) {
            await page.locator('button').filter({ hasText: '确定' }).click();
        }

        // 验证错误提示
        await expect(page.getByText('无法删除').or(page.getByText('流水记录'))).toBeVisible({ timeout: 5000 });
    });
});
