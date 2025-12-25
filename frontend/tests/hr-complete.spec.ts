import { test, expect } from './fixtures';
import { setupCommonMocks } from './utils/mock-api';
import { createPageObjects } from './utils/page-objects';
import { TestDataFactory } from './utils/test-data-factory';

test.describe('HR Complete', () => {
    test.beforeEach(async ({ page }) => {
        await setupCommonMocks(page);
    });

    test('补贴发放 - 查看列表', async ({ page }) => {
        // Mock 补贴发放列表 API
        await page.route('**/api/v2/allowance-payments*', async route => {
            await route.fulfill({
                json: {
                    results: [
                        {
                            id: 'allow1',
                            year: 2024,
                            month: 1,
                            employeeName: 'Test Employee',
                            amountCents: 10000,
                            paymentDate: '2024-01-15'
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

        // 导航到补贴发放页面
        await pages.allowancePayment.goto();
        await expect(page.locator('h1').filter({ hasText: /补贴/ })).toBeVisible({ timeout: 10000 });

        // 验证列表显示
        await expect(page.getByText('Test Employee')).toBeVisible();
    });

    test('补贴发放 - 创建补贴', async ({ page }) => {
        let createdPayment: any = null;

        // Mock 补贴发放 API
        await page.route('**/api/v2/allowance-payments*', async route => {
            const method = route.request().method();
            if (method === 'POST') {
                createdPayment = route.request().postDataJSON();
                await route.fulfill({
                    json: {
                        id: 'allow1',
                        ...createdPayment,
                        created_at: Date.now()
                    }
                });
            } else {
                await route.fulfill({ json: { results: [], total: 0 } });
            }
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

        // 导航到补贴发放页面
        await pages.allowancePayment.goto();
        await expect(page.locator('h1').filter({ hasText: /补贴/ })).toBeVisible({ timeout: 10000 });

        // 创建补贴（简化版本，实际可能需要选择员工）
        const today = new Date();
        await pages.allowancePayment.createPayment({
            year: String(today.getFullYear()),
            month: String(today.getMonth() + 1),
            employees: ['emp1']
        });

        // 验证成功
        await pages.allowancePayment.waitForMessage('success');
        expect(createdPayment).toBeTruthy();
    });

    test('请假管理 - 申请请假', async ({ page }) => {
        let createdLeave: any = null;

        // Mock 请假 API
        await page.route('**/api/v2/leaves*', async route => {
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

        // 导航到请假管理页面
        await pages.leaveManagement.goto();
        await expect(page.locator('h1').filter({ hasText: /请假/ })).toBeVisible({ timeout: 10000 });

        // 创建请假
        const leaveData = TestDataFactory.createLeave();
        await pages.leaveManagement.createLeave({
            employee: 'Test Employee',
            leaveType: leaveData.leaveType,
            startDate: leaveData.startDate,
            endDate: leaveData.endDate,
            reason: leaveData.reason
        });

        // 验证成功
        await pages.leaveManagement.waitForMessage('success');
        expect(createdLeave).toBeTruthy();
    });

    test('请假管理 - 查看列表', async ({ page }) => {
        // Mock 请假列表 API
        await page.route('**/api/v2/leaves*', async route => {
            await route.fulfill({
                json: {
                    results: [
                        {
                            id: 'leave1',
                            employeeName: 'Test Employee',
                            leaveType: 'annual',
                            startDate: '2024-01-01',
                            endDate: '2024-01-02',
                            status: 'pending'
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

        // 导航到请假管理页面
        await pages.leaveManagement.goto();
        await expect(page.locator('h1').filter({ hasText: /请假/ })).toBeVisible({ timeout: 10000 });

        // 验证列表显示
        await expect(page.getByText('Test Employee')).toBeVisible();
    });

    test('费用报销 - 申请报销', async ({ page }) => {
        let createdReimbursement: any = null;

        // Mock 报销 API
        await page.route('**/api/v2/reimbursements*', async route => {
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

        // 导航到报销页面
        await pages.expenseReimbursement.goto();
        await expect(page.locator('h1').filter({ hasText: /报销/ })).toBeVisible({ timeout: 10000 });

        // 创建报销
        const reimbursementData = TestDataFactory.createReimbursement();
        await pages.expenseReimbursement.createReimbursement({
            employee: 'Test Employee',
            expenseType: reimbursementData.expenseType,
            amount: String(reimbursementData.amountCents / 100),
            expenseDate: reimbursementData.expenseDate,
            description: reimbursementData.description
        });

        // 验证成功
        await pages.expenseReimbursement.waitForMessage('success');
        expect(createdReimbursement).toBeTruthy();
    });

    test('费用报销 - 查看列表', async ({ page }) => {
        // Mock 报销列表 API
        await page.route('**/api/v2/reimbursements*', async route => {
            await route.fulfill({
                json: {
                    results: [
                        {
                            id: 'reimb1',
                            employeeName: 'Test Employee',
                            expenseType: 'travel',
                            amountCents: 20000,
                            status: 'pending'
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

        // 导航到报销页面
        await pages.expenseReimbursement.goto();
        await expect(page.locator('h1').filter({ hasText: /报销/ })).toBeVisible({ timeout: 10000 });

        // 验证列表显示
        await expect(page.getByText('Test Employee')).toBeVisible();
    });

    test('员工薪资配置 - 编辑薪资标准', async ({ page }) => {
        // Mock 薪资配置 API
        await page.route('**/api/v2/employees/*/salary*', async route => {
            const method = route.request().method();
            if (method === 'PUT' || method === 'POST') {
                const body = route.request().postDataJSON();
                await route.fulfill({
                    json: {
                        id: 'salary1',
                        ...body,
                        updated_at: Date.now()
                    }
                });
            } else {
                await route.fulfill({
                    json: {
                        id: 'salary1',
                        employeeId: 'emp1',
                        salaryType: 'regular',
                        amountCents: 1000000
                    }
                });
            }
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

        // 导航到员工管理页面
        await pages.employee.gotoList();
        await expect(page.locator('h1').filter({ hasText: /人员管理/ })).toBeVisible({ timeout: 10000 });

        // 点击编辑薪资（假设有编辑按钮）
        // 根据实际页面实现调整
        const row = page.locator('tr').filter({ hasText: 'Test Employee' });
        await row.locator('button').filter({ hasText: /薪资/ }).click();

        // 填写薪资信息
        await page.fill('input#amountCents', '1200000');
        await page.click('button:has-text("保存")');

        // 验证成功
        await pages.employee.waitForMessage('success');
    });

    test('员工转正 - 试用期转正式', async ({ page }) => {
        let regularizeData: any = null;

        // Mock 员工列表 - 包含试用期员工
        await page.route('**/api/v2/employees*', async route => {
            await route.fulfill({
                json: {
                    results: [
                        {
                            id: 'emp-probation',
                            name: 'Probation Employee',
                            email: 'probation@example.com',
                            status: 'probation',
                            joinDate: '2024-01-01'
                        },
                        {
                            id: 'emp-regular',
                            name: 'Regular Employee',
                            email: 'regular@example.com',
                            status: 'regular',
                            joinDate: '2023-01-01',
                            regularDate: '2023-04-01'
                        }
                    ],
                    total: 2
                }
            });
        });

        // Mock 转正 API
        await page.route('**/api/v2/employees/emp-probation/regularize', async route => {
            regularizeData = route.request().postDataJSON();
            await route.fulfill({
                json: {
                    success: true,
                    data: { id: 'emp-probation' }
                }
            });
        });

        // 登录
        const pages = createPageObjects(page);
        await pages.login.login('admin@example.com', 'password');
        await pages.login.expectLoginSuccess();

        // 导航到员工管理页面
        await pages.employee.gotoList();
        await expect(page.locator('h1').filter({ hasText: /人员管理/ })).toBeVisible({ timeout: 10000 });

        // 验证试用期员工显示
        await expect(page.getByText('Probation Employee')).toBeVisible();

        // 点击转正按钮
        const probationRow = page.locator('tr', { hasText: 'Probation Employee' });
        await probationRow.locator('button').filter({ hasText: '转正' }).click();

        // 填写转正日期
        const modal = page.locator('.ant-modal-content:visible');
        await expect(modal).toBeVisible();

        // 填写转正日期（如果需要）
        const dateInput = modal.locator('input[type="text"]').first();
        if (await dateInput.isVisible()) {
            await dateInput.fill('2024-04-01');
        }

        // 确认转正
        await modal.locator('button.ant-btn-primary').click();

        // 验证成功消息
        await expect(page.getByText('转正成功').or(page.getByText('成功'))).toBeVisible({ timeout: 5000 });
    });

    test('员工离职 - 设置离职状态', async ({ page }) => {
        let leaveData: any = null;

        // Mock 员工列表
        await page.route('**/api/v2/employees*', async route => {
            await route.fulfill({
                json: {
                    results: [
                        {
                            id: 'emp-leaving',
                            name: 'Leaving Employee',
                            email: 'leaving@example.com',
                            status: 'regular',
                            active: 1
                        }
                    ],
                    total: 1
                }
            });
        });

        // Mock 离职 API
        await page.route('**/api/v2/employees/emp-leaving/leave', async route => {
            leaveData = route.request().postDataJSON();
            await route.fulfill({
                json: {
                    success: true,
                    data: { id: 'emp-leaving' }
                }
            });
        });

        // 登录
        const pages = createPageObjects(page);
        await pages.login.login('admin@example.com', 'password');
        await pages.login.expectLoginSuccess();

        // 导航到员工管理页面
        await pages.employee.gotoList();
        await expect(page.getByText('Leaving Employee')).toBeVisible({ timeout: 10000 });

        // 点击离职按钮
        const row = page.locator('tr', { hasText: 'Leaving Employee' });
        await row.locator('button').filter({ hasText: '离职' }).click();

        // 填写离职信息
        const modal = page.locator('.ant-modal-content:visible');
        await expect(modal).toBeVisible();

        // 填写离职原因（如果有）
        const reasonInput = modal.locator('textarea').or(modal.locator('input[id="reason"]'));
        if (await reasonInput.isVisible()) {
            await reasonInput.fill('个人原因');
        }

        // 确认离职
        await modal.locator('button').filter({ hasText: '确定' }).or(
            modal.locator('button.ant-btn-primary')
        ).click();

        // 验证成功
        await expect(page.getByText('离职成功').or(page.getByText('成功'))).toBeVisible({ timeout: 5000 });
    });
});
