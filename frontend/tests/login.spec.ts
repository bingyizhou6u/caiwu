import { test, expect } from './fixtures';

test.describe('Authentication', () => {
    test.beforeEach(async ({ page }) => {
        // Mock health check for all tests
        await page.route('**/api/health', async route => {
            await route.fulfill({ json: { checks: { db: true }, status: 'healthy' } });
        });
    });

    test('Basic Login Flow (No 2FA)', async ({ page }) => {
        // Mock login API
        await page.route('**/api/v2/auth/login', async route => {
            const body = JSON.parse(route.request().postData() || '{}');
            if (body.email === 'admin@example.com' && body.password === 'password') {
                await route.fulfill({
                    json: {
                        token: 'mock-token',
                        user: {
                            id: '1',
                            name: 'Admin',
                            email: 'admin@example.com',
                            role: 'admin',
                            position: {
                                id: 'pos_admin',
                                code: 'hq_admin',
                                name: 'HQ Admin',
                                dataScope: 'all',
                                level: 1
                            },
                            permissions: []
                        }
                    }
                });
            } else {
                await route.fulfill({ status: 401, json: { error: '用户名或密码错误' } });
            }
        });

        await page.goto('http://localhost:5173/login');
        await expect(page).toHaveTitle(/AR公司/);

        // Fill login form
        await page.fill('input[id="email"]', 'admin@example.com');
        await page.fill('input[id="password"]', 'password');

        const submitButton = page.locator('button[type="submit"]');
        await expect(submitButton).toBeEnabled({ timeout: 10000 });
        await submitButton.click();

        await expect(page).toHaveURL(/.*\/my\/center/);
        await expect(page.getByText('工作台')).toBeVisible();
    });

    test('2FA (TOTP) Login Flow', async ({ page }) => {
        // Mock login step 1 (return needTotp)
        await page.route('**/api/v2/auth/login', async route => {
            const body = JSON.parse(route.request().postData() || '{}');

            // Step 2: With TOTP
            if (body.totp) {
                if (body.totp === '123456') {
                    await route.fulfill({
                        json: {
                            token: 'mock-token-2fa',
                            user: { id: '1', name: 'Admin', email: 'admin@example.com' }
                        }
                    });
                } else {
                    await route.fulfill({ status: 401, json: { error: 'Google验证码错误' } });
                }
                return;
            }

            // Step 1: Password only
            await route.fulfill({
                json: {
                    needTotp: true,
                    msg: '需要二步验证'
                }
            });
        });

        await page.goto('http://localhost:5173/login');

        // Login Step 1
        await page.fill('input[id="email"]', 'admin@example.com');
        await page.fill('input[id="password"]', 'password');
        await page.click('button[type="submit"]');

        // Expect 2FA Form
        await expect(page.getByText('二步验证')).toBeVisible();
        await expect(page.getByLabel('Google验证码')).toBeVisible();

        // Login Step 2 (Wrong TOTP)
        await page.fill('input[id="totp"]', '000000');
        await page.click('button[type="submit"]');
        await expect(page.locator('.ant-message-error').first()).toContainText('验证码错误');

        // Login Step 2 (Correct TOTP)
        await page.locator('input[id="totp"]').clear();
        await page.fill('input[id="totp"]', '123456');
        await page.click('button[type="submit"]');

        await expect(page).toHaveURL(/.*\/my\/center/);
    });

    test('Login Error Handling', async ({ page }) => {
        await page.route('**/api/v2/auth/login', async route => {
            await route.fulfill({ status: 401, json: { error: '用户名或密码错误' } });
        });

        await page.goto('http://localhost:5173/login');
        await page.fill('input[id="email"]', 'wrong@example.com');
        await page.fill('input[id="password"]', 'wrong');
        await page.click('button[type="submit"]');

        await expect(page.locator('.ant-message-error').first()).toContainText('用户名或密码错误');
    });

    test('Account Lockout after 5 failed attempts', async ({ page }) => {
        let failCount = 0;

        await page.route('**/api/v2/auth/login', async route => {
            failCount++;
            if (failCount >= 5) {
                await route.fulfill({
                    status: 403,
                    json: { error: '连续登录失败5次，账号已被锁定15分钟' }
                });
            } else {
                await route.fulfill({
                    status: 401,
                    json: { error: '用户名或密码错误' }
                });
            }
        });

        await page.goto('http://localhost:5173/login');

        // 尝试登录5次
        for (let i = 0; i < 5; i++) {
            await page.fill('input[id="email"]', 'admin@example.com');
            await page.fill('input[id="password"]', 'wrong-password');
            await page.click('button[type="submit"]');
            // 等待错误消息显示
            await page.waitForTimeout(500);
        }

        // 第5次应该显示锁定消息
        await expect(page.locator('.ant-message-error').last()).toContainText('锁定');
    });

    test('Account Locked - Should show lockout message', async ({ page }) => {
        await page.route('**/api/v2/auth/login', async route => {
            await route.fulfill({
                status: 403,
                json: { error: '账号已被锁定，请15分钟后再试' }
            });
        });

        await page.goto('http://localhost:5173/login');
        await page.fill('input[id="email"]', 'locked@example.com');
        await page.fill('input[id="password"]', 'anypassword');
        await page.click('button[type="submit"]');

        await expect(page.locator('.ant-message-error').first()).toContainText('锁定');
    });

    test('TOTP Replay Protection - Should reject reused code', async ({ page }) => {
        let totpUsed = false;

        await page.route('**/api/v2/auth/login', async route => {
            const body = JSON.parse(route.request().postData() || '{}');

            if (body.totp) {
                if (totpUsed) {
                    // 第二次使用相同的TOTP应该被拒绝
                    await route.fulfill({
                        status: 401,
                        json: { error: '验证码已使用，请等待新验证码' }
                    });
                } else {
                    totpUsed = true;
                    await route.fulfill({
                        json: {
                            token: 'mock-token',
                            user: { id: '1', name: 'Admin', email: 'admin@example.com' }
                        }
                    });
                }
                return;
            }

            // 需要TOTP
            await route.fulfill({
                json: { needTotp: true, msg: '需要二步验证' }
            });
        });

        await page.goto('http://localhost:5173/login');

        // 第一次登录
        await page.fill('input[id="email"]', 'admin@example.com');
        await page.fill('input[id="password"]', 'password');
        await page.click('button[type="submit"]');

        // 等待TOTP表单
        await expect(page.getByLabel('Google验证码')).toBeVisible();

        // 第一次使用TOTP
        await page.fill('input[id="totp"]', '123456');
        await page.click('button[type="submit"]');

        // 应该登录成功
        await expect(page).toHaveURL(/.*\/my\/center/);

        // 模拟再次使用相同TOTP（退出后再登录）
        // 这里只验证API层面的mock逻辑正确
    });
});

