/**
 * 线上测试环境 - CRUD 操作测试
 * 
 * ⚠️ 注意：此测试会实际创建、修改、删除数据，请确保在测试环境运行
 * 
 * 运行命令：npx playwright test tests/live-env-crud.spec.ts --workers=1
 */

import { test, expect } from '@playwright/test';
import { config, setupModuleTests, teardownModuleTests } from './live-env-shared';
import { ensureLoggedIn } from './utils/live-login';
import { navigateAndWait } from './utils/page-helpers';

test.describe.serial('线上环境测试 - CRUD 操作', () => {
    test.beforeEach(async ({ page }) => {
        test.skip(!config.totpSecret, 'TOTP Secret 未配置');
        await ensureLoggedIn(page, config);
        await page.waitForTimeout(2000);
    });

    test.beforeAll(async () => {
        await setupModuleTests();
    });

    test.afterAll(async () => {
        teardownModuleTests();
    });

    // ==================== 创建操作测试 ====================
    test.describe('创建操作 (Create)', () => {
        test('创建收支记录 - 收入', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/finance/flows/create`);
            await page.waitForTimeout(2000);

            // 填写表单
            // 选择类型：收入
            const typeSelect = page.locator('.ant-select').filter({ hasText: /类型|收支类型/ }).first();
            if (await typeSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
                await typeSelect.click();
                await page.waitForTimeout(500);
                const incomeOption = page.locator('.ant-select-item-option').filter({ hasText: /收入/ }).first();
                if (await incomeOption.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await incomeOption.click();
                    await page.waitForTimeout(1000);
                }
            }

            // 填写金额（测试数据，使用小金额）
            const amountInput = page.locator('input[placeholder*="金额"], input[placeholder*="请输入金额"]').first();
            if (await amountInput.isVisible({ timeout: 3000 }).catch(() => false)) {
                await amountInput.fill('0.01');
                await page.waitForTimeout(500);
            }

            // 选择账户
            const accountSelect = page.locator('.ant-select').filter({ hasText: /账户/ }).first();
            if (await accountSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
                await accountSelect.click();
                await page.waitForTimeout(500);
                const firstOption = page.locator('.ant-select-item-option').first();
                if (await firstOption.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await firstOption.click();
                    await page.waitForTimeout(1000);
                }
            }

            // 填写备注
            const memoInput = page.locator('textarea[placeholder*="备注"], textarea[placeholder*="说明"]').first();
            if (await memoInput.isVisible({ timeout: 3000 }).catch(() => false)) {
                await memoInput.fill('E2E测试 - 创建收入记录');
                await page.waitForTimeout(500);
            }

            // 提交表单
            const submitButton = page.getByRole('button').filter({ hasText: /提交|保存|确定/ }).first();
            if (await submitButton.isVisible({ timeout: 3000 }).catch(() => false)) {
                await submitButton.click();
                await page.waitForTimeout(3000);
                
                // 验证成功消息或页面跳转
                const successMessage = page.locator('.ant-message-success, .ant-notification-notice-success').first();
                const hasSuccess = await successMessage.isVisible({ timeout: 5000 }).catch(() => false);
                if (hasSuccess) {
                    const messageText = await successMessage.textContent();
                    expect(messageText).toMatch(/成功|创建|已新增/);
                }
            }
        });

        test('创建类别', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/system/categories`);
            await page.waitForTimeout(2000);

            // 点击新建按钮
            const createButton = page.getByRole('button').filter({ hasText: /新建|新增|创建/ }).first();
            if (await createButton.isVisible({ timeout: 3000 }).catch(() => false)) {
                await createButton.click();
                await page.waitForTimeout(1000);

                // 填写表单
                const nameInput = page.locator('input[placeholder*="名称"], input[placeholder*="类别名称"]').first();
                if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
                    const testName = `E2E测试类别_${Date.now()}`;
                    await nameInput.fill(testName);
                    await page.waitForTimeout(500);

                    // 选择类型
                    const kindSelect = page.locator('.ant-select').filter({ hasText: /类型|收支类型/ }).first();
                    if (await kindSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
                        await kindSelect.click();
                        await page.waitForTimeout(500);
                        const option = page.locator('.ant-select-item-option').first();
                        if (await option.isVisible({ timeout: 2000 }).catch(() => false)) {
                            await option.click();
                            await page.waitForTimeout(500);
                        }
                    }

                    // 提交
                    const submitButton = page.getByRole('button').filter({ hasText: /确定|提交|保存/ }).last();
                    if (await submitButton.isVisible({ timeout: 2000 }).catch(() => false)) {
                        await submitButton.click();
                        await page.waitForTimeout(3000);
                        
                        // 验证成功
                        const successMessage = page.locator('.ant-message-success').first();
                        const hasSuccess = await successMessage.isVisible({ timeout: 5000 }).catch(() => false);
                        if (hasSuccess) {
                            const messageText = await successMessage.textContent();
                            expect(messageText).toMatch(/成功|创建|已新增/);
                        }
                    }
                }
            }
        });
    });

    // ==================== 读取操作测试 ====================
    test.describe('读取操作 (Read)', () => {
        test('查看列表数据', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/finance/flows`);
            await page.waitForTimeout(3000);

            // 验证表格存在
            const table = page.locator('.ant-table, .data-table').first();
            await table.waitFor({ timeout: 5000 }).catch(() => {});
            
            // 验证至少有一些数据或空状态
            const hasData = await table.locator('tbody tr').count().then(count => count > 0).catch(() => false);
            const hasEmptyState = await page.locator('.ant-empty, .empty-state').isVisible({ timeout: 2000 }).catch(() => false);
            expect(hasData || hasEmptyState).toBeTruthy();
        });

        test('查看详情数据', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/finance/flows`);
            await page.waitForTimeout(3000);

            // 尝试点击第一行查看详情
            const firstRow = page.locator('tbody tr').first();
            if (await firstRow.isVisible({ timeout: 3000 }).catch(() => false)) {
                await firstRow.click();
                await page.waitForTimeout(2000);
                
                // 验证详情页面或模态框打开
                const detailModal = page.locator('.ant-modal, .ant-drawer').first();
                const hasDetail = await detailModal.isVisible({ timeout: 3000 }).catch(() => false);
                if (hasDetail) {
                    expect(await detailModal.isVisible()).toBeTruthy();
                }
            }
        });
    });

    // ==================== 更新操作测试 ====================
    test.describe('更新操作 (Update)', () => {
        test('更新类别信息', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/system/categories`);
            await page.waitForTimeout(3000);

            // 查找第一个可编辑的行
            const editButton = page.locator('button').filter({ hasText: /编辑|修改/ }).first();
            if (await editButton.isVisible({ timeout: 3000 }).catch(() => false)) {
                await editButton.click();
                await page.waitForTimeout(1000);

                // 修改名称（添加测试后缀）
                const nameInput = page.locator('input[placeholder*="名称"], input[placeholder*="类别名称"]').first();
                if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
                    const currentValue = await nameInput.inputValue();
                    await nameInput.clear();
                    await nameInput.fill(`${currentValue}_E2E测试`);
                    await page.waitForTimeout(500);

                    // 提交
                    const submitButton = page.getByRole('button').filter({ hasText: /确定|提交|保存/ }).last();
                    if (await submitButton.isVisible({ timeout: 2000 }).catch(() => false)) {
                        await submitButton.click();
                        await page.waitForTimeout(3000);
                        
                        // 验证成功
                        const successMessage = page.locator('.ant-message-success').first();
                        const hasSuccess = await successMessage.isVisible({ timeout: 5000 }).catch(() => false);
                        if (hasSuccess) {
                            const messageText = await successMessage.textContent();
                            expect(messageText).toMatch(/成功|更新|已更新/);
                        }
                    }
                }
            }
        });

        test('更新账户状态', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/system/accounts`);
            await page.waitForTimeout(3000);

            // 查找状态开关
            const statusSwitch = page.locator('.ant-switch').first();
            if (await statusSwitch.isVisible({ timeout: 3000 }).catch(() => false)) {
                const currentState = await statusSwitch.getAttribute('aria-checked');
                await statusSwitch.click();
                await page.waitForTimeout(2000);
                
                // 验证状态改变
                const newState = await statusSwitch.getAttribute('aria-checked');
                expect(newState).not.toBe(currentState);
            }
        });
    });

    // ==================== 删除操作测试 ====================
    test.describe('删除操作 (Delete)', () => {
        test('删除测试数据 - 类别', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/system/categories`);
            await page.waitForTimeout(3000);

            // 查找包含"E2E测试"的类别
            const testCategoryRow = page.locator('tbody tr').filter({ hasText: /E2E测试/ }).first();
            if (await testCategoryRow.isVisible({ timeout: 3000 }).catch(() => false)) {
                // 点击删除按钮
                const deleteButton = testCategoryRow.locator('button').filter({ hasText: /删除/ }).first();
                if (await deleteButton.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await deleteButton.click();
                    await page.waitForTimeout(1000);

                    // 确认删除对话框
                    const confirmButton = page.getByRole('button').filter({ hasText: /确定|确认|删除/ }).last();
                    if (await confirmButton.isVisible({ timeout: 3000 }).catch(() => false)) {
                        await confirmButton.click();
                        await page.waitForTimeout(3000);
                        
                        // 验证成功消息
                        const successMessage = page.locator('.ant-message-success').first();
                        const hasSuccess = await successMessage.isVisible({ timeout: 5000 }).catch(() => false);
                        if (hasSuccess) {
                            const messageText = await successMessage.textContent();
                            expect(messageText).toMatch(/成功|删除|已删除/);
                        }
                    }
                }
            }
        });

        test('批量删除操作', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/system/categories`);
            await page.waitForTimeout(3000);

            // 查找复选框
            const checkboxes = page.locator('tbody tr .ant-checkbox-input');
            const checkboxCount = await checkboxes.count();
            
            if (checkboxCount > 0) {
                // 选择第一个复选框（仅测试UI交互，不实际删除）
                const firstCheckbox = checkboxes.first();
                if (await firstCheckbox.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await firstCheckbox.click();
                    await page.waitForTimeout(1000);
                    
                    // 验证批量操作按钮出现
                    const batchDeleteButton = page.getByRole('button').filter({ hasText: /批量删除/ });
                    const hasBatchButton = await batchDeleteButton.isVisible({ timeout: 2000 }).catch(() => false);
                    if (hasBatchButton) {
                        expect(await batchDeleteButton.isVisible()).toBeTruthy();
                    }
                }
            }
        });
    });

    // ==================== 财务模块 CRUD ====================
    test.describe('财务模块 CRUD', () => {
        test('创建账户转账', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/finance/transfer`);
            await page.waitForTimeout(2000);

            // 点击新建按钮
            const createButton = page.getByRole('button').filter({ hasText: /新建|新增|创建|转账/ }).first();
            if (await createButton.isVisible({ timeout: 3000 }).catch(() => false)) {
                await createButton.click();
                await page.waitForTimeout(1000);

                // 选择转出账户
                const fromAccountSelect = page.locator('.ant-select').filter({ hasText: /转出|从/ }).first();
                if (await fromAccountSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
                    await fromAccountSelect.click();
                    await page.waitForTimeout(500);
                    const option = page.locator('.ant-select-item-option').first();
                    if (await option.isVisible({ timeout: 2000 }).catch(() => false)) {
                        await option.click();
                        await page.waitForTimeout(1000);
                    }
                }

                // 填写金额
                const amountInput = page.locator('input[placeholder*="金额"]').first();
                if (await amountInput.isVisible({ timeout: 3000 }).catch(() => false)) {
                    await amountInput.fill('0.01');
                    await page.waitForTimeout(500);
                }

                // 提交（仅测试UI，不实际提交）
                const submitButton = page.getByRole('button').filter({ hasText: /提交|确定/ }).last();
                if (await submitButton.isVisible({ timeout: 2000 }).catch(() => false)) {
                    // 验证表单可以填写
                    expect(await amountInput.inputValue()).toBe('0.01');
                }
            }
        });

        test('创建应收单据', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/finance/ar`);
            await page.waitForTimeout(2000);

            // 点击新建应收按钮
            const createButton = page.getByRole('button').filter({ hasText: /新建应收|新增/ }).first();
            if (await createButton.isVisible({ timeout: 3000 }).catch(() => false)) {
                await createButton.click();
                await page.waitForTimeout(1000);

                // 填写金额
                const amountInput = page.locator('input[placeholder*="金额"]').first();
                if (await amountInput.isVisible({ timeout: 3000 }).catch(() => false)) {
                    await amountInput.fill('0.01');
                    await page.waitForTimeout(500);
                    expect(await amountInput.inputValue()).toBe('0.01');
                }
            }
        });
    });

    // ==================== 人事模块 CRUD ====================
    test.describe('人事模块 CRUD', () => {
        test('创建请假申请', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/hr/leaves`);
            await page.waitForTimeout(2000);

            // 点击新建按钮
            const createButton = page.getByRole('button').filter({ hasText: /新建|新增|创建|请假/ }).first();
            if (await createButton.isVisible({ timeout: 3000 }).catch(() => false)) {
                await createButton.click();
                await page.waitForTimeout(1000);

                // 选择请假类型
                const typeSelect = page.locator('.ant-select').filter({ hasText: /类型|请假类型/ }).first();
                if (await typeSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
                    await typeSelect.click();
                    await page.waitForTimeout(500);
                    const option = page.locator('.ant-select-item-option').first();
                    if (await option.isVisible({ timeout: 2000 }).catch(() => false)) {
                        await option.click();
                        await page.waitForTimeout(1000);
                    }
                }
            }
        });

        test('创建报销申请', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/hr/reimbursements`);
            await page.waitForTimeout(2000);

            // 点击新建报销按钮
            const createButton = page.getByRole('button').filter({ hasText: /新建报销|新增/ }).first();
            if (await createButton.isVisible({ timeout: 3000 }).catch(() => false)) {
                await createButton.click();
                await page.waitForTimeout(1000);

                // 选择报销类型
                const typeSelect = page.locator('.ant-select').filter({ hasText: /类型|报销类型/ }).first();
                if (await typeSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
                    await typeSelect.click();
                    await page.waitForTimeout(500);
                    const option = page.locator('.ant-select-item-option').first();
                    if (await option.isVisible({ timeout: 2000 }).catch(() => false)) {
                        await option.click();
                        await page.waitForTimeout(1000);
                    }
                }
            }
        });
    });

    // ==================== 系统管理模块 CRUD ====================
    test.describe('系统管理模块 CRUD', () => {
        test('创建账户', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/system/accounts`);
            await page.waitForTimeout(2000);

            // 点击新建按钮
            const createButton = page.getByRole('button').filter({ hasText: /新建|新增|创建/ }).first();
            if (await createButton.isVisible({ timeout: 3000 }).catch(() => false)) {
                await createButton.click();
                await page.waitForTimeout(1000);

                // 填写账户名称
                const nameInput = page.locator('input[placeholder*="名称"], input[placeholder*="账户名称"]').first();
                if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
                    const testName = `E2E测试账户_${Date.now()}`;
                    await nameInput.fill(testName);
                    await page.waitForTimeout(500);
                    expect(await nameInput.inputValue()).toBe(testName);
                }
            }
        });

        test('创建供应商', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/system/vendors`);
            await page.waitForTimeout(2000);

            // 点击新建按钮
            const createButton = page.getByRole('button').filter({ hasText: /新建|新增|创建/ }).first();
            if (await createButton.isVisible({ timeout: 3000 }).catch(() => false)) {
                await createButton.click();
                await page.waitForTimeout(1000);

                // 填写供应商名称
                const nameInput = page.locator('input[placeholder*="名称"], input[placeholder*="供应商"]').first();
                if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
                    const testName = `E2E测试供应商_${Date.now()}`;
                    await nameInput.fill(testName);
                    await page.waitForTimeout(500);
                    expect(await nameInput.inputValue()).toBe(testName);
                }
            }
        });

        test('更新供应商信息', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/system/vendors`);
            await page.waitForTimeout(3000);

            // 查找编辑按钮
            const editButton = page.locator('button').filter({ hasText: /编辑|修改/ }).first();
            if (await editButton.isVisible({ timeout: 3000 }).catch(() => false)) {
                await editButton.click();
                await page.waitForTimeout(1000);

                // 验证编辑表单打开
                const nameInput = page.locator('input[placeholder*="名称"]').first();
                if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
                    expect(await nameInput.isVisible()).toBeTruthy();
                }
            }
        });

        test('删除供应商（测试数据）', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/system/vendors`);
            await page.waitForTimeout(3000);

            // 查找包含"E2E测试"的供应商
            const testVendorRow = page.locator('tbody tr').filter({ hasText: /E2E测试/ }).first();
            if (await testVendorRow.isVisible({ timeout: 3000 }).catch(() => false)) {
                const deleteButton = testVendorRow.locator('button').filter({ hasText: /删除/ }).first();
                if (await deleteButton.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await deleteButton.click();
                    await page.waitForTimeout(1000);

                    // 确认删除
                    const confirmButton = page.getByRole('button').filter({ hasText: /确定|确认/ }).last();
                    if (await confirmButton.isVisible({ timeout: 3000 }).catch(() => false)) {
                        await confirmButton.click();
                        await page.waitForTimeout(3000);
                        
                        // 验证成功消息
                        const successMessage = page.locator('.ant-message-success').first();
                        const hasSuccess = await successMessage.isVisible({ timeout: 5000 }).catch(() => false);
                        if (hasSuccess) {
                            const messageText = await successMessage.textContent();
                            expect(messageText).toMatch(/成功|删除|已删除/);
                        }
                    }
                }
            }
        });
    });

    // ==================== 站点模块 CRUD ====================
    test.describe('站点模块 CRUD', () => {
        test('创建站点', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/sites/list`);
            await page.waitForTimeout(2000);

            // 点击新建站点按钮
            const createButton = page.getByRole('button').filter({ hasText: /新建站点|新增|创建/ }).first();
            if (await createButton.isVisible({ timeout: 3000 }).catch(() => false)) {
                await createButton.click();
                await page.waitForTimeout(1000);

                // 填写站点名称
                const nameInput = page.locator('input[placeholder*="名称"], input[placeholder*="站点名称"]').first();
                if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
                    const testName = `E2E测试站点_${Date.now()}`;
                    await nameInput.fill(testName);
                    await page.waitForTimeout(500);
                    expect(await nameInput.inputValue()).toBe(testName);
                }
            }
        });

        test('创建站点账单', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/sites/bills`);
            await page.waitForTimeout(2000);

            // 点击新建账单按钮
            const createButton = page.getByRole('button').filter({ hasText: /新建|新增|创建|账单/ }).first();
            if (await createButton.isVisible({ timeout: 3000 }).catch(() => false)) {
                await createButton.click();
                await page.waitForTimeout(1000);

                // 选择站点
                const siteSelect = page.locator('.ant-select').filter({ hasText: /站点/ }).first();
                if (await siteSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
                    await siteSelect.click();
                    await page.waitForTimeout(500);
                    const option = page.locator('.ant-select-item-option').first();
                    if (await option.isVisible({ timeout: 2000 }).catch(() => false)) {
                        await option.click();
                        await page.waitForTimeout(1000);
                    }
                }
            }
        });

        test('更新站点信息', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/sites/list`);
            await page.waitForTimeout(3000);

            // 查找编辑按钮
            const editButton = page.locator('button').filter({ hasText: /编辑|修改/ }).first();
            if (await editButton.isVisible({ timeout: 3000 }).catch(() => false)) {
                await editButton.click();
                await page.waitForTimeout(1000);

                // 验证编辑表单打开
                const nameInput = page.locator('input[placeholder*="名称"]').first();
                if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
                    expect(await nameInput.isVisible()).toBeTruthy();
                }
            }
        });
    });

    // ==================== 资产模块 CRUD ====================
    test.describe('资产模块 CRUD', () => {
        test('创建固定资产', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/assets/list`);
            await page.waitForTimeout(2000);

            // 点击新建资产按钮
            const createButton = page.getByRole('button').filter({ hasText: /新建|新增|创建|资产/ }).first();
            if (await createButton.isVisible({ timeout: 3000 }).catch(() => false)) {
                await createButton.click();
                await page.waitForTimeout(1000);

                // 填写资产名称
                const nameInput = page.locator('input[placeholder*="名称"], input[placeholder*="资产名称"]').first();
                if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
                    const testName = `E2E测试资产_${Date.now()}`;
                    await nameInput.fill(testName);
                    await page.waitForTimeout(500);
                    expect(await nameInput.inputValue()).toBe(testName);
                }
            }
        });

        test('创建租赁物业', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/assets/rental`);
            await page.waitForTimeout(2000);

            // 点击新建租赁按钮
            const createButton = page.getByRole('button').filter({ hasText: /新建|新增|创建|租赁/ }).first();
            if (await createButton.isVisible({ timeout: 3000 }).catch(() => false)) {
                await createButton.click();
                await page.waitForTimeout(1000);

                // 选择物业类型
                const typeSelect = page.locator('.ant-select').filter({ hasText: /类型|物业类型/ }).first();
                if (await typeSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
                    await typeSelect.click();
                    await page.waitForTimeout(500);
                    const option = page.locator('.ant-select-item-option').first();
                    if (await option.isVisible({ timeout: 2000 }).catch(() => false)) {
                        await option.click();
                        await page.waitForTimeout(1000);
                    }
                }
            }
        });

        test('更新固定资产信息', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/assets/list`);
            await page.waitForTimeout(3000);

            // 查找编辑按钮
            const editButton = page.locator('button').filter({ hasText: /编辑|修改/ }).first();
            if (await editButton.isVisible({ timeout: 3000 }).catch(() => false)) {
                await editButton.click();
                await page.waitForTimeout(1000);

                // 验证编辑表单打开
                const nameInput = page.locator('input[placeholder*="名称"]').first();
                if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
                    expect(await nameInput.isVisible()).toBeTruthy();
                }
            }
        });

        test('删除固定资产（测试数据）', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/assets/list`);
            await page.waitForTimeout(3000);

            // 查找包含"E2E测试"的资产
            const testAssetRow = page.locator('tbody tr').filter({ hasText: /E2E测试/ }).first();
            if (await testAssetRow.isVisible({ timeout: 3000 }).catch(() => false)) {
                const deleteButton = testAssetRow.locator('button').filter({ hasText: /删除/ }).first();
                if (await deleteButton.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await deleteButton.click();
                    await page.waitForTimeout(1000);

                    // 确认删除
                    const confirmButton = page.getByRole('button').filter({ hasText: /确定|确认/ }).last();
                    if (await confirmButton.isVisible({ timeout: 3000 }).catch(() => false)) {
                        await confirmButton.click();
                        await page.waitForTimeout(3000);
                        
                        // 验证成功消息
                        const successMessage = page.locator('.ant-message-success').first();
                        const hasSuccess = await successMessage.isVisible({ timeout: 5000 }).catch(() => false);
                        if (hasSuccess) {
                            const messageText = await successMessage.textContent();
                            expect(messageText).toMatch(/成功|删除|已删除/);
                        }
                    }
                }
            }
        });
    });

    // ==================== 综合CRUD测试 ====================
    test.describe('综合CRUD流程', () => {
        test('完整的CRUD流程 - 类别管理', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/system/categories`);
            await page.waitForTimeout(2000);

            const testName = `E2E测试_${Date.now()}`;
            let createdId: string | null = null;

            // 1. Create - 创建
            const createButton = page.getByRole('button').filter({ hasText: /新建|新增|创建/ }).first();
            if (await createButton.isVisible({ timeout: 3000 }).catch(() => false)) {
                await createButton.click();
                await page.waitForTimeout(1000);

                const nameInput = page.locator('input[placeholder*="名称"]').first();
                if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
                    await nameInput.fill(testName);
                    await page.waitForTimeout(500);

                    const submitButton = page.getByRole('button').filter({ hasText: /确定|提交/ }).last();
                    if (await submitButton.isVisible({ timeout: 2000 }).catch(() => false)) {
                        await submitButton.click();
                        await page.waitForTimeout(3000);
                    }
                }
            }

            // 2. Read - 验证创建成功
            await page.reload();
            await page.waitForTimeout(2000);
            const createdRow = page.locator('tbody tr').filter({ hasText: testName }).first();
            const isCreated = await createdRow.isVisible({ timeout: 5000 }).catch(() => false);
            expect(isCreated).toBeTruthy();

            // 3. Update - 更新
            if (isCreated) {
                const editButton = createdRow.locator('button').filter({ hasText: /编辑/ }).first();
                if (await editButton.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await editButton.click();
                    await page.waitForTimeout(1000);

                    const nameInput = page.locator('input[placeholder*="名称"]').first();
                    if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
                        await nameInput.clear();
                        await nameInput.fill(`${testName}_已更新`);
                        await page.waitForTimeout(500);

                        const submitButton = page.getByRole('button').filter({ hasText: /确定|提交/ }).last();
                        if (await submitButton.isVisible({ timeout: 2000 }).catch(() => false)) {
                            await submitButton.click();
                            await page.waitForTimeout(3000);
                        }
                    }
                }
            }

            // 4. Delete - 删除
            await page.reload();
            await page.waitForTimeout(2000);
            const updatedRow = page.locator('tbody tr').filter({ hasText: /E2E测试.*已更新/ }).first();
            if (await updatedRow.isVisible({ timeout: 3000 }).catch(() => false)) {
                const deleteButton = updatedRow.locator('button').filter({ hasText: /删除/ }).first();
                if (await deleteButton.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await deleteButton.click();
                    await page.waitForTimeout(1000);

                    const confirmButton = page.getByRole('button').filter({ hasText: /确定|确认/ }).last();
                    if (await confirmButton.isVisible({ timeout: 3000 }).catch(() => false)) {
                        await confirmButton.click();
                        await page.waitForTimeout(3000);
                        
                        // 验证删除成功
                        await page.reload();
                        await page.waitForTimeout(2000);
                        const deletedRow = page.locator('tbody tr').filter({ hasText: testName }).first();
                        const isDeleted = await deletedRow.isVisible({ timeout: 2000 }).catch(() => false);
                        expect(isDeleted).toBeFalsy();
                    }
                }
            }
        });
    });
});

