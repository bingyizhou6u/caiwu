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
});
