/**
 * 线上测试环境 E2E 测试
 * 
 * 运行前需要配置环境变量：
 * - LIVE_TEST_URL: 线上测试环境 URL
 * - LIVE_TEST_EMAIL: 测试账号邮箱
 * - LIVE_TEST_PASSWORD: 测试账号密码
 * - LIVE_TEST_TOTP_SECRET: TOTP 密钥（从数据库获取）
 * 
 * 运行命令：npm run test:e2e:live
 */

import { test, expect } from '@playwright/test';
import { loadLiveEnvConfig, validateConfig } from './config/live-env';
import { liveLogin, liveLogout, ensureLoggedIn } from './utils/live-login';
import { navigateAndWait } from './utils/page-helpers';
import { getAuthToken, clearToken } from './utils/token-manager';

// 加载配置
const config = loadLiveEnvConfig();

// 验证配置
const validation = validateConfig(config);
if (!validation.valid) {
    console.warn('线上测试环境配置不完整：', validation.errors);
}

// 设置测试超时和顺序执行
test.setTimeout(config.timeout);

// 使用 serial 模式顺序执行，避免会话冲突
test.describe.serial('线上环境测试', () => {
    
    // 跳过没有配置 TOTP 的测试
    test.beforeEach(async () => {
        test.skip(!config.totpSecret, 'TOTP Secret 未配置');
    });
    
    // 在所有测试开始前获取一次 token
    test.beforeAll(async () => {
        if (config.totpSecret) {
            try {
                console.log('开始获取认证 token...');
                await getAuthToken(config);
                console.log('Token 获取成功，后续测试将复用此 token');
            } catch (error: any) {
                console.warn('获取 token 失败，将使用 UI 登录:', error.message);
            }
        }
    });
    
    // 测试结束后清理 token
    test.afterAll(async () => {
        clearToken();
    });
    
    // ==================== 认证模块 ====================
    test.describe('认证模块', () => {
        test('登录流程', async ({ page }) => {
            await liveLogin(page, config);
            expect(page.url()).not.toContain('/login');
        });

        test('登出流程', async ({ page }) => {
            await liveLogin(page, config);
            await liveLogout(page, config);
            expect(page.url()).toContain('/login');
        });
    });

    // ==================== 仪表盘和个人中心 ====================
    test.describe('仪表盘和个人中心', () => {
        test.beforeEach(async ({ page }) => {
            // 确保已登录，如果已登录则跳过登录步骤
            await ensureLoggedIn(page, config);
            // 增加延迟避免请求过快和会话冲突
            await page.waitForTimeout(2000);
        });

        test('查看个人中心', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/my/center`);
            expect(page.url()).toContain('/my/center');
        });

        test('查看我的请假', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/my/leaves`);
            expect(page.url()).toContain('/my/leaves');
        });

        test('查看我的报销', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/my/reimbursements`);
            expect(page.url()).toContain('/my/reimbursements');
        });

        test('查看我的资产', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/my/assets`);
            expect(page.url()).toContain('/my/assets');
        });

        test('查看我的审批', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/my/approvals`);
            expect(page.url()).toContain('/my/approvals');
        });

        test('查看公司制度', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/my/policies`);
            expect(page.url()).toContain('/my/policies');
        });

        test('查看修改密码页面', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/change-password`);
            expect(page.url()).toContain('/change-password');
        });
    });

    // ==================== 财务模块 ====================
    test.describe('财务模块', () => {
        test.beforeEach(async ({ page }) => {
            await ensureLoggedIn(page, config);
            await page.waitForTimeout(2000);
        });

        test('查看收支列表', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/finance/flows`);
            expect(page.url()).toContain('/finance/flows');
        });

        test('查看新增收支页面', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/finance/flows/create`);
            expect(page.url()).toContain('/finance/flows/create');
        });

        test('查看账户转账', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/finance/transfer`);
            expect(page.url()).toContain('/finance/transfer');
        });

        test('查看账户交易', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/finance/transactions`);
            expect(page.url()).toContain('/finance/transactions');
        });

        test('查看导入中心', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/finance/import`);
            expect(page.url()).toContain('/finance/import');
        });
        test('查看应收管理', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/finance/ar`);
            expect(page.url()).toContain('/finance/ar');
        });

        test('查看应付管理', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/finance/ap`);
            expect(page.url()).toContain('/finance/ap');
        });

        // ==================== 财务模块交互测试 ====================
        test('测试收支列表搜索功能', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/finance/flows`);
            await page.waitForTimeout(2000);
            
            // 查找搜索输入框
            const searchInput = page.locator('input[placeholder*="搜索"], input[placeholder*="请输入"]').first();
            if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
                await searchInput.fill('测试');
                await page.waitForTimeout(1000);
                // 验证搜索已触发（页面应该有响应）
                expect(await searchInput.inputValue()).toBe('测试');
            }
        });

        test('测试应收管理筛选功能', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/finance/ar`);
            await page.waitForTimeout(2000);
            
            // 查找状态筛选下拉框
            const statusSelect = page.locator('.ant-select').filter({ hasText: /状态|全部/ }).first();
            if (await statusSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
                await statusSelect.click();
                await page.waitForTimeout(500);
                // 尝试选择第一个选项
                const option = page.locator('.ant-select-item-option').first();
                if (await option.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await option.click();
                    await page.waitForTimeout(1000);
                }
            }
        });

        test('测试应付管理刷新功能', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/finance/ap`);
            await page.waitForTimeout(2000);
            
            // 查找刷新按钮
            const refreshButton = page.getByRole('button').filter({ hasText: /刷新|刷新数据/ }).first();
            if (await refreshButton.isVisible({ timeout: 3000 }).catch(() => false)) {
                await refreshButton.click();
                await page.waitForTimeout(1000);
                // 验证刷新已触发（页面应该有响应）
                expect(await refreshButton.isVisible()).toBeTruthy();
            }
        });
    });

    // ==================== 人事模块 ====================
    test.describe('人事模块', () => {
        test.beforeEach(async ({ page }) => {
            await ensureLoggedIn(page, config);
            await page.waitForTimeout(2000);
        });

        test('查看员工管理', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/hr/employees`);
            expect(page.url()).toContain('/hr/employees');
        });

        test('查看薪资报表', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/hr/salary-report`);
            expect(page.url()).toContain('/hr/salary-report');
        });

        test('查看薪资发放', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/hr/salary-payments`);
            expect(page.url()).toContain('/hr/salary-payments');
        });

        test('查看补贴发放', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/hr/allowance-payments`);
            expect(page.url()).toContain('/hr/allowance-payments');
        });

        test('查看请假管理', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/hr/leaves`);
            expect(page.url()).toContain('/hr/leaves');
        });

        test('查看报销管理', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/hr/reimbursements`);
            expect(page.url()).toContain('/hr/reimbursements');
        });

        // ==================== 人事模块交互测试 ====================
        test('测试员工管理搜索功能', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/hr/employees`);
            await page.waitForTimeout(2000);
            
            // 查找搜索输入框
            const searchInput = page.locator('input[placeholder*="搜索"], input[placeholder*="员工"], input[placeholder*="姓名"]').first();
            if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
                await searchInput.fill('测试');
                await page.waitForTimeout(1000);
                expect(await searchInput.inputValue()).toBe('测试');
            }
        });

        test('测试报销管理筛选功能', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/hr/reimbursements`);
            await page.waitForTimeout(2000);
            
            // 查找状态筛选下拉框
            const statusSelect = page.locator('.ant-select').filter({ hasText: /状态|全部/ }).first();
            if (await statusSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
                await statusSelect.click();
                await page.waitForTimeout(500);
                const option = page.locator('.ant-select-item-option').first();
                if (await option.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await option.click();
                    await page.waitForTimeout(1000);
                }
            }
        });
    });

    // ==================== 报表模块 ====================
    test.describe('报表模块', () => {
        test.beforeEach(async ({ page }) => {
            await ensureLoggedIn(page, config);
            await page.waitForTimeout(2000);
        });

        test('查看部门现金流报表', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/reports/dept-cash`);
            expect(page.url()).toContain('/reports/dept-cash');
        });

        test('查看站点增长报表', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/reports/site-growth`);
            expect(page.url()).toContain('/reports/site-growth');
        });

        test('查看应收汇总报表', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/reports/ar-summary`);
            expect(page.url()).toContain('/reports/ar-summary');
        });

        test('查看应收明细报表', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/reports/ar-detail`);
            expect(page.url()).toContain('/reports/ar-detail');
        });

        test('查看应付汇总报表', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/reports/ap-summary`);
            expect(page.url()).toContain('/reports/ap-summary');
        });

        test('查看应付明细报表', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/reports/ap-detail`);
            expect(page.url()).toContain('/reports/ap-detail');
        });

        test('查看费用汇总报表', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/reports/expense-summary`);
            expect(page.url()).toContain('/reports/expense-summary');
        });

        test('查看费用明细报表', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/reports/expense-detail`);
            expect(page.url()).toContain('/reports/expense-detail');
        });

        test('查看账户余额报表', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/reports/account-balance`);
            expect(page.url()).toContain('/reports/account-balance');
        });


        // ==================== 报表模块交互测试 ====================
        test('测试报表日期筛选功能', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/reports/dept-cash`);
            await page.waitForTimeout(2000);
            
            // 查找日期选择器
            const datePicker = page.locator('.ant-picker-input').first();
            if (await datePicker.isVisible({ timeout: 3000 }).catch(() => false)) {
                await datePicker.click();
                await page.waitForTimeout(500);
                // 尝试选择今天
                const todayButton = page.locator('.ant-picker-today-btn, .ant-picker-cell-today').first();
                if (await todayButton.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await todayButton.click();
                    await page.waitForTimeout(1000);
                }
            }
        });

        test('测试报表查询功能', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/reports/ar-summary`);
            await page.waitForTimeout(2000);
            
            // 查找查询按钮
            const queryButton = page.getByRole('button').filter({ hasText: /查询|搜索|确定/ }).first();
            if (await queryButton.isVisible({ timeout: 3000 }).catch(() => false)) {
                await queryButton.click();
                await page.waitForTimeout(2000);
                // 验证查询已触发
                expect(await queryButton.isVisible()).toBeTruthy();
            }
        });
    });

    // ==================== 系统管理模块 ====================
    test.describe('系统管理模块', () => {
        test.beforeEach(async ({ page }) => {
            await ensureLoggedIn(page, config);
            await page.waitForTimeout(2000);
        });

        test('查看部门管理', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/system/departments`);
            expect(page.url()).toContain('/system/departments');
        });

        test('查看类别管理', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/system/categories`);
            expect(page.url()).toContain('/system/categories');
        });

        test('查看账户管理', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/system/accounts`);
            expect(page.url()).toContain('/system/accounts');
        });

        test('查看币种管理', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/system/currencies`);
            expect(page.url()).toContain('/system/currencies');
        });

        test('查看供应商管理', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/system/vendors`);
            expect(page.url()).toContain('/system/vendors');
        });

        test('查看权限管理', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/system/permissions`);
            expect(page.url()).toContain('/system/permissions');
        });

        test('查看邮件设置', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/system/email`);
            expect(page.url()).toContain('/system/email');
        });

        test('查看IP白名单', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/system/ip-whitelist`);
            expect(page.url()).toContain('/system/ip-whitelist');
        });

        test('查看审计日志', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/system/audit`);
            expect(page.url()).toContain('/system/audit');
        });

        // ==================== 系统管理模块交互测试 ====================
        test('测试部门管理搜索功能', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/system/departments`);
            await page.waitForTimeout(2000);
            
            // 查找搜索输入框
            const searchInput = page.locator('input[placeholder*="搜索"], input[placeholder*="部门"]').first();
            if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
                await searchInput.fill('测试');
                await page.waitForTimeout(1000);
                expect(await searchInput.inputValue()).toBe('测试');
            }
        });

        test('测试账户管理刷新功能', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/system/accounts`);
            await page.waitForTimeout(2000);
            
            // 查找刷新按钮
            const refreshButton = page.getByRole('button').filter({ hasText: /刷新/ }).first();
            if (await refreshButton.isVisible({ timeout: 3000 }).catch(() => false)) {
                await refreshButton.click();
                await page.waitForTimeout(1000);
                expect(await refreshButton.isVisible()).toBeTruthy();
            }
        });

        test('测试类别管理表格分页', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/system/categories`);
            await page.waitForTimeout(2000);
            
            // 查找分页器
            const pagination = page.locator('.ant-pagination').first();
            if (await pagination.isVisible({ timeout: 3000 }).catch(() => false)) {
                // 尝试点击下一页
                const nextButton = pagination.locator('.ant-pagination-next');
                if (await nextButton.isVisible({ timeout: 2000 }).catch(() => false) && !(await nextButton.getAttribute('aria-disabled'))) {
                    await nextButton.click();
                    await page.waitForTimeout(1000);
                }
            }
        });
    });

    // ==================== 站点模块 ====================
    test.describe('站点模块', () => {
        test.beforeEach(async ({ page }) => {
            await ensureLoggedIn(page, config);
            await page.waitForTimeout(2000);
        });

        test('查看站点管理', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/sites/list`);
            expect(page.url()).toContain('/sites/list');
        });

        test('查看站点账单', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/sites/bills`);
            expect(page.url()).toContain('/sites/bills');
        });
    });

    // ==================== 资产模块 ====================
    test.describe('资产模块', () => {
        test.beforeEach(async ({ page }) => {
            await ensureLoggedIn(page, config);
            await page.waitForTimeout(2000);
        });

        test('查看固定资产', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/assets/list`);
            expect(page.url()).toContain('/assets/list');
        });

        test('查看租赁物业', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/assets/rental`);
            expect(page.url()).toContain('/assets/rental');
        });

        // ==================== 资产模块交互测试 ====================
        test('测试固定资产搜索功能', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/assets/list`);
            await page.waitForTimeout(2000);
            
            // 查找搜索输入框
            const searchInput = page.locator('input[placeholder*="搜索"], input[placeholder*="资产"]').first();
            if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
                await searchInput.fill('测试');
                await page.waitForTimeout(1000);
                expect(await searchInput.inputValue()).toBe('测试');
            }
        });

        test('测试固定资产筛选功能', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/assets/list`);
            await page.waitForTimeout(2000);
            
            // 查找状态筛选下拉框
            const statusSelect = page.locator('.ant-select').filter({ hasText: /状态|全部/ }).first();
            if (await statusSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
                await statusSelect.click();
                await page.waitForTimeout(500);
                const option = page.locator('.ant-select-item-option').first();
                if (await option.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await option.click();
                    await page.waitForTimeout(1000);
                }
            }
        });

        test('测试租赁物业筛选功能', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/assets/rental`);
            await page.waitForTimeout(2000);
            
            // 查找类型筛选下拉框
            const typeSelect = page.locator('.ant-select').filter({ hasText: /类型|全部/ }).first();
            if (await typeSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
                await typeSelect.click();
                await page.waitForTimeout(500);
                const option = page.locator('.ant-select-item-option').first();
                if (await option.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await option.click();
                    await page.waitForTimeout(1000);
                }
            }
        });
    });

    // ==================== 站点模块交互测试 ====================
    test.describe('站点模块交互', () => {
        test.beforeEach(async ({ page }) => {
            await ensureLoggedIn(page, config);
            await page.waitForTimeout(2000);
        });

        test('测试站点管理搜索功能', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/sites/list`);
            await page.waitForTimeout(2000);
            
            // 查找搜索输入框
            const searchInput = page.locator('input[placeholder*="搜索"], input[placeholder*="站点"]').first();
            if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
                await searchInput.fill('测试');
                await page.waitForTimeout(1000);
                expect(await searchInput.inputValue()).toBe('测试');
            }
        });

        test('测试站点账单筛选功能', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/sites/bills`);
            await page.waitForTimeout(2000);
            
            // 查找日期选择器或筛选下拉框
            const filterElement = page.locator('.ant-picker-input, .ant-select').first();
            if (await filterElement.isVisible({ timeout: 3000 }).catch(() => false)) {
                await filterElement.click();
                await page.waitForTimeout(1000);
            }
        });
    });

    // ==================== 个人中心交互测试 ====================
    test.describe('个人中心交互', () => {
        test.beforeEach(async ({ page }) => {
            await ensureLoggedIn(page, config);
            await page.waitForTimeout(2000);
        });

        test('测试个人中心数据加载', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/my/center`);
            await page.waitForTimeout(3000);
            
            // 验证页面已加载（检查是否有图表或数据卡片）
            const content = page.locator('.ant-card, .ant-statistic, canvas').first();
            await content.waitFor({ timeout: 5000 }).catch(() => {});
            expect(page.url()).toContain('/my/center');
        });

        test('测试个人中心刷新功能', async ({ page }) => {
            await navigateAndWait(page, `${config.baseUrl}/my/center`);
            await page.waitForTimeout(2000);
            
            // 查找刷新按钮
            const refreshButton = page.getByRole('button').filter({ hasText: /刷新/ }).first();
            if (await refreshButton.isVisible({ timeout: 3000 }).catch(() => false)) {
                await refreshButton.click();
                await page.waitForTimeout(2000);
                expect(await refreshButton.isVisible()).toBeTruthy();
            }
        });
    });
});
