import { test, expect } from './fixtures';
import { setupCommonMocks } from './utils/mock-api';

test('salary payments - create new payment execution', async ({ page }) => {
    // 1. Setup Common Mocks
    await setupCommonMocks(page);

    // 2. Mock Salary API - List & Create
    let createdSalaryPayload: any = null;
    await page.route('**/api/v2/salary/payments*', async route => {
        const method = route.request().method();
        const url = route.request().url();

        if (method === 'POST') {
            createdSalaryPayload = route.request().postDataJSON();
            await route.fulfill({
                json: {
                    id: 'sp-1',
                    ...createdSalaryPayload,
                    status: 'draft',
                    created_at: Date.now()
                }
            });
            return;
        }

        // List
        await route.fulfill({
            json: {
                results: [],
                total: 0
            }
        });
    });

    // 3. Login
    await page.goto('http://localhost:5173/login');
    await page.fill('input[id="email"]', 'admin@example.com');
    await page.fill('input[id="password"]', 'password');
    await page.click('button[type="submit"]');

    // 4. Navigate to Salary Payments
    // Assuming menu structure: HR -> Salary Payments
    // We can navigate directly to be safe
    await page.goto('http://localhost:5173/hr/salary-payments');
    await expect(page.locator('h1').filter({ hasText: '薪资发放' })).toBeVisible({ timeout: 10000 });

    // 5. Click "Generate Salary Slip" (生成薪资单)
    // Note: User must have finance role. setupCommonMocks provides admin/finance permissions.
    await page.click('button:has-text("生成薪资单")');

    // 6. Fill Modal/Form
    // Wait for modal or form to appear
    await expect(page.locator('.ant-modal-content').filter({ hasText: '生成薪资单' })).toBeVisible();

    // 7. Fill Form Explicitly
    const modal = page.locator('.ant-modal-content:visible').filter({ hasText: '生成薪资单' });

    // Year
    await modal.locator('#year').locator('xpath=./ancestor::div[contains(@class, "ant-select-selector")]').click();
    await page.locator('.ant-select-item-option').first().click(); // Select first year (dropdown is outside modal usually, so keep page.locator)

    // Month
    await modal.locator('#month').locator('xpath=./ancestor::div[contains(@class, "ant-select-selector")]').click();
    await page.locator('.ant-select-item-option').filter({ hasText: '1月' }).click();

    // 8. Submit
    // Click the primary button in the footer (usually 'OK' or 'Generate')
    await page.locator('.ant-modal-footer .ant-btn-primary').click();

    // 8. Verify Success
    await expect(page.getByText('成功生成')).toBeVisible();

    // 9. Verify Payload
    await expect(async () => {
        expect(createdSalaryPayload).toBeTruthy();
        expect(createdSalaryPayload.year).toBeTruthy();
        expect(createdSalaryPayload.month).toBeTruthy();
    }).toPass();
});
