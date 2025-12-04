import { test, expect } from '@playwright/test';

test('finance flows - create income flow', async ({ page }) => {
    // 1. Setup API Mocks
    await page.route('**/api/health', async route => route.fulfill({ json: { db: true } }));
    
    // Login Mock
    await page.route('**/api/auth/login-password', async route => {
        await route.fulfill({
            json: {
                token: 'mock-token',
                user: {
                    id: '1', name: 'Admin', email: 'admin@example.com', role: 'admin',
                    permissions: [],
                    position: { function_role: 'finance', code: 'finance_manager' }
                }
            }
        });
    });

    // Master Data Mocks
    await page.route('**/api/system/accounts*', async route => {
        await route.fulfill({ json: { results: [{ id: 'acc1', name: 'Bank Account', type: 'bank', currency: 'CNY' }] } });
    });
    await page.route('**/api/system/categories*', async route => {
        await route.fulfill({ json: { results: [{ id: 'cat1', name: 'Sales Income', kind: 'income' }, { id: 'cat2', name: 'Office Expense', kind: 'expense' }] } });
    });
    await page.route('**/api/system/departments*', async route => {
        await route.fulfill({ json: { results: [{ id: 'dept1', name: 'Sales Dept' }] } });
    });
    await page.route('**/api/system/sites*', async route => {
        await route.fulfill({ json: { results: [] } });
    });

    // Flows API Mocks (List)
    await page.route('**/api/finance/flows?*', async route => {
         await route.fulfill({ json: { 
             results: [], 
             total: 0, 
             summary: { total_income: 0, total_expense: 0 } 
         } });
    });

    // Upload Mock
    await page.route('**/api/upload/voucher', async route => {
        await route.fulfill({ 
            json: { url: 'http://mock-storage/voucher.webp' } 
        });
    });

    // Create Flow Mock
    let createdFlowPayload: any = null;
    await page.route('**/api/finance/flows', async route => {
        if (route.request().method() === 'POST') {
             createdFlowPayload = route.request().postDataJSON();
             await route.fulfill({ 
                 json: { 
                     id: 'flow1', 
                     ...createdFlowPayload,
                     created_at: Date.now() 
                 } 
             });
        } else {
             await route.continue();
        }
    });

    // 2. Login
    await page.goto('http://localhost:5173/login');
    await page.fill('input[id="email"]', 'admin@example.com');
    await page.fill('input[id="password"]', 'password');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*\/my\/center/); 

    // 3. Navigate to Flows
    // Wait for menu to load
    await expect(page.locator('div[role="menu"]')).toBeVisible();
    
    // Click parent menu '财务管理' if it's a submenu
    // Note: Antd menu might be nested. 
    // Assuming '财务管理' is expanded or we click it.
    await page.click('span:has-text("财务管理")');
    await page.click('a[href="/finance/flows"]'); // Or click text '收支记账'
    
    await expect(page).toHaveURL(/.*\/finance\/flows/);
    await expect(page.locator('h1:has-text("记账管理")')).toBeVisible({ timeout: 10000 }); // Page title from PageContainer

    // 4. Open Create Modal
    await page.click('button:has-text("新建记账")');
    await expect(page.locator('div[role="dialog"]')).toBeVisible();
    await expect(page.locator('div.ant-modal-title:has-text("新建记账")')).toBeVisible();

    // 5. Fill Form
    // Date is usually pre-filled with today.
    
    // Type (Select)
    // Default might be Income, but let's ensure.
    // The Select component in Antd is tricky. Use fill or click option.
    // Label '类型' id 'type'
    await page.click('#type');
    await page.click('div[title="收入"]'); // Option title
    
    // Amount
    await page.fill('#amount', '1000');
    
    // Account
    await page.click('#account_id');
    // Wait for dropdown
    await expect(page.locator('div[title="Bank Account"]')).toBeVisible();
    await page.click('div[title="Bank Account"]');

    // Category
    await page.click('#category_id');
    await expect(page.locator('div[title="Sales Income"]')).toBeVisible();
    await page.click('div[title="Sales Income"]');

    // Memo
    await page.fill('#memo', 'Test Income Flow');

    // Upload Voucher (Required)
    // Create a dummy file
    const buffer = Buffer.from('fake-image-content');
    
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

    // Wait for upload success message or UI update
    await expect(page.getByText('凭证上传成功')).toBeVisible();

    // 6. Submit
    await page.click('button:has-text("确 定")'); // Modal OK button usually says '确 定' or 'OK'

    // 7. Verify Success
    // Expect modal to close
    await expect(page.locator('div.ant-modal-title:has-text("新建记账")')).toBeHidden();
    await expect(page.getByText('已新增')).toBeVisible();

    // Verify Payload
    expect(createdFlowPayload).toBeTruthy();
    expect(createdFlowPayload.amount_cents).toBe(100000); // 1000 * 100
    expect(createdFlowPayload.type).toBe('income');
    expect(createdFlowPayload.voucher_urls).toHaveLength(1);
});

