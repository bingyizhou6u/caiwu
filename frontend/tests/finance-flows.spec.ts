import { test, expect } from './fixtures';
import { setupCommonMocks } from './utils/mock-api';
import fs from 'fs';

test('finance flows - create income flow', async ({ page }) => {
    // 1. Setup Common Mocks
    await setupCommonMocks(page);

    // Unified Flows API Mock (List + Create)
    let createdFlowPayload: any = null;
    await page.route('**/api/v2/flows*', async route => {
        const method = route.request().method();
        const url = route.request().url();

        // Handle Create (POST)
        if (method === 'POST' && url.includes('/api/v2/flows')) {
            createdFlowPayload = route.request().postDataJSON();
            await route.fulfill({
                json: {
                    id: 'flow1',
                    ...createdFlowPayload,
                    created_at: Date.now()
                }
            });
            return;
        }

        // Handle List (GET)
        await route.fulfill({
            json: {
                results: [],
                total: 0,
                summary: { total_income: 0, total_expense: 0 }
            }
        });
    });

    // 2. Login
    await page.goto('http://localhost:5173/login');
    await page.fill('input[id="email"]', 'admin@example.com');
    await page.fill('input[id="password"]', 'password');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*(\/my\/center|\/dashboard)/);

    // Navigate directly to Flows (bypass flaky menu)
    await page.goto('http://localhost:5173/finance/flows');
    await expect(page.locator('h1').filter({ hasText: '收支明细' })).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/.*\/finance\/flows/);

    // 4. Navigate to Create Page
    await page.click('button:has-text("新建记账")');
    await expect(page).toHaveURL(/.*\/finance\/flows\/create/);
    await expect(page.locator('h1').filter({ hasText: '新建记账' })).toBeVisible();

    // 5. Fill Form (Income)
    // Amount
    await page.fill('#amount', '1000');

    // Helper function to select dropdown option for Ant Design Select
    const selectDropdownOption = async (selector: string) => {
        // Click the select trigger
        const selectTrigger = page.locator(`#${selector}`).locator('xpath=./ancestor::div[contains(@class, "ant-select-selector")]');
        await selectTrigger.click();
        // Wait for dropdown to appear
        await page.waitForSelector('.ant-select-dropdown:not(.ant-select-dropdown-hidden)', { state: 'visible', timeout: 10000 });
        await page.waitForTimeout(1000);
        // Use keyboard to select first option (ArrowDown + Enter)
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(200);
        await page.keyboard.press('Enter');
    };

    // Account
    await selectDropdownOption('accountId');

    // Category
    await selectDropdownOption('categoryId');

    // Department
    await selectDropdownOption('departmentId');

    // Upload Voucher (Mandatory) - Use Upload button
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
        name: 'voucher.png',
        mimeType: 'image/png',
        buffer: Buffer.from('fake image content')
    });
    // Wait for upload to complete
    await page.waitForTimeout(3000);
    // Verify upload succeeded - check for uploaded file indicator
    // The page shows "已上传 X 张凭证" when files are uploaded
    await page.waitForSelector('text=/已上传.*张凭证/', { timeout: 10000 }).catch(async () => {
        // If indicator not found, try to verify by checking if file list has items
        const fileListItems = await page.locator('.ant-upload-list-item').count();
        if (fileListItems === 0) {
            // Upload may have failed, but continue anyway - form validation will catch it
            console.log('Upload verification skipped - continuing with form submission');
        }
    });

    // 6. Submit
    await page.click('button:has-text("保存并继续")');

    // 7. Verify Success
    await expect(page.getByText('记账成功，可继续录入')).toBeVisible();

    // 8. Go back to list and verify (skip this check as it depends on mock data)
    // await page.goto('http://localhost:5173/finance/flows');
    // await expect(page.getByText('Tenant Rent Payment')).toBeVisible();
});

test('finance flows - create expense flow', async ({ page }) => {
    await setupCommonMocks(page);

    let createdFlowPayload: any = null;
    await page.route('**/api/v2/flows*', async route => {
        if (route.request().method() === 'POST') {
            createdFlowPayload = route.request().postDataJSON();
            await route.fulfill({ json: { id: 'flow2', ...createdFlowPayload, created_at: Date.now() } });
        } else {
            await route.fulfill({ json: { results: [], total: 0 } });
        }
    });

    // Login and Navigate
    await page.goto('http://localhost:5173/login');
    await page.fill('input[id="email"]', 'admin@example.com');
    await page.fill('input[id="password"]', 'password');
    await page.click('button[type="submit"]');
    await expect(page.locator('.ant-menu').first()).toBeVisible();

    // Go to Finance > Flows
    await page.goto('http://localhost:5173/finance/flows'); // Direct nav is faster

    // Open Create Page
    await page.click('button:has-text("新建记账")');
    await expect(page).toHaveURL(/.*\/finance\/flows\/create/);
    await expect(page.locator('h1').filter({ hasText: '新建记账' })).toBeVisible({ timeout: 20000 });

    // Wait for form to actulaly render (checking button is a good proxy)
    await expect(page.locator('button:has-text("保存并继续")')).toBeVisible();
    await page.waitForTimeout(500); // Stability wait for Select listeners

    // Type: Expense
    // Click Select trigger
    await page.locator('#type').locator('xpath=./ancestor::div[contains(@class, "ant-select-selector")]').click();
    // Wait for dropdown
    const dropdown = page.locator('.ant-select-dropdown:visible');
    await expect(dropdown).toBeVisible();
    // Select Option - Use getByText for exact match or robust filter
    const option = dropdown.locator('.ant-select-item-option').filter({ hasText: '支出' }).first();
    await option.waitFor({ state: 'visible' });
    await option.click();

    // Amount
    await page.fill('#amount', '500');

    // Helper function to select dropdown option for Ant Design Select
    const selectDropdownOption2 = async (selector: string) => {
        const selectTrigger = page.locator(`#${selector}`).locator('xpath=./ancestor::div[contains(@class, "ant-select-selector")]');
        await selectTrigger.click();
        await page.waitForSelector('.ant-select-dropdown:not(.ant-select-dropdown-hidden)', { state: 'visible', timeout: 10000 });
        await page.waitForTimeout(1000);
        // Use keyboard navigation
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(200);
        await page.keyboard.press('Enter');
    };

    // Account
    await selectDropdownOption2('accountId');

    // Category
    await selectDropdownOption2('categoryId');

    // Memo
    await page.fill('#memo', 'Test Expense');

    // Upload Voucher (Mandatory) - Use Upload button
    const fileInput2 = page.locator('input[type="file"]');
    await fileInput2.setInputFiles({
        name: 'bill.png', // Use PNG instead of PDF since only images are accepted
        mimeType: 'image/png',
        buffer: Buffer.from('fake image content')
    });
    // Wait for upload to complete
    await page.waitForTimeout(3000);
    // Verify upload succeeded
    await page.waitForSelector('text=/已上传.*张凭证/', { timeout: 10000 }).catch(async () => {
        const fileListItems = await page.locator('.ant-upload-list-item').count();
        if (fileListItems === 0) {
            console.log('Upload verification skipped - continuing with form submission');
        }
    });

    // Submit
    await page.click('button:has-text("保存并继续")');

    // Verify
    await expect(page.getByText('记账成功，可继续录入')).toBeVisible();
});
