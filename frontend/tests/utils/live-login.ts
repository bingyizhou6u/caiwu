/**
 * 线上环境登录辅助函数
 * 处理完整的登录流程，包括 TOTP 验证
 */

import { Page, expect } from '@playwright/test';
import { generateTotp, waitForNextTotpCycle } from './totp';
import { LiveEnvConfig } from '../config/live-env';
import { getAuthToken, getCachedToken, getCachedUserInfo } from './token-manager';

/**
 * 线上环境登录
 * @param page - Playwright Page 对象
 * @param config - 线上环境配置
 */
export async function liveLogin(page: Page, config: LiveEnvConfig): Promise<void> {
    // 先检查是否有缓存的 token，如果没有则尝试通过 API 获取
    let cachedToken = getCachedToken();
    let cachedUser = getCachedUserInfo();

    if (!cachedToken || !cachedUser) {
        // 尝试通过 API 获取 token
        try {
            console.log('没有缓存 token，通过 API 获取...');
            cachedToken = await getAuthToken(config);
            cachedUser = getCachedUserInfo();
        } catch (error: any) {
            console.log('API 获取 token 失败，将使用 UI 登录:', error.message);
        }
    }

    if (cachedToken && cachedUser) {
        console.log('使用缓存的 token 设置认证状态');
        await setAuthToken(page, cachedToken, config, cachedUser);
        // 验证登录成功
        const currentUrl = page.url();
        if (!currentUrl.includes('/login')) {
            console.log('Token 设置成功，已登录');
            return;
        }
    }

    // 检查是否已经登录
    const currentUrl = page.url();
    if (!currentUrl.includes('/login')) {
        // 尝试访问一个需要登录的页面来验证
        try {
            const response = await page.goto(`${config.baseUrl}/my/center`, {
                timeout: 10000,
                waitUntil: 'domcontentloaded'
            });

            // 检查响应状态
            if (response && response.status() === 200) {
                await page.waitForTimeout(2000);
                const dashboardUrl = page.url();
                if (!dashboardUrl.includes('/login')) {
                    console.log('已登录，跳过登录步骤');
                    return;
                }
            }
        } catch (error: any) {
            // 如果是 Cloudflare 错误，等待后重试
            if (error.message && error.message.includes('Worker exceeded')) {
                console.log('检测到 Cloudflare 资源限制，等待 5 秒后重试');
                await page.waitForTimeout(5000);
            }
            // 如果访问失败，继续登录流程
        }
    }

    // 导航到登录页面
    await page.goto(`${config.baseUrl}/login`, {
        timeout: config.navigationTimeout,
        waitUntil: 'domcontentloaded', // 使用 domcontentloaded 避免等待所有资源
    });

    // 增加短暂延迟，避免请求过快
    await page.waitForTimeout(1000);

    // 等待登录表单加载（使用 placeholder 定位 Ant Design 输入框）
    const emailInput = page.getByPlaceholder('请输入邮箱地址');
    await emailInput.waitFor({ timeout: 10000 });

    // 清空并填写邮箱
    await emailInput.clear();
    await emailInput.fill(config.email);

    // 清空并填写密码
    const passwordInput = page.getByPlaceholder('请输入密码');
    await passwordInput.clear();
    await passwordInput.fill(config.password);

    // 点击登录按钮并等待 API 响应
    const loginButton = page.getByRole('button', { name: '登录', exact: true });

    // 等待登录 API 响应
    console.log('点击登录按钮并等待 API 响应...');
    const [response] = await Promise.all([
        page.waitForResponse(resp =>
            resp.url().includes('/api/v2/auth/login') && resp.request().method() === 'POST',
            { timeout: 30000 }
        ).catch(() => null),
        loginButton.click(),
    ]);

    if (response) {
        const status = response.status();
        console.log(`登录 API 响应状态: ${status}`);
        if (status >= 500) {
            console.log('登录 API 返回服务器错误，等待 5 秒后重试');
            await page.waitForTimeout(5000);
            // 重新点击登录按钮
            await loginButton.click();
            await page.waitForTimeout(3000);
        }
    }

    // 等待页面状态变化
    console.log('等待页面响应...');
    try {
        await Promise.race([
            page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 }),
            page.locator('.ant-card-head-title:has-text("二步验证")').waitFor({ timeout: 15000 }),
        ]);
    } catch {
        // 继续检查页面状态
    }
    await page.waitForTimeout(2000);

    // 检查是否有 Cloudflare 错误页面
    const pageContent = await page.content().catch(() => '');
    if (pageContent.includes('Worker exceeded resource limits') || pageContent.includes('cf-error-code')) {
        console.log('检测到 Cloudflare 资源限制错误，等待 10 秒后重试登录');
        await page.waitForTimeout(10000);
        // 重新导航到登录页并重试
        await page.goto(`${config.baseUrl}/login`, {
            timeout: config.navigationTimeout,
            waitUntil: 'domcontentloaded',
        });
        await page.waitForTimeout(2000);

        // 重新填写表单
        const emailInputRetry = page.getByPlaceholder('请输入邮箱地址');
        await emailInputRetry.clear();
        await emailInputRetry.fill(config.email);

        const passwordInputRetry = page.getByPlaceholder('请输入密码');
        await passwordInputRetry.clear();
        await passwordInputRetry.fill(config.password);

        const loginButtonRetry = page.getByRole('button', { name: '登录', exact: true });
        await loginButtonRetry.click();
        await page.waitForTimeout(3000);
    }

    // 检查是否有错误消息
    const errorMessage = page.locator('.ant-message-error, .ant-alert-error');
    const hasError = await errorMessage.isVisible().catch(() => false);
    if (hasError) {
        const errorText = await errorMessage.textContent().catch(() => '') || '';
        // 如果是 Cloudflare 错误，不立即抛出，等待重试
        if (!errorText.includes('Worker exceeded')) {
            throw new Error(`登录失败: ${errorText}`);
        }
    }

    // 检查是否需要 TOTP 验证
    // 检测方式：查找 "二步验证" 卡片标题或 TOTP 输入框
    const totpCard = page.locator('.ant-card-head-title:has-text("二步验证")');
    const totpInput = page.getByPlaceholder('请输入6位验证码');

    const hasTotpCard = await totpCard.isVisible({ timeout: 3000 }).catch(() => false);
    const hasTotpInput = await totpInput.isVisible({ timeout: 3000 }).catch(() => false);
    const needsTotp = hasTotpCard || hasTotpInput;

    console.log(`TOTP 检测: 卡片=${hasTotpCard}, 输入框=${hasTotpInput}`);

    if (needsTotp) {
        console.log('需要 TOTP 验证');
        // 确保 TOTP 验证码有足够的有效时间
        await waitForNextTotpCycle();

        // 生成并输入 TOTP
        const totpCode = generateTotp(config.totpSecret);
        console.log('输入 TOTP:', totpCode);
        await totpInput.fill(totpCode);

        // 点击验证按钮
        const verifyButton = page.getByRole('button', { name: '验证登录' });
        await verifyButton.click();

        // 等待验证完成
        await page.waitForTimeout(5000);
    } else {
        console.log('跳过 TOTP 验证（信任设备或直接登录成功）');
    }

    // 等待登录成功，跳转到非登录页
    // 使用 waitForURL 配合轮询检查，更稳定可靠
    try {
        // 先等待页面响应（给足够时间让登录请求完成）
        await page.waitForTimeout(3000);

        // 检查是否已经跳转（可能在等待期间已经跳转）
        const currentUrl = page.url();
        if (!currentUrl.includes('/login')) {
            console.log('登录成功，已跳转到:', currentUrl);
            return;
        }

        // 使用 waitForURL 等待跳转
        await page.waitForURL((url) => !url.pathname.includes('/login'), {
            timeout: 30000,
            waitUntil: 'domcontentloaded',
        });

        console.log('登录成功，已跳转到:', page.url());
    } catch (error: any) {
        // 如果超时，检查当前状态
        try {
            const finalUrl = page.url();

            // 如果已经不在登录页，说明登录成功
            if (!finalUrl.includes('/login')) {
                console.log('登录成功（通过 URL 检查）:', finalUrl);
                return;
            }

            // 检查页面内容，看是否有 Cloudflare 错误
            const pageContent = await page.content().catch(() => '');
            if (pageContent.includes('Worker exceeded resource limits') || pageContent.includes('cf-error-code')) {
                console.log('检测到 Cloudflare 资源限制错误，等待 15 秒后重试');
                await page.waitForTimeout(15000);
                // 重新导航到登录页
                await page.goto(`${config.baseUrl}/login`, {
                    timeout: config.navigationTimeout,
                    waitUntil: 'domcontentloaded',
                });
                // 重新执行登录流程（递归调用，但只重试一次）
                await page.waitForTimeout(2000);
                const emailInputRetry = page.getByPlaceholder('请输入邮箱地址');
                await emailInputRetry.clear();
                await emailInputRetry.fill(config.email);
                const passwordInputRetry = page.getByPlaceholder('请输入密码');
                await passwordInputRetry.clear();
                await passwordInputRetry.fill(config.password);
                const loginButtonRetry = page.getByRole('button', { name: '登录', exact: true });
                await loginButtonRetry.click();
                await page.waitForTimeout(5000);
                // 再次检查 URL
                const retryUrl = page.url();
                if (!retryUrl.includes('/login')) {
                    console.log('重试登录成功:', retryUrl);
                    return;
                }
            }

            // 检查是否有错误消息
            const errorMsg = await page.locator('.ant-message-error, .ant-alert-error').textContent().catch(() => '');

            // 检查登录按钮是否还存在
            const loginButton = page.getByRole('button', { name: '登录', exact: true });
            const isLoginButtonVisible = await loginButton.isVisible({ timeout: 2000 }).catch(() => false);

            if (!isLoginButtonVisible) {
                // 登录按钮消失，可能正在跳转，再等待一下
                await page.waitForTimeout(3000);
                const newUrl = page.url();
                if (!newUrl.includes('/login')) {
                    console.log('登录成功（登录按钮消失后）:', newUrl);
                    return;
                }
            }

            throw new Error(`登录失败，仍在登录页: ${finalUrl}${errorMsg ? ` - ${errorMsg}` : ''}`);
        } catch (checkError: any) {
            // 如果页面已关闭，抛出原始错误
            if (checkError.message && (checkError.message.includes('Target page') || checkError.message.includes('closed'))) {
                throw error;
            }
            throw checkError;
        }
    }

    // 最终验证
    const finalUrl = page.url();
    expect(finalUrl).not.toContain('/login');
}

