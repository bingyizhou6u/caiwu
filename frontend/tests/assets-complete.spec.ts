import { test, expect } from './fixtures';
import { setupCommonMocks } from './utils/mock-api';
import { createPageObjects } from './utils/page-objects';
import { TestDataFactory } from './utils/test-data-factory';

test.describe('Assets Complete', () => {
    test.beforeEach(async ({ page }) => {
        await setupCommonMocks(page);
    });

    test('固定资产分配', async ({ page }) => {
        // Mock 资产分配 API
        await page.route('**/api/v2/fixed-assets/*/allocate*', async route => {
            const body = route.request().postDataJSON();
            await route.fulfill({
                json: {
                    id: 'allocation1',
                    assetId: 'asset1',
                    employeeId: body.employeeId,
                    allocatedAt: Date.now()
                }
            });
        });

        // Mock 资产列表
        await page.route('**/api/v2/fixed-assets*', async route => {
            await route.fulfill({
                json: {
                    results: [
                        {
                            id: 'asset1',
                            assetCode: 'FA-001',
                            name: 'Laptop',
                            status: 'in_use'
                        }
                    ],
                    total: 1
                }
            });
        });

        // Mock 员工列表
        await page.route('**/api/v2/employees*', async route => {
            await route.fulfill({
                json: {
                    results: [
                        { id: 'emp1', name: 'Test Employee', email: 'test@example.com' }
                    ],
                    total: 1
                }
            });
        });

        // 登录
        const pages = createPageObjects(page);
        await pages.login.login('admin@example.com', 'password');
        await pages.login.expectLoginSuccess();

        // 导航到资产管理页面
        await pages.fixedAssetsManagement.goto();
        await expect(page.locator('h1').filter({ hasText: /资产管理/ })).toBeVisible({ timeout: 10000 });

        // 分配资产
        await pages.fixedAssetsManagement.allocateAsset('asset1', 'emp1');

        // 验证成功
        await pages.fixedAssetsManagement.waitForMessage('success');
    });

    test('固定资产变更 - 购买', async ({ page }) => {
        let createdChange: any = null;

        // Mock 资产变更 API
        await page.route('**/api/v2/fixed-assets/changes*', async route => {
            const method = route.request().method();
            if (method === 'POST') {
                createdChange = route.request().postDataJSON();
                await route.fulfill({
                    json: {
                        id: 'change1',
                        ...createdChange,
                        changeType: 'purchase',
                        createdAt: Date.now()
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

        // 导航到资产购买页面
        await page.goto('http://localhost:5173/assets/purchase');
        await expect(page.locator('h1').filter({ hasText: /资产购买/ })).toBeVisible({ timeout: 10000 });

        // 填写购买信息
        const assetData = TestDataFactory.createFixedAsset();
        await page.fill('input#assetCode', assetData.assetCode);
        await page.fill('input#name', assetData.name);
        await page.fill('input#purchasePriceCents', String(assetData.purchasePriceCents));

        // 选择货币
        await page.locator('#currency').locator('xpath=./ancestor::div[contains(@class, "ant-select-selector")]').click();
        await page.locator('.ant-select-item-option').filter({ hasText: 'CNY' }).click();

        // 提交
        await page.click('button:has-text("保存")');

        // 验证成功
        await expect(page.getByText('创建成功')).toBeVisible();
        expect(createdChange).toBeTruthy();
    });

    test('固定资产变更 - 出售', async ({ page }) => {
        let createdSale: any = null;

        // Mock 资产出售 API
        await page.route('**/api/v2/fixed-assets/changes*', async route => {
            const method = route.request().method();
            if (method === 'POST') {
                createdSale = route.request().postDataJSON();
                await route.fulfill({
                    json: {
                        id: 'sale1',
                        ...createdSale,
                        changeType: 'sale',
                        createdAt: Date.now()
                    }
                });
            } else {
                await route.fulfill({ json: { results: [], total: 0 } });
            }
        });

        // Mock 资产列表
        await page.route('**/api/v2/fixed-assets*', async route => {
            await route.fulfill({
                json: {
                    results: [
                        {
                            id: 'asset1',
                            assetCode: 'FA-001',
                            name: 'Laptop',
                            status: 'in_use'
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

        // 导航到资产出售页面
        await page.goto('http://localhost:5173/assets/sale');
        await expect(page.locator('h1').filter({ hasText: /资产出售/ })).toBeVisible({ timeout: 10000 });

        // 选择资产并填写出售信息
        await page.locator('#assetId').locator('xpath=./ancestor::div[contains(@class, "ant-select-selector")]').click();
        await page.locator('.ant-select-item-option').filter({ hasText: 'FA-001' }).click();
        await page.fill('input#salePriceCents', '100000');
        await page.fill('input#saleDate', '2024-01-15');

        // 提交
        await page.click('button:has-text("保存")');

        // 验证成功
        await expect(page.getByText('创建成功')).toBeVisible();
        expect(createdSale).toBeTruthy();
    });

    test('租赁管理 - 查看和创建租赁记录', async ({ page }) => {
        let createdRental: any = null;

        // Mock 租赁 API
        await page.route('**/api/v2/rental-properties*', async route => {
            const method = route.request().method();
            if (method === 'POST') {
                createdRental = route.request().postDataJSON();
                await route.fulfill({
                    json: {
                        id: 'rental1',
                        ...createdRental,
                        created_at: Date.now()
                    }
                });
            } else {
                await route.fulfill({
                    json: {
                        results: [
                            {
                                id: 'rental1',
                                propertyType: 'office',
                                monthlyRentCents: 500000,
                                currency: 'CNY'
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

        // 导航到租赁管理页面
        await pages.rentalManagement.goto();
        await expect(page.locator('h1').filter({ hasText: /租赁管理/ })).toBeVisible({ timeout: 10000 });

        // 验证列表显示
        await expect(page.locator('.ant-table-wrapper')).toBeVisible();

        // 创建租赁
        const rentalData = TestDataFactory.createRentalProperty();
        await pages.rentalManagement.createRental({
            propertyType: rentalData.propertyType,
            monthlyRent: String(rentalData.monthlyRentCents / 100)
        });

        // 验证成功
        await pages.rentalManagement.waitForMessage('success');
        expect(createdRental).toBeTruthy();
    });

    test('宿舍分配', async ({ page }) => {
        let createdAllocation: any = null;

        // Mock 宿舍分配 API
        await page.route('**/api/v2/dormitory-allocations*', async route => {
            const method = route.request().method();
            if (method === 'POST') {
                createdAllocation = route.request().postDataJSON();
                await route.fulfill({
                    json: {
                        id: 'dorm1',
                        ...createdAllocation,
                        allocatedAt: Date.now()
                    }
                });
            } else {
                await route.fulfill({ json: { results: [], total: 0 } });
            }
        });

        // Mock 租赁物业列表（宿舍）
        await page.route('**/api/v2/rental-properties*', async route => {
            await route.fulfill({
                json: {
                    results: [
                        {
                            id: 'rental1',
                            propertyType: 'dormitory',
                            monthlyRentCents: 200000
                        }
                    ],
                    total: 1
                }
            });
        });

        // Mock 员工列表
        await page.route('**/api/v2/employees*', async route => {
            await route.fulfill({
                json: {
                    results: [
                        { id: 'emp1', name: 'Test Employee', email: 'test@example.com' }
                    ],
                    total: 1
                }
            });
        });

        // 登录
        const pages = createPageObjects(page);
        await pages.login.login('admin@example.com', 'password');
        await pages.login.expectLoginSuccess();

        // 导航到租赁管理页面
        await pages.rentalManagement.goto();
        await expect(page.locator('h1').filter({ hasText: /租赁管理/ })).toBeVisible({ timeout: 10000 });

        // 创建宿舍分配（假设有分配按钮）
        await page.click('button:has-text("分配宿舍")');

        // 选择物业和员工
        await page.locator('#propertyId').locator('xpath=./ancestor::div[contains(@class, "ant-select-selector")]').click();
        await page.locator('.ant-select-item-option').first().click();

        await page.locator('#employeeId').locator('xpath=./ancestor::div[contains(@class, "ant-select-selector")]').click();
        await page.locator('.ant-select-item-option').filter({ hasText: 'Test Employee' }).click();

        // 提交
        await page.click('button:has-text("保存")');

        // 验证成功
        await expect(page.getByText('分配成功')).toBeVisible();
        expect(createdAllocation).toBeTruthy();
    });
});

