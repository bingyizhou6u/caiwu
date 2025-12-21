import { test, expect } from './fixtures';
import { setupCommonMocks } from './utils/mock-api';
import { createPageObjects } from './utils/page-objects';

test.describe('Import Functionality', () => {
    test.beforeEach(async ({ page }) => {
        await setupCommonMocks(page);
    });

    test('CSV导入 - 上传文件和验证格式', async ({ page }) => {
        let uploadedFile: any = null;

        // Mock 导入 API
        await page.route('**/api/v2/import/csv*', async route => {
            const method = route.request().method();
            if (method === 'POST') {
                // 获取上传的文件
                const formData = route.request().postData();
                uploadedFile = formData;
                await route.fulfill({
                    json: {
                        success: true,
                        message: '导入成功',
                        imported: 10,
                        failed: 0,
                        errors: []
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

        // 导航到导入中心
        await page.goto('http://localhost:5173/finance/import');
        await expect(page.locator('h1').filter({ hasText: /导入/ })).toBeVisible({ timeout: 10000 });

        // 创建 CSV 文件内容
        const csvContent = `日期,账户,分类,金额,备注
2024-01-01,Bank Account,Sales Income,1000,Test income
2024-01-02,Bank Account,Office Expense,500,Test expense`;

        // 上传文件
        await page.setInputFiles('input[type="file"]', {
            name: 'test-import.csv',
            mimeType: 'text/csv',
            buffer: Buffer.from(csvContent)
        });

        // 等待文件上传完成
        await page.waitForTimeout(500);

        // 提交导入
        await page.click('button:has-text("开始导入")');

        // 验证成功
        await expect(page.getByText('导入成功')).toBeVisible();
    });

    test('CSV导入 - 格式验证错误', async ({ page }) => {
        // Mock 导入 API - 返回格式错误
        await page.route('**/api/v2/import/csv*', async route => {
            await route.fulfill({
                status: 400,
                json: {
                    success: false,
                    error: 'CSV格式错误：缺少必需的列',
                    errors: [
                        { row: 1, column: 'account', message: '账户列不能为空' }
                    ]
                }
            });
        });

        // 登录
        const pages = createPageObjects(page);
        await pages.login.login('admin@example.com', 'password');
        await pages.login.expectLoginSuccess();

        // 导航到导入中心
        await page.goto('http://localhost:5173/finance/import');
        await expect(page.locator('h1').filter({ hasText: /导入/ })).toBeVisible({ timeout: 10000 });

        // 上传格式错误的 CSV
        const invalidCsv = `日期,金额
2024-01-01,1000`;

        await page.setInputFiles('input[type="file"]', {
            name: 'invalid.csv',
            mimeType: 'text/csv',
            buffer: Buffer.from(invalidCsv)
        });

        await page.waitForTimeout(500);

        // 提交导入
        await page.click('button:has-text("开始导入")');

        // 验证错误信息
        await expect(page.getByText('CSV格式错误')).toBeVisible();
    });

    test('导入结果查看', async ({ page }) => {
        // Mock 导入历史 API
        await page.route('**/api/v2/import/history*', async route => {
            await route.fulfill({
                json: {
                    results: [
                        {
                            id: 'import1',
                            fileName: 'test-import.csv',
                            imported: 10,
                            failed: 0,
                            createdAt: Date.now(),
                            status: 'completed'
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

        // 导航到导入中心
        await page.goto('http://localhost:5173/finance/import');
        await expect(page.locator('h1').filter({ hasText: /导入/ })).toBeVisible({ timeout: 10000 });

        // 切换到历史记录标签（如果有）
        // 根据实际页面实现调整

        // 验证历史记录显示
        await expect(page.getByText('test-import.csv')).toBeVisible();
        await expect(page.getByText('10')).toBeVisible(); // 导入数量
    });

    test('导入结果 - 查看错误详情', async ({ page }) => {
        // Mock 导入详情 API
        await page.route('**/api/v2/import/*/details*', async route => {
            await route.fulfill({
                json: {
                    id: 'import1',
                    fileName: 'test-import.csv',
                    imported: 8,
                    failed: 2,
                    errors: [
                        { row: 3, message: '账户不存在' },
                        { row: 5, message: '金额格式错误' }
                    ],
                    createdAt: Date.now()
                }
            });
        });

        // Mock 导入历史 API
        await page.route('**/api/v2/import/history*', async route => {
            await route.fulfill({
                json: {
                    results: [
                        {
                            id: 'import1',
                            fileName: 'test-import.csv',
                            imported: 8,
                            failed: 2,
                            status: 'completed'
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

        // 导航到导入中心
        await page.goto('http://localhost:5173/finance/import');
        await expect(page.locator('h1').filter({ hasText: /导入/ })).toBeVisible({ timeout: 10000 });

        // 点击查看详情（假设有详情按钮）
        const row = page.locator('tr').filter({ hasText: 'test-import.csv' });
        await row.locator('button').filter({ hasText: /详情/ }).click();

        // 验证错误详情显示
        await expect(page.getByText('账户不存在')).toBeVisible();
        await expect(page.getByText('金额格式错误')).toBeVisible();
    });
});

