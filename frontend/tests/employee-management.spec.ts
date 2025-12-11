import { test, expect } from '@playwright/test';
import { setupCommonMocks } from './utils/mock-api';

test('employee management - navigate to create employee page', async ({ page }) => {
    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
    page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

    // 1. Setup API Mocks
    await setupCommonMocks(page);

    // Mock permissions check endpoint
    await page.route('**/api/auth/current', async route => {
        await route.fulfill({
            json: {
                user: {
                    id: '1', name: 'Admin', email: 'admin@example.com', role: 'admin',
                    permissions: { hr: { employee: ['view', 'create', 'update', 'delete'] } },
                    position: {
                        function_role: 'hr',
                        code: 'hr_manager',
                        level: 1,
                        can_manage_subordinates: 1,
                        permissions: { hr: { employee: ['view', 'create', 'update', 'delete'] } }
                    }
                }
            }
        });
    });

    // Additional Master Data Mocks
    await page.route('**/api/org-departments*', async route => {
        await route.fulfill({ json: { results: [{ id: 'org1', name: 'Sales Team A', project_id: 'dept1', active: 1 }] } });
    });
    await page.route('**/api/positions*', async route => {
        await route.fulfill({ json: { results: [{ id: 'pos1', name: 'Sales Engineer', code: 'team_engineer', active: 1 }] } });
    });
    await page.route('**/api/currencies*', async route => {
        await route.fulfill({ json: { results: [{ code: 'CNY', name: 'RMB' }] } });
    });
    await page.route('**/api/hr/employees/summary*', async route => {
        await route.fulfill({ json: { total: 0, active: 0, probation: 0, resigned: 0 } });
    });
    await page.route('**/api/employees*', async route => {
        await route.fulfill({ json: { results: [], total: 0 } });
    });

    // 2. Login
    await page.goto('http://localhost:5173/login');
    await page.fill('input[id="email"]', 'admin@example.com');
    await page.fill('input[id="password"]', 'password');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/(my\/center|dashboard)/);

    // Wait for menu
    await expect(page.locator('.ant-menu')).toBeVisible();

    // 3. Navigate to Create Employee via Menu
    const hrMenu = page.locator('.ant-menu-submenu-title:has-text("人力资源")');
    if (await hrMenu.isVisible()) {
        const ariaExpanded = await hrMenu.getAttribute('aria-expanded');
        if (ariaExpanded !== 'true') {
            await hrMenu.click();
        }
    }

    await page.click('li.ant-menu-item:has-text("新建员工")');

    // 4. Verify Create Employee Page Loaded
    await expect(page.locator('h1').filter({ hasText: '新建员工' })).toBeVisible({ timeout: 10000 });

    // Verify form elements are present
    await expect(page.locator('input#name')).toBeVisible();
    await expect(page.locator('button').filter({ hasText: '保存' })).toBeVisible();
});
