
import { test, expect } from './fixtures';
import { setupCommonMocks } from './utils/mock-api';

test('reports - view dashboard stats', async ({ page }) => {
    // 1. Setup API Mocks
    await setupCommonMocks(page);

    // 2. Login
    await page.goto('http://localhost:5173/login');
    await page.fill('input[id="email"]', 'admin@example.com');
    await page.fill('input[id="password"]', 'password');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*(\/my\/center|\/dashboard)/);

    // 3. Navigate to My Center (个人中心)
    if (!page.url().includes('/my/center')) {
        await page.goto('http://localhost:5173/my/center');
    }

    // 4. Verify Dashboard Page Content (个人中心页面)
    await expect(page.getByText('个人信息')).toBeVisible();
    await expect(page.getByText('姓名')).toBeVisible();
    await expect(page.getByText('邮箱')).toBeVisible();
    
    // Verify user info is displayed (use more specific selectors to avoid strict mode violation)
    await expect(page.locator('.ant-descriptions-item-content').filter({ hasText: 'Admin' }).first()).toBeVisible();
    await expect(page.getByText('admin@example.com')).toBeVisible();
});
