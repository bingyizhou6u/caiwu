import { test, expect } from './fixtures';
import { setupCommonMocks } from './utils/mock-api';
import { createPageObjects } from './utils/page-objects';
import { TestDataFactory } from './utils/test-data-factory';

test.describe('My Center Complete', () => {
    test.beforeEach(async ({ page }) => {
        await setupCommonMocks(page);
    });

    test('我的中心 - 查看个人信息和时间线', async ({ page }) => {
        // Mock 我的中心 API
        await page.route('**/api/v2/my/center*', async route => {
            await route.fulfill({
                json: {
                    employee: {
                        id: '1',
                        name: 'Test User',
                        email: 'test@example.com',
                        phone: '13800000000',
                        position: { name: 'Engineer', code: 'engineer' },
                        department: { name: 'Tech', id: 'dept1' }
                    },
                    timeline: [
                        {
                            id: 'tl1',
                            type: 'leave',
                            title: '请假申请',
                            date: '2024-01-15',
                            status: 'approved'
                        }
                    ]
                }
            });
        });

        // 登录
        const pages = createPageObjects(page);
        await pages.login.login('admin@example.com', 'password');
        await pages.login.expectLoginSuccess();

        // 导航到我的中心
        await pages.myCenter.goto();
        await expect(page.locator('h1').filter({ hasText: /个人中心/ })).toBeVisible({ timeout: 10000 });

        // 验证个人信息显示
        await pages.myCenter.expectPersonalInfo();
        await expect(page.getByText('Test User')).toBeVisible();

        // 验证时间线显示
        await pages.myCenter.expectTimeline();
        await expect(page.getByText('请假申请')).toBeVisible();
    });

    test('我的请假 - 申请请假', async ({ page }) => {
        let createdLeave: any = null;

        // Mock 请假 API
        await page.route('**/api/v2/my/leaves*', async route => {
            const method = route.request().method();
            if (method === 'POST') {
                createdLeave = route.request().postDataJSON();
                await route.fulfill({
                    json: {
                        id: 'leave1',
                        ...createdLeave,
                        status: 'pending',
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

        // 导航到我的请假页面
        await pages.myLeaves.goto();
        await expect(page.locator('h1').filter({ hasText: /我的请假/ })).toBeVisible({ timeout: 10000 });

        // 申请请假
        const leaveData = TestDataFactory.createLeave();
        await pages.myLeaves.createLeave({
            leaveType: leaveData.leaveType,
            startDate: leaveData.startDate,
            endDate: leaveData.endDate,
            reason: leaveData.reason
        });

        // 验证成功
        await pages.myLeaves.waitForMessage('success');
        expect(createdLeave).toBeTruthy();
    });

    test('我的请假 - 查看历史', async ({ page }) => {
        // Mock 请假历史 API
        await page.route('**/api/v2/my/leaves*', async route => {
            await route.fulfill({
                json: {
                    results: [
                        {
                            id: 'leave1',
                            leaveType: 'annual',
                            startDate: '2024-01-01',
                            endDate: '2024-01-02',
                            status: 'approved',
                            reason: 'Vacation'
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

        // 导航到我的请假页面
        await pages.myLeaves.goto();
        await expect(page.locator('h1').filter({ hasText: /我的请假/ })).toBeVisible({ timeout: 10000 });

        // 验证历史记录显示
        await expect(page.getByText('Vacation')).toBeVisible();
    });

    test('我的报销 - 申请报销', async ({ page }) => {
        let createdReimbursement: any = null;

        // Mock 报销 API
        await page.route('**/api/v2/my/reimbursements*', async route => {
            const method = route.request().method();
            if (method === 'POST') {
                createdReimbursement = route.request().postDataJSON();
                await route.fulfill({
                    json: {
                        id: 'reimb1',
                        ...createdReimbursement,
                        status: 'pending',
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

        // 导航到我的报销页面
        await pages.myReimbursements.goto();
        await expect(page.locator('h1').filter({ hasText: /我的报销/ })).toBeVisible({ timeout: 10000 });

        // 申请报销
        const reimbursementData = TestDataFactory.createReimbursement();
        await pages.myReimbursements.createReimbursement({
            expenseType: reimbursementData.expenseType,
            amount: String(reimbursementData.amountCents / 100),
            expenseDate: reimbursementData.expenseDate,
            description: reimbursementData.description
        });

        // 验证成功
        await pages.myReimbursements.waitForMessage('success');
        expect(createdReimbursement).toBeTruthy();
    });

    test('我的报销 - 查看状态', async ({ page }) => {
        // Mock 报销列表 API
        await page.route('**/api/v2/my/reimbursements*', async route => {
            await route.fulfill({
                json: {
                    results: [
                        {
                            id: 'reimb1',
                            expenseType: 'travel',
                            amountCents: 20000,
                            status: 'pending',
                            description: 'Business trip'
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

        // 导航到我的报销页面
        await pages.myReimbursements.goto();
        await expect(page.locator('h1').filter({ hasText: /我的报销/ })).toBeVisible({ timeout: 10000 });

        // 验证状态显示
        await expect(page.getByText('Business trip')).toBeVisible();
        await expect(page.getByText('pending')).toBeVisible();
    });

    test('我的资产 - 查看分配的资产', async ({ page }) => {
        // Mock 我的资产 API
        await page.route('**/api/v2/my/assets*', async route => {
            await route.fulfill({
                json: {
                    results: [
                        {
                            id: 'asset1',
                            assetCode: 'FA-001',
                            name: 'Laptop',
                            status: 'in_use',
                            allocatedAt: '2024-01-01'
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

        // 导航到我的资产页面
        await pages.myAssets.goto();
        await expect(page.locator('h1').filter({ hasText: /我的资产/ })).toBeVisible({ timeout: 10000 });

        // 验证资产列表显示
        await pages.myAssets.expectAssetList();
        await expect(page.getByText('Laptop')).toBeVisible();
    });
});