/**
 * 登出
 * @param page - Playwright Page 对象
 * @param config - 线上环境配置
 */
export async function liveLogout(page: Page, config: LiveEnvConfig): Promise<void> {
    // 确保在已登录的页面
    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
        console.log('已在登录页，无需登出');
        return;
    }

    // 等待页面加载完成
    await page.waitForLoadState('networkidle');

    // 尝试多种方式找到用户下拉菜单
    const userDropdownSelectors = [
        '.user-dropdown',
        '.ant-dropdown-trigger',
        '[class*="user"]',
        'header .ant-avatar',
    ];

    let userDropdown = null;
    for (const selector of userDropdownSelectors) {
        try {
            const element = page.locator(selector).first();
            if (await element.isVisible({ timeout: 2000 }).catch(() => false)) {
                userDropdown = element;
                break;
            }
        } catch {
            continue;
        }
    }

    if (!userDropdown) {
        // 如果找不到下拉菜单，直接导航到登录页
        console.log('未找到用户下拉菜单，直接导航到登录页');
        await page.goto(`${config.baseUrl}/login`);
        return;
    }

    // 点击用户下拉菜单
    await userDropdown.click();

    // 等待下拉菜单出现
    await page.waitForSelector('.ant-dropdown-menu', { state: 'visible', timeout: 10000 });

    // 点击退出登录选项（文本是"退出登录"）
    const logoutOption = page.getByText('退出登录');
    await logoutOption.waitFor({ timeout: 5000 });
    await logoutOption.click();

    // 等待返回登录页
    await page.waitForURL(`${config.baseUrl}/login`, { timeout: config.navigationTimeout });
}

