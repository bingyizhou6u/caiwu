import { test, expect } from './fixtures';
import { setupCommonMocks } from './utils/mock-api';

test('navigate to employee management', async ({ page }) => {
    // Setup Common Mocks (Handles Login, Health, etc)
    await setupCommonMocks(page);

    // Mock employees API (v2)
    await page.route('**/api/v2/employees**', async route => {
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
    await expect(page).toHaveURL(/.*\/my\/center/);

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
