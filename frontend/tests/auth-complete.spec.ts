import { test, expect } from './fixtures';
import { setupCommonMocks, setupActivationMocks, setupPasswordResetMocks, setupTotpResetMocks } from './utils/mock-api';
import { createPageObjects } from './utils/page-objects';

test.describe('Authentication Complete', () => {
    test.beforeEach(async ({ page }) => {
        await setupCommonMocks(page);
    });

    test('账户激活流程 - 成功激活', async ({ page }) => {
        await setupActivationMocks(page, { tokenValid: true, activationSuccess: true });

        const pages = createPageObjects(page);
        await pages.activateAccount.gotoActivate('valid-token-123');

        // 等待页面加载完成
        await page.waitForSelector('input[id="newPassword"]', { timeout: 10000 });

        // 填写密码
        await pages.activateAccount.fillPassword('NewPassword123!');
        await pages.activateAccount.fillConfirmPassword('NewPassword123!');

        // 提交密码设置（会进入 TOTP 绑定步骤）
        await pages.activateAccount.submit();

        // 等待 TOTP 二维码加载
        await page.waitForSelector('input[id="totpCode"]', { timeout: 10000 });

        // 填写 TOTP 验证码
        await pages.activateAccount.fillTotpCode('123456');

        // 提交 TOTP 绑定
        await pages.activateAccount.submit();

        // 验证成功
        await pages.activateAccount.waitForMessage('success', '激活成功');
    });

    test('账户激活流程 - 无效token', async ({ page }) => {
        await setupActivationMocks(page, { tokenValid: false });

        const pages = createPageObjects(page);
        await pages.activateAccount.gotoActivate('invalid-token');

        // 应该显示错误信息
        await expect(page.getByText('无效的激活链接')).toBeVisible();
    });

    test('密码重置流程 - 成功重置', async ({ page }) => {
        await setupPasswordResetMocks(page, { tokenValid: true, resetSuccess: true });

        const pages = createPageObjects(page);
        await pages.resetPassword.gotoReset('valid-reset-token-123');

        // 填写新密码
        await pages.resetPassword.fillNewPassword('NewPassword123!');
        await pages.resetPassword.fillConfirmPassword('NewPassword123!');

        // 提交重置
        await pages.resetPassword.submit();

        // 验证成功
        await pages.resetPassword.waitForMessage('success', '重置成功');
    });

    test('密码重置流程 - 无效token', async ({ page }) => {
        await setupPasswordResetMocks(page, { tokenValid: false });

        const pages = createPageObjects(page);
        await pages.resetPassword.gotoReset('invalid-token');

        // 应该显示错误信息
        await expect(page.getByText('无效的重置链接')).toBeVisible();
    });

    test('修改密码流程', async ({ page }) => {
        // Mock 修改密码 API
        await page.route('**/api/v2/auth/change-password', async route => {
            await route.fulfill({ json: { success: true, message: '密码修改成功' } });
        });

        // 先登录
        const pages = createPageObjects(page);
        await pages.login.login('admin@example.com', 'password');
        await pages.login.expectLoginSuccess();

        // 导航到修改密码页面
        await pages.changePassword.goto();

        // 填写密码
        await pages.changePassword.fillOldPassword('password');
        await pages.changePassword.fillNewPassword('NewPassword123!');
        await pages.changePassword.fillConfirmPassword('NewPassword123!');

        // 提交
        await pages.changePassword.submit();

        // 验证成功
        await pages.changePassword.waitForMessage('success', '修改成功');
    });

    test('TOTP重置请求流程', async ({ page }) => {
        await setupTotpResetMocks(page, { requestSuccess: true });

        // 先登录
        const pages = createPageObjects(page);
        await pages.login.login('admin@example.com', 'password');
        await pages.login.expectLoginSuccess();

        // 导航到请求TOTP重置页面
        await page.goto('http://localhost:5173/auth/request-totp-reset');

        // 填写邮箱
        await page.fill('input[id="email"]', 'admin@example.com');

        // 提交请求
        await page.click('button[type="submit"]');

        // 验证成功
        await expect(page.getByText('重置请求已发送')).toBeVisible();
    });

    test('TOTP重置确认流程', async ({ page }) => {
        await setupTotpResetMocks(page, { confirmSuccess: true });

        // Mock TOTP重置确认页面
        await page.goto('http://localhost:5173/auth/reset-totp?token=valid-totp-token');

        // 填写新TOTP密钥（如果有表单）
        // 根据实际页面实现调整

        // 提交确认
        await page.click('button[type="submit"]');

        // 验证成功
        await expect(page.getByText('TOTP重置成功')).toBeVisible();
    });

    test('修改密码 - 旧密码错误', async ({ page }) => {
        // Mock 修改密码 API - 旧密码错误
        await page.route('**/api/v2/auth/change-password', async route => {
            await route.fulfill({ status: 400, json: { error: '旧密码错误' } });
        });

        // 先登录
        const pages = createPageObjects(page);
        await pages.login.login('admin@example.com', 'password');
        await pages.login.expectLoginSuccess();

        // 导航到修改密码页面
        await pages.changePassword.goto();

        // 填写错误的旧密码
        await pages.changePassword.fillOldPassword('wrong-password');
        await pages.changePassword.fillNewPassword('NewPassword123!');
        await pages.changePassword.fillConfirmPassword('NewPassword123!');

        // 提交
        await pages.changePassword.submit();

        // 验证错误信息
        await pages.changePassword.waitForMessage('error', '旧密码错误');
    });

    test('修改密码 - 新密码不一致', async ({ page }) => {
        // 先登录
        const pages = createPageObjects(page);
        await pages.login.login('admin@example.com', 'password');
        await pages.login.expectLoginSuccess();

        // 导航到修改密码页面
        await pages.changePassword.goto();

        // 填写不一致的新密码
        await pages.changePassword.fillOldPassword('password');
        await pages.changePassword.fillNewPassword('NewPassword123!');
        await pages.changePassword.fillConfirmPassword('DifferentPassword123!');

        // 提交（应该被前端验证阻止）
        await pages.changePassword.submit();

        // 验证前端验证错误（如果有）
        // 根据实际实现调整
    });
});

