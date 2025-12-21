/**
 * 线上测试环境 - 认证模块
 * 
 * 运行命令：npx playwright test tests/live-env-auth.spec.ts --workers=1
 */

import { test, expect } from '@playwright/test';
import { config, setupModuleTests, teardownModuleTests } from './live-env-shared';
import { liveLogin, liveLogout } from './utils/live-login';

test.describe.serial('线上环境测试 - 认证模块', () => {
    test.beforeEach(async () => {
        test.skip(!config.totpSecret, 'TOTP Secret 未配置');
    });

    test.beforeAll(async () => {
        await setupModuleTests();
    });

    test.afterAll(async () => {
        teardownModuleTests();
    });

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

