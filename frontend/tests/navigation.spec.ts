import { test, expect } from '@playwright/test';

test('navigate to employee management', async ({ page }) => {
    // Mock health check
    await page.route('**/api/health', async route => {
        await route.fulfill({ json: { checks: { db: true }, status: 'healthy' } });
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
                    permissions: [],
                    position: {
                        code: 'hq_manager',
                        permissions: {
                            hr: {
                                employee: ['view']
                            }
                        }
                    }
                }
            }
        });
    });

    // Mock employees API
    await page.route('**/api/employees**', async route => {
        await route.fulfill({
            json: {
                results: [],
                total: 0
            }
        });
    });

    // Login
    await page.goto('http://localhost:5173/login');
    await page.fill('input[id="email"]', 'admin@example.com');
    await page.fill('input[id="password"]', 'password');
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeEnabled({ timeout: 10000 });
    await submitButton.click();
    await expect(page).toHaveURL(/.*\/dashboard/);

    // Navigate to Employee Management
    // Click on "HR" or "Employees" in the menu
    // Note: Menu might need to be expanded.
    // Assuming "人事管理" (HR) -> "员工管理" (Employees)

    // Wait for menu to be visible
    await expect(page.getByText('人力资源')).toBeVisible();
    await page.getByText('人力资源').click();

    await expect(page.getByText('人员管理')).toBeVisible();
    await page.getByText('人员管理').click();

    // Verify URL and Page Title
    await expect(page).toHaveURL(/.*\/hr\/employees/);
    await expect(page.getByText('人员管理')).toBeVisible();
});
