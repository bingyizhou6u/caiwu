import { test, expect } from '@playwright/test';
import fs from 'fs';

test('finance flows - create income flow', async ({ page }) => {
    // Debug: Log all routes
    await page.route('**', async route => {
        // console.log('ROUTE SAW:', route.request().url());
        await route.continue();
    });

    // Catch-all for API to prevent 401s from remote backend
    // Match any URL that contains /api/ but NOT /src/ (to avoid blocking source files like api/http.ts)
    await page.route('**/api/**', async route => {
        const url = route.request().url();
        if (url.includes('/src/') || url.includes('node_modules') || url.includes('@fs')) {
            return route.continue();
        }

        console.log('UNMOCKED API HIT:', url);
        try {
            fs.appendFileSync('debug_urls.log', url + '\n');
        } catch (e) { console.error('Log failed', e); }

        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results: [] }) });
    });    // CHECK if this assumption is true. Playwright reverses order?
    // "Routes are matched in reverse order of creation"
    // So we should register this catch-all FIRST (before specifics) so it is LAST in priority?
    // Wait, if I register it HERE (line 9), and specific mocks later...
    // Specific mocks (Latest) are matched FIRST.
    // If they match, they handle.
    // If they don't match, we fall back to THIS one (Older).
    // So this is the correct place for a fallback.

    // 1. Setup API Mocks

    // Upload Mock
    await page.route('**/api/upload/voucher', async route => {
        console.log('MOCK HIT: Upload (Simple Pattern)', route.request().url());
        await page.waitForTimeout(500);
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                url: 'http://mock/file.png',
                status: 'done',
                uid: 'mock-uid-1',
                name: 'voucher.png'
            })
        });
    });

    await page.route('**/api/health', async route => route.fulfill({ json: { db: true } }));

    // Login Mock
    await page.route('**/api/auth/login-password', async route => {
        await route.fulfill({
            json: {
                token: 'mock-token',
                user: {
                    id: '1', name: 'Admin', email: 'admin@example.com', role: 'admin',
                    permissions: [],
                    position: {
                        function_role: 'finance',
                        code: 'finance_manager',
                        // Add permissions for menu visibility
                        permissions: {
                            finance: {
                                flow: ['view', 'create'],
                                transfer: ['view'],
                                borrowing: ['view'],
                                repayment: ['view'],
                                ar: ['view'],
                                ap: ['view']
                            }
                        }
                    }
                }
            }
        });
    });

    // Master Data Mocks
    await page.route('**/api/accounts*', async route => {
        await route.fulfill({ json: { results: [{ id: 'acc1', name: 'Bank Account', type: 'bank', currency: 'CNY', active: 1 }] } });
    });
    await page.route('**/api/categories*', async route => {
        await route.fulfill({ json: { results: [{ id: 'cat1', name: 'Sales Income', kind: 'income', active: 1 }, { id: 'cat2', name: 'Office Expense', kind: 'expense', active: 1 }] } });
    });
    await page.route('**/api/departments*', async route => {
        await route.fulfill({ json: { results: [{ id: 'dept1', name: 'Sales Dept', active: 1 }] } });
    });
    await page.route('**/api/sites*', async route => {
        await route.fulfill({ json: { results: [] } });
    });
    await page.route('**/api/employees*', async route => {
        await route.fulfill({ json: { results: [] } });
    });
    await page.route('**/api/fixed-assets*', async route => {
        await route.fulfill({ json: { results: [] } });
    });
    await page.route('**/api/vendors*', async route => {
        await route.fulfill({ json: { results: [] } });
    });

    // Unified Flows API Mock (List + Create)
    let createdFlowPayload: any = null;
    await page.route('**/api/flows*', async route => {
        const method = route.request().method();
        const url = route.request().url();

        // Handle Create (POST)
        // Match exact /api/flows or with query params if any (ignoring)
        if (method === 'POST' && url.includes('/api/flows')) {
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

    // 3. Navigate to Flows
    // Wait for menu to load
    await expect(page.locator('.ant-menu').first()).toBeVisible();

    // Click parent menu '财务管理' if it's a submenu
    // Note: Antd menu might be nested.
    // Assuming '财务管理' is expanded or we click it.
    const financeMenu = page.locator('span:has-text("财务管理")');
    if (await financeMenu.isVisible()) {
        await financeMenu.click();
    }

    // Click '收支记账' or navigate directly
    // Ideally use data-testid or exact text match
    // Click '收支记账'
    // Antd Menu items are not <a> tags in this implementation
    const flowsLink = page.locator('.ant-menu-item').filter({ hasText: '收支记账' });
    await expect(flowsLink).toBeVisible();
    await flowsLink.click();

    await expect(page).toHaveURL(/.*\/finance\/flows/);
    await expect(page.locator('h1:has-text("收支记账")')).toBeVisible({ timeout: 10000 }); // Page title from PageContainer

    // DEBUG: Check if we have 401 somewhere
    page.on('response', resp => {
        if (resp.status() === 401) console.log('!!! RECEIVED 401 from:', resp.url());
    });

    // DEBUG: Check LocalStorage
    const storageState = await page.evaluate(() => localStorage.getItem('caiwu-app-storage'));
    console.log('STORAGE STATE:', storageState);

    // 4. Open Create Modal
    await page.click('button:has-text("新建记账")');
    await expect(page.locator('div[role="dialog"]')).toBeVisible();
    await expect(page.locator('div.ant-modal-title:has-text("新建记账")')).toBeVisible();

    // 5. Fill Form
    const modal = page.locator('.ant-modal-content');

    // Date is usually pre-filled with today.

    // Type (Select)
    // Default might be Income, but let's ensure.
    // Label '类型' id 'type'
    // Use force click to bypass any potential blocking overlays
    await page.click('#type', { force: true });
    await page.click('div[title="收入"]'); // Option title

    // Amount
    await page.fill('#amount', '1000');

    // Account
    // Robust selection: Find by label context WITHIN MODAL, click selector, wait for option, click option.
    const accountFormItem = modal.locator('.ant-form-item').filter({ hasText: '账户' });
    const accountSelect = accountFormItem.locator('.ant-select-selector');
    await accountSelect.click();

    // Wait for dropdown option
    const accountOption = page.locator('.ant-select-item-option-content').filter({ hasText: 'Bank Account' }).last();
    await expect(accountOption).toBeVisible();
    await accountOption.click();

    // Verify selection (text appears in selector)
    await expect(accountSelect).toContainText('Bank Account');

    // Give time for dropdown to close
    await page.waitForTimeout(300);

    // Category
    const categoryFormItem = modal.locator('.ant-form-item').filter({ hasText: '类别' });
    const categorySelect = categoryFormItem.locator('.ant-select-selector');
    await categorySelect.click({ force: true });

    const categoryOption = page.locator('.ant-select-item-option-content').filter({ hasText: 'Sales Income' }).last();
    await expect(categoryOption).toBeVisible();
    await categoryOption.click();

    await expect(categorySelect).toContainText('Sales Income');

    // Memo
    await page.fill('#memo', 'Test Income Flow');

    // Upload Voucher (Required)
    // Create a valid 1x1 PNG buffer to ensure client-side image processing works
    const buffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

    // Handle file chooser
    // Note: In Antd Upload, the input type=file might be hidden.
    // Playwright setInputFiles usually works on the input element even if hidden.
    // The input is likely inside the Upload component.
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
        name: 'voucher.png',
        mimeType: 'image/png',
        buffer: buffer
    });

    // Monitor requests
    page.on('request', req => console.log('>>', req.method(), req.url()));

    // Wait for the uploaded file item to appear
    // The app renders a custom list of buttons for uploaded vouchers
    try {
        await expect(page.locator('button:has-text("查看 1")')).toBeVisible({ timeout: 5000 });
    } catch (e) {
        console.log('Upload success indicator not found. Checking fallback...');
        // Fallback
        await expect(page.getByText('查看 1')).toBeVisible();
    }

    // 6. Submit
    await page.waitForTimeout(500); // Wait for animations

    // Check if submit button is disabled
    const submitBtn = page.locator('.ant-modal-footer button.ant-btn-primary');
    await expect(submitBtn).toBeEnabled();

    // Setup listener for response before clicking
    const createResponsePromise = page.waitForResponse(resp =>
        resp.url().includes('/api/flows') && resp.request().method() === 'POST' && resp.status() === 200
    );

    await submitBtn.click();

    // Check for validation errors
    await page.waitForTimeout(500); // Give time for validation to appear
    const errorNodes = page.locator('.ant-form-item-explain-error');
    if (await errorNodes.count() > 0) {
        const errors = await errorNodes.allTextContents();
        throw new Error(`Form Validation Errors: ${errors.join(', ')}`);
    }

    // Wait for the successful creation response
    await createResponsePromise;

    // 7. Verify Success
    // Expect modal to close
    await expect(page.locator('div.ant-modal-title:has-text("新建记账")')).toBeHidden();
    await expect(page.getByText('已新增')).toBeVisible();

    // Verify Payload
    expect(createdFlowPayload).toBeTruthy();
    expect(createdFlowPayload.amountCents).toBe(100000); // 1000 * 100
    expect(createdFlowPayload.type).toBe('income');
    expect(createdFlowPayload.voucherUrls).toHaveLength(1);
});