/**
 * 检查是否已登录
 * @param page - Playwright Page 对象
 * @returns 是否已登录
 */
export async function isLoggedIn(page: Page): Promise<boolean> {
    const currentUrl = page.url();
    return !currentUrl.includes('/login');
}

/**
 * 使用 token 直接设置认证状态（不通过 UI 登录）
 * 
 * ⚠️ 注意：此函数仅用于特殊场景，正常情况下应使用 liveLogin() 进行 UI 登录
 * 
 * @param page - Playwright Page 对象
 * @param token - JWT token
 * @param config - 线上环境配置
 * @param userInfo - 用户信息（可选）
 */
export async function setAuthToken(page: Page, token: string, config: LiveEnvConfig, userInfo?: any): Promise<void> {
    // 先导航到目标域名（localStorage 需要同源）
    await page.goto(config.baseUrl, {
        timeout: config.navigationTimeout,
        waitUntil: 'domcontentloaded',
    });

    // 获取缓存的用户信息或使用提供的用户信息
    const user = userInfo || getCachedUserInfo();

    if (!user) {
        throw new Error('用户信息未找到，无法设置 token');
    }

    // 设置 token 到 localStorage（模拟 zustand persist 存储）
    await page.evaluate(({ t, u }) => {
        try {
            const storageData = {
                state: {
                    token: t,
                    userInfo: u,
                    isAuthenticated: true,
                    collapsed: false,
                    themeMode: 'light'
                },
                version: 0
            };
            localStorage.setItem('caiwu-app-storage', JSON.stringify(storageData));
            console.log('Token 已设置到 localStorage');
        } catch (error) {
            console.error('设置 localStorage 失败:', error);
            throw error;
        }
    }, { t: token, u: user });

    // 刷新页面以确保 token 生效
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    console.log('Token 和用户信息已设置到 localStorage 并刷新页面');
}

/**
 * 确保已登录状态
 * 使用正常的 UI 登录流程（填写表单、输入 TOTP 等）
 * @param page - Playwright Page 对象
 * @param config - 线上环境配置
 */
export async function ensureLoggedIn(page: Page, config: LiveEnvConfig): Promise<void> {
    // 先检查当前页面是否已登录
    const currentUrl = page.url();
    if (!currentUrl.includes('/login')) {
        try {
            // 检查页面是否有用户菜单（登录后的标志）
            const userMenu = page.locator('.user-dropdown, .ant-dropdown-trigger').first();
            const hasUserMenu = await userMenu.isVisible({ timeout: 3000 }).catch(() => false);

            if (hasUserMenu) {
                console.log('检测到用户菜单，已登录，跳过登录步骤');
                await page.waitForTimeout(1000);
                return;
            }
        } catch {
            // 继续登录流程
        }
    }

    // 使用正常的 UI 登录流程（填写邮箱、密码，输入 TOTP 等）
    await liveLogin(page, config);
}









