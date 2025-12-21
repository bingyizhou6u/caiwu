import { test, expect } from './fixtures';
import { setupCommonMocks } from './utils/mock-api';
import { createPageObjects } from './utils/page-objects';
import { TestDataFactory } from './utils/test-data-factory';

test.describe('System Management', () => {
    test.beforeEach(async ({ page }) => {
        await setupCommonMocks(page);
    });

    test('部门管理 - CRUD操作', async ({ page }) => {
        let createdDepartment: any = null;

        // Mock 部门 API
        await page.route('**/api/v2/departments*', async route => {
            const method = route.request().method();
            const url = route.request().url();

            if (method === 'POST') {
                createdDepartment = route.request().postDataJSON();
                await route.fulfill({
                    json: {
                        id: 'dept-new',
                        ...createdDepartment,
                        created_at: Date.now()
                    }
                });
            } else if (method === 'PUT' && url.includes('/dept-edit')) {
                const body = route.request().postDataJSON();
                await route.fulfill({
                    json: {
                        id: 'dept-edit',
                        ...body,
                        updated_at: Date.now()
                    }
                });
            } else if (method === 'DELETE') {
                await route.fulfill({ json: { success: true } });
            } else {
                await route.fulfill({
                    json: {
                        results: [
                            { id: 'dept1', name: 'Sales Dept', hqId: 'hq1', active: 1 }
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

        // 导航到部门管理页面
        await pages.departmentManagement.goto();
        await expect(page.locator('h1').filter({ hasText: /部门管理/ })).toBeVisible({ timeout: 10000 });

        // 创建部门
        const deptData = TestDataFactory.createDepartment();
        await pages.departmentManagement.createDepartment({
            name: deptData.name,
            hqId: deptData.hqId
        });

        // 验证成功
        await pages.departmentManagement.waitForMessage('success');
        expect(createdDepartment).toBeTruthy();
    });

    test('分类管理 - 创建和编辑分类', async ({ page }) => {
        let createdCategory: any = null;

        // Mock 分类 API
        await page.route('**/api/v2/categories*', async route => {
            const method = route.request().method();
            if (method === 'POST') {
                createdCategory = route.request().postDataJSON();
                await route.fulfill({
                    json: {
                        id: 'cat-new',
                        ...createdCategory,
                        created_at: Date.now()
                    }
                });
            } else {
                await route.fulfill({
                    json: {
                        results: [
                            { id: 'cat1', name: 'Sales Income', kind: 'income', active: 1 }
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

        // 导航到分类管理页面
        await pages.categoryManagement.goto();
        await expect(page.locator('h1').filter({ hasText: /分类管理/ })).toBeVisible({ timeout: 10000 });

        // 创建分类
        const catData = TestDataFactory.createCategory();
        await pages.categoryManagement.createCategory({
            name: catData.name,
            kind: catData.kind
        });

        // 验证成功
        await pages.categoryManagement.waitForMessage('success');
        expect(createdCategory).toBeTruthy();
    });

    test('账户管理 - 创建和编辑账户', async ({ page }) => {
        let createdAccount: any = null;

        // Mock 账户 API
        await page.route('**/api/v2/accounts*', async route => {
            const method = route.request().method();
            if (method === 'POST') {
                createdAccount = route.request().postDataJSON();
                await route.fulfill({
                    json: {
                        id: 'acc-new',
                        ...createdAccount,
                        created_at: Date.now()
                    }
                });
            } else {
                await route.fulfill({
                    json: {
                        results: [
                            { id: 'acc1', name: 'Bank Account', type: 'bank', currency: 'CNY', active: 1 }
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

        // 导航到账户管理页面
        await pages.accountManagement.goto();
        await expect(page.locator('h1').filter({ hasText: /账户管理/ })).toBeVisible({ timeout: 10000 });

        // 创建账户
        const accData = TestDataFactory.createAccount();
        await pages.accountManagement.createAccount({
            name: accData.name,
            type: accData.type,
            currency: accData.currency
        });

        // 验证成功
        await pages.accountManagement.waitForMessage('success');
        expect(createdAccount).toBeTruthy();
    });

    test('货币管理 - 查看和编辑汇率', async ({ page }) => {
        // Mock 货币 API
        await page.route('**/api/v2/currencies/*', async route => {
            const method = route.request().method();
            if (method === 'PUT') {
                const body = route.request().postDataJSON();
                await route.fulfill({
                    json: {
                        id: 'curr1',
                        ...body,
                        updated_at: Date.now()
                    }
                });
            } else {
                await route.fulfill({
                    json: {
                        id: 'curr1',
                        code: 'USD',
                        name: 'US Dollar',
                        rate: 7,
                        active: 1
                    }
                });
            }
        });

        // 登录
        const pages = createPageObjects(page);
        await pages.login.login('admin@example.com', 'password');
        await pages.login.expectLoginSuccess();

        // 导航到货币管理页面
        await pages.currencyManagement.goto();
        await expect(page.locator('h1').filter({ hasText: /货币管理/ })).toBeVisible({ timeout: 10000 });

        // 编辑汇率
        await pages.currencyManagement.editRate('USD', '7.5');

        // 验证成功
        await pages.currencyManagement.waitForMessage('success');
    });

    test('供应商管理 - CRUD操作', async ({ page }) => {
        let createdVendor: any = null;

        // Mock 供应商 API
        await page.route('**/api/v2/vendors*', async route => {
            const method = route.request().method();
            if (method === 'POST') {
                createdVendor = route.request().postDataJSON();
                await route.fulfill({
                    json: {
                        id: 'vendor-new',
                        ...createdVendor,
                        created_at: Date.now()
                    }
                });
            } else {
                await route.fulfill({
                    json: {
                        results: [
                            { id: 'vendor1', name: 'Vendor A', contact: 'contact@example.com', active: 1 }
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

        // 导航到供应商管理页面
        await pages.vendorManagement.goto();
        await expect(page.locator('h1').filter({ hasText: /供应商管理/ })).toBeVisible({ timeout: 10000 });

        // 创建供应商
        const vendorData = TestDataFactory.createVendor();
        await pages.vendorManagement.createVendor({
            name: vendorData.name,
            contact: vendorData.contact
        });

        // 验证成功
        await pages.vendorManagement.waitForMessage('success');
        expect(createdVendor).toBeTruthy();
    });

    test('审计日志 - 查看日志和筛选', async ({ page }) => {
        // Mock 审计日志 API
        await page.route('**/api/v2/audit-logs*', async route => {
            await route.fulfill({
                json: {
                    results: [
                        {
                            id: 'log1',
                            action: 'create',
                            resource: 'employee',
                            resourceId: 'emp1',
                            userId: '1',
                            userName: 'Admin',
                            createdAt: Date.now(),
                            details: { name: 'Test Employee' }
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

        // 导航到审计日志页面
        await pages.auditLogs.goto();
        await expect(page.locator('h1').filter({ hasText: /审计日志/ })).toBeVisible({ timeout: 10000 });

        // 验证日志列表显示
        await expect(page.getByText('Admin')).toBeVisible();

        // 筛选
        await pages.auditLogs.filterByAction('create');
        await pages.auditLogs.filterByDateRange('2024-01-01', '2024-12-31');
    });
});

