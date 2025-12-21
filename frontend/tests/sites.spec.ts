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
});

