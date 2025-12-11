import { test, expect } from '@playwright/test';

test('login flow', async ({ page }) => {
    // Mock health check
    await page.route('**/api/health', async route => {
        await route.fulfill({ json: { db: true } });
    });

    // Mock login API
    await page.route('**/api/auth/login-password', async route => {
        await route.fulfill({
            json: {
                token: 'mock-token',
                user: {
                    id: '1',
                    name: 'Admin',
                    email: 'admin@example.com',
                    role: 'admin',
                    permissions: []
                }
            }
        });
    });

    await page.goto('http://localhost:5173/login');

    // Expect title to contain the app name or login
    await expect(page).toHaveTitle(/AR公司/);

    // Fill login form
    await page.fill('input[id="email"]', 'admin@example.com');
    await page.fill('input[id="password"]', 'password');

    // Wait for health check to pass and button to be enabled
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeEnabled({ timeout: 10000 });
    await submitButton.click();

    // Expect to be redirected to dashboard
    await expect(page).toHaveURL(/.*\/dashboard/);

    // Check for dashboard element
    await expect(page.getByText('工作台')).toBeVisible();
});
