/**
 * Playwright Global Setup
 * 通过 API 获取认证 token 并保存到 storageState
 * 供所有测试使用，避免重复登录
 */

import { chromium, FullConfig } from '@playwright/test';
import { loadLiveEnvConfig, validateConfig } from './config/live-env';
import { generateTotp, waitForNextTotpCycle } from './utils/totp';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STORAGE_STATE_PATH = path.join(__dirname, '.auth/storage-state.json');

async function globalSetup(config: FullConfig) {
    const liveConfig = loadLiveEnvConfig();
    const validation = validateConfig(liveConfig);

    // 如果配置不完整，跳过认证设置
    if (!validation.valid) {
        console.log('线上测试环境配置不完整，跳过全局认证设置');
        return;
    }

    console.log('🔐 执行全局认证设置...');

    try {
        // 1. 通过 API 获取 token
        const loginUrl = `${liveConfig.baseUrl}/api/v2/auth/login`;

        // 第一步：邮箱+密码登录
        const loginResponse = await fetch(loginUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: liveConfig.email,
                password: liveConfig.password,
            }),
        });

        if (!loginResponse.ok) {
            throw new Error(`登录失败: ${loginResponse.status}`);
        }

        const loginResponseData = await loginResponse.json();
        const loginData = loginResponseData.success ? loginResponseData.data : loginResponseData;

        let token: string;
        let user: any;

        if (loginData.needTotp) {
            // 等待 TOTP 周期，确保验证码有效
            await waitForNextTotpCycle();
            const totpCode = generateTotp(liveConfig.totpSecret);
            console.log('📱 TOTP 验证:', totpCode);

            const totpResponse = await fetch(loginUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: liveConfig.email,
                    password: liveConfig.password,
                    totp: totpCode,
                }),
            });

            if (!totpResponse.ok) {
                throw new Error(`TOTP 验证失败: ${totpResponse.status}`);
            }

            const totpData = (await totpResponse.json()).data || (await totpResponse.json());
            token = totpData.token;
            user = totpData.user;
        } else {
            token = loginData.token;
            user = loginData.user;
        }

        if (!token || !user) {
            throw new Error('未获取到有效的 token 或用户信息');
        }

        console.log('✅ Token 获取成功');

        // 2. 启动浏览器并设置 localStorage
        const browser = await chromium.launch();
        const context = await browser.newContext();
        const page = await context.newPage();

        // 导航到目标域名（localStorage 需要同源）
        await page.goto(liveConfig.baseUrl, { waitUntil: 'domcontentloaded' });

        // 设置认证状态到 localStorage
        await page.evaluate(({ t, u }) => {
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
        }, { t: token, u: user });

        // 3. 保存 storageState
        const authDir = path.dirname(STORAGE_STATE_PATH);
        if (!fs.existsSync(authDir)) {
            fs.mkdirSync(authDir, { recursive: true });
        }

        await context.storageState({ path: STORAGE_STATE_PATH });
        console.log('💾 认证状态已保存到:', STORAGE_STATE_PATH);

        await browser.close();
    } catch (error: any) {
        console.error('❌ 全局认证设置失败:', error.message);
        // 不抛出错误，让测试继续（会在各自的 beforeEach 中处理）
    }
}

export default globalSetup;
