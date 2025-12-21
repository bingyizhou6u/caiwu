import { test, expect } from './fixtures';
import { setupCommonMocks } from './utils/mock-api';
import { createPageObjects } from './utils/page-objects';

test.describe('Error Handling and Edge Cases', () => {
    test.beforeEach(async ({ page }) => {
        await setupCommonMocks(page);
    });

    test('网络错误处理', async ({ page }) => {
        // Mock 网络错误
        await page.route('**/api/v2/employees*', async route => {
            await route.abort('failed');
        });

        // 登录
        const pages = createPageObjects(page);
        await pages.login.login('admin@example.com', 'password');
        await pages.login.expectLoginSuccess();

        // 导航到员工管理页面
        await pages.employee.gotoList();
        await expect(page.locator('h1').filter({ hasText: /人员管理/ })).toBeVisible({ timeout: 10000 });

        // 验证错误提示显示
        await expect(page.getByText(/网络错误|加载失败/)).toBeVisible({ timeout: 5000 });
    });

    test('表单验证错误', async ({ page }) => {
        // 登录
        const pages = createPageObjects(page);
        await pages.login.login('admin@example.com', 'password');
        await pages.login.expectLoginSuccess();

        // 导航到员工管理页面
        await pages.employee.gotoList();
        await expect(page.locator('h1').filter({ hasText: /人员管理/ })).toBeVisible({ timeout: 10000 });

        // 打开创建员工表单
        await page.click('button:has-text("新建员工")');
        await expect(page.locator('.ant-modal-title').filter({ hasText: '新建员工' })).toBeVisible();

        // 尝试提交空表单
        await page.click('button:has-text("保存")');

        // 验证表单验证错误
        await expect(page.locator('.ant-form-item-explain-error').first()).toBeVisible();
    });

    test('权限不足提示', async ({ page }) => {
        // Mock 权限不足的响应
        await page.route('**/api/v2/employees*', async route => {
            await route.fulfill({
                status: 403,
                json: {
                    error: '权限不足',
                    code: 'FORBIDDEN'
                }
            });
        });

        // Mock 用户权限（无员工管理权限）
        await page.route('**/api/v2/auth/current', async route => {
            await route.fulfill({
                json: {
                    user: {
                        id: '1',
                        name: 'Test User',
                        email: 'test@example.com',
                        position: {
                            permissions: {
                                finance: {
                                    flow: ['view']
                                }
                            }
                        }
                    }
                }
            });
        });

        // 登录
        const pages = createPageObjects(page);
        await pages.login.login('admin@example.com', 'password');
        await pages.login.expectLoginSuccess();

        // 尝试访问员工管理页面
        await pages.employee.gotoList();

        // 验证权限不足提示
        await expect(page.getByText(/权限不足|无权限访问/)).toBeVisible({ timeout: 5000 });
    });

    test('数据为空状态', async ({ page }) => {
        // Mock 空数据响应
        await page.route('**/api/v2/employees*', async route => {
            await route.fulfill({
                json: {
                    results: [],
                    total: 0
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

        // 验证空状态显示
        await expect(page.getByText(/暂无数据|没有数据/)).toBeVisible({ timeout: 5000 });
    });

    test('服务器错误处理', async ({ page }) => {
        // Mock 500错误
        await page.route('**/api/v2/employees*', async route => {
            await route.fulfill({
                status: 500,
                json: {
                    error: '服务器内部错误',
                    code: 'INTERNAL_ERROR'
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

        // 验证错误提示
        await expect(page.getByText(/服务器错误|系统错误/)).toBeVisible({ timeout: 5000 });
    });

    test('请求超时处理', async ({ page }) => {
        // Mock 超时响应
        await page.route('**/api/v2/employees*', async route => {
            await page.waitForTimeout(10000); // 模拟超时
            await route.fulfill({
                json: { results: [], total: 0 }
            });
        });

        // 登录
        const pages = createPageObjects(page);
        await pages.login.login('admin@example.com', 'password');
        await pages.login.expectLoginSuccess();

        // 导航到员工管理页面（设置较短的超时）
        await pages.employee.gotoList();
        
        // 验证加载状态或超时提示
        // 根据实际实现调整
    });

    test('表单提交后防止重复提交', async ({ page }) => {
        let submitCount = 0;

        // Mock API - 记录提交次数
        await page.route('**/api/v2/employees', async route => {
            if (route.request().method() === 'POST') {
                submitCount++;
                await page.waitForTimeout(1000); // 模拟网络延迟
                await route.fulfill({
                    json: {
                        id: 'emp-new',
                        name: 'Test Employee',
                        email: 'test@example.com'
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

        // 导航到员工管理页面
        await pages.employee.gotoList();
        await expect(page.locator('h1').filter({ hasText: /人员管理/ })).toBeVisible({ timeout: 10000 });

        // 打开创建表单
        await page.click('button:has-text("新建员工")');
        await expect(page.locator('.ant-modal-title').filter({ hasText: '新建员工' })).toBeVisible();

        // 填写表单
        await page.fill('input#name', 'Test Employee');
        await page.fill('input#email', 'test@example.com');

        // 快速点击提交按钮多次
        const submitButton = page.locator('button:has-text("保存")');
        await submitButton.click();
        await submitButton.click();
        await submitButton.click();

        // 等待请求完成
        await page.waitForTimeout(2000);

        // 验证只提交了一次
        expect(submitCount).toBe(1);
    });

    test('分页加载错误处理', async ({ page }) => {
        // Mock 第一页成功，第二页失败
        let pageNum = 1;
        await page.route('**/api/v2/employees*', async route => {
            const url = new URL(route.request().url());
            const currentPage = parseInt(url.searchParams.get('page') || '1');

            if (currentPage === 1) {
                await route.fulfill({
                    json: {
                        results: Array(10).fill(null).map((_, i) => ({
                            id: `emp${i}`,
                            name: `Employee ${i}`,
                            email: `emp${i}@example.com`
                        })),
                        total: 20
                    }
                });
            } else {
                await route.fulfill({
                    status: 500,
                    json: {
                        error: '加载失败',
                        code: 'LOAD_ERROR'
                    }
                });
            }
        });

        // 登录
        const pages = createPageObjects(page);
        await pages.login.login('admin@example.com', 'password');
        await pages.login.expectLoginSuccess();

        // 导航到员工管理页面
        await pages.employee.gotoList();
        await expect(page.locator('h1').filter({ hasText: /人员管理/ })).toBeVisible({ timeout: 10000 });

        // 验证第一页数据
        await expect(page.getByText('Employee 0')).toBeVisible();

        // 点击下一页
        await page.click('.ant-pagination-next');

        // 验证错误提示
        await expect(page.getByText(/加载失败/)).toBeVisible({ timeout: 5000 });
    });

    test('数据删除确认和错误处理', async ({ page }) => {
        // Mock 删除API
        await page.route('**/api/v2/employees/*', async route => {
            if (route.request().method() === 'DELETE') {
                await route.fulfill({
                    json: {
                        success: true,
                        message: '删除成功'
                    }
                });
            }
        });

        // Mock 员工列表
        await page.route('**/api/v2/employees*', async route => {
            await route.fulfill({
                json: {
                    results: [
                        {
                            id: 'emp1',
                            name: 'Test Employee',
                            email: 'test@example.com'
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

        // 导航到员工管理页面
        await pages.employee.gotoList();
        await expect(page.locator('h1').filter({ hasText: /人员管理/ })).toBeVisible({ timeout: 10000 });

        // 点击删除按钮
        const row = page.locator('tr').filter({ hasText: 'Test Employee' });
        await row.locator('button').filter({ hasText: /删除/ }).click();

        // 确认删除对话框
        await expect(page.locator('.ant-modal-confirm')).toBeVisible();
        await page.click('.ant-modal-confirm .ant-btn-primary');

        // 验证成功提示
        await expect(page.getByText('删除成功')).toBeVisible();
    });

    test('数据编辑冲突处理', async ({ page }) => {
        // Mock 编辑冲突（版本号不匹配）
        await page.route('**/api/v2/employees/*', async route => {
            if (route.request().method() === 'PUT') {
                await route.fulfill({
                    status: 409,
                    json: {
                        error: '数据已被修改，请刷新后重试',
                        code: 'CONFLICT'
                    }
                });
            } else {
                await route.fulfill({
                    json: {
                        id: 'emp1',
                        name: 'Test Employee',
                        email: 'test@example.com',
                        version: 1
                    }
                });
            }
        });

        // Mock 员工列表
        await page.route('**/api/v2/employees*', async route => {
            await route.fulfill({
                json: {
                    results: [
                        {
                            id: 'emp1',
                            name: 'Test Employee',
                            email: 'test@example.com'
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

        // 导航到员工管理页面
        await pages.employee.gotoList();
        await expect(page.locator('h1').filter({ hasText: /人员管理/ })).toBeVisible({ timeout: 10000 });

        // 点击编辑
        const row = page.locator('tr').filter({ hasText: 'Test Employee' });
        await row.locator('button').filter({ hasText: /编辑/ }).click();

        // 修改数据
        await page.fill('input#name', 'Updated Employee');

        // 提交
        await page.click('button:has-text("保存")');

        // 验证冲突错误提示
        await expect(page.getByText(/数据已被修改|请刷新后重试/)).toBeVisible({ timeout: 5000 });
    });
});

