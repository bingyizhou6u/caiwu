import { test, expect } from './fixtures';
import { setupCommonMocks } from './utils/mock-api';
import { createPageObjects } from './utils/page-objects';

test.describe('Permissions and Configuration', () => {
    test.beforeEach(async ({ page }) => {
        await setupCommonMocks(page);
    });

    test('职位权限配置', async ({ page }) => {
        let updatedPermissions: any = null;

        // Mock 职位权限 API
        await page.route('**/api/v2/positions/*/permissions*', async route => {
            const method = route.request().method();
            if (method === 'PUT') {
                updatedPermissions = route.request().postDataJSON();
                await route.fulfill({
                    json: {
                        success: true,
                        message: '权限更新成功'
                    }
                });
            } else {
                await route.fulfill({
                    json: {
                        id: 'pos1',
                        code: 'engineer',
                        name: 'Engineer',
                        permissions: {
                            hr: {
                                employee: ['view']
                            },
                            finance: {
                                flow: ['view']
                            }
                        }
                    }
                });
            }
        });

        // Mock 职位列表
        await page.route('**/api/v2/positions*', async route => {
            await route.fulfill({
                json: {
                    results: [
                        {
                            id: 'pos1',
                            code: 'engineer',
                            name: 'Engineer',
                            level: 5
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

        // 导航到职位权限管理页面
        await page.goto('http://localhost:5173/system/permissions');
        await expect(page.locator('h1').filter({ hasText: /职位权限/ })).toBeVisible({ timeout: 10000 });

        // 选择职位
        await page.locator('#positionId').locator('xpath=./ancestor::div[contains(@class, "ant-select-selector")]').click();
        await page.locator('.ant-select-item-option').filter({ hasText: 'Engineer' }).click();

        // 修改权限（假设有权限复选框）
        await page.check('input[value="hr.employee.create"]');
        await page.check('input[value="finance.flow.create"]');

        // 保存
        await page.click('button:has-text("保存")');

        // 验证成功
        await expect(page.getByText('权限更新成功')).toBeVisible();
        expect(updatedPermissions).toBeTruthy();
    });

    test('IP白名单管理', async ({ page }) => {
        let addedIP: any = null;

        // Mock IP白名单 API
        await page.route('**/api/v2/system/ip-whitelist*', async route => {
            const method = route.request().method();
            if (method === 'POST') {
                addedIP = route.request().postDataJSON();
                await route.fulfill({
                    json: {
                        success: true,
                        message: 'IP添加成功',
                        id: 'ip1',
                        ...addedIP
                    }
                });
            } else {
                await route.fulfill({
                    json: {
                        results: [
                            {
                                id: 'ip1',
                                ip: '192.168.1.1',
                                description: 'Office IP',
                                createdAt: Date.now()
                            }
                        ],
                        total: 1,
                        enabled: true
                    }
                });
            }
        });

        // 登录
        const pages = createPageObjects(page);
        await pages.login.login('admin@example.com', 'password');
        await pages.login.expectLoginSuccess();

        // 导航到IP白名单管理页面
        await page.goto('http://localhost:5173/system/ip-whitelist');
        await expect(page.locator('h1').filter({ hasText: /IP白名单/ })).toBeVisible({ timeout: 10000 });

        // 验证列表显示
        await expect(page.getByText('192.168.1.1')).toBeVisible();

        // 添加IP
        await page.click('button:has-text("添加IP")');

        const modal = page.locator('.ant-modal-content:visible');
        await modal.locator('input#ip').fill('192.168.1.100');
        await modal.locator('input#description').fill('New Office IP');

        await modal.locator('button:has-text("保存")').click();

        // 验证成功
        await expect(page.getByText('IP添加成功')).toBeVisible();
        expect(addedIP).toBeTruthy();
    });

    test('IP白名单 - 启用/禁用', async ({ page }) => {
        // Mock IP白名单开关 API
        await page.route('**/api/v2/system/ip-whitelist/toggle*', async route => {
            const method = route.request().method();
            if (method === 'POST') {
                const body = route.request().postDataJSON();
                await route.fulfill({
                    json: {
                        success: true,
                        enabled: body.enabled,
                        message: body.enabled ? 'IP白名单已启用' : 'IP白名单已禁用'
                    }
                });
            }
        });

        // Mock IP白名单状态
        await page.route('**/api/v2/system/ip-whitelist*', async route => {
            await route.fulfill({
                json: {
                    results: [],
                    total: 0,
                    enabled: true
                }
            });
        });

        // 登录
        const pages = createPageObjects(page);
        await pages.login.login('admin@example.com', 'password');
        await pages.login.expectLoginSuccess();

        // 导航到IP白名单管理页面
        await page.goto('http://localhost:5173/system/ip-whitelist');
        await expect(page.locator('h1').filter({ hasText: /IP白名单/ })).toBeVisible({ timeout: 10000 });

        // 切换开关
        await page.click('button:has-text("禁用")');

        // 验证成功
        await expect(page.getByText('IP白名单已禁用')).toBeVisible();
    });

    test('邮件通知设置', async ({ page }) => {
        let updatedSettings: any = null;

        // Mock 邮件设置 API
        await page.route('**/api/v2/system/email-settings*', async route => {
            const method = route.request().method();
            if (method === 'PUT' || method === 'POST') {
                updatedSettings = route.request().postDataJSON();
                await route.fulfill({
                    json: {
                        success: true,
                        message: '设置保存成功',
                        ...updatedSettings
                    }
                });
            } else {
                await route.fulfill({
                    json: {
                        enabled: true,
                        smtpHost: 'smtp.example.com',
                        smtpPort: 587,
                        smtpUser: 'noreply@example.com',
                        fromEmail: 'noreply@example.com',
                        fromName: 'AR公司财务系统'
                    }
                });
            }
        });

        // 登录
        const pages = createPageObjects(page);
        await pages.login.login('admin@example.com', 'password');
        await pages.login.expectLoginSuccess();

        // 导航到邮件通知设置页面
        await page.goto('http://localhost:5173/system/email');
        await expect(page.locator('h1').filter({ hasText: /邮件通知/ })).toBeVisible({ timeout: 10000 });

        // 修改设置
        await page.fill('input#smtpHost', 'smtp.newhost.com');
        await page.fill('input#smtpPort', '465');
        await page.fill('input#fromEmail', 'newemail@example.com');

        // 保存
        await page.click('button:has-text("保存")');

        // 验证成功
        await expect(page.getByText('设置保存成功')).toBeVisible();
        expect(updatedSettings).toBeTruthy();
    });

    test('邮件通知设置 - 测试发送', async ({ page }) => {
        // Mock 测试邮件 API
        await page.route('**/api/v2/system/email-settings/test*', async route => {
            await route.fulfill({
                json: {
                    success: true,
                    message: '测试邮件发送成功'
                }
            });
        });

        // Mock 邮件设置
        await page.route('**/api/v2/system/email-settings*', async route => {
            await route.fulfill({
                json: {
                    enabled: true,
                    smtpHost: 'smtp.example.com',
                    smtpPort: 587
                }
            });
        });

        // 登录
        const pages = createPageObjects(page);
        await pages.login.login('admin@example.com', 'password');
        await pages.login.expectLoginSuccess();

        // 导航到邮件通知设置页面
        await page.goto('http://localhost:5173/system/email');
        await expect(page.locator('h1').filter({ hasText: /邮件通知/ })).toBeVisible({ timeout: 10000 });

        // 填写测试邮箱
        await page.fill('input#testEmail', 'test@example.com');

        // 点击测试发送
        await page.click('button:has-text("发送测试邮件")');

        // 验证成功
        await expect(page.getByText('测试邮件发送成功')).toBeVisible();
    });
});

