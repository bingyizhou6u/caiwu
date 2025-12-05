import { test, expect } from '@playwright/test';

test('employee management - create employee flow', async ({ page }) => {
    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
    page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

    let createdPayload: any = null;

    // 1. Setup API Mocks
    await page.route('**/api/health', async route => route.fulfill({ json: { db: true } }));
    
    // Login Mock with SUPER PERMISSIONS to debug
    await page.route('**/api/auth/login-password', async route => {
        await route.fulfill({
            json: {
                token: 'mock-token',
                user: {
                    id: '1', name: 'Admin', email: 'admin@example.com', role: 'admin',
                    permissions: { 
                        hr: { 
                            employee: ['view', 'create', 'update', 'delete'] 
                        } 
                    },
                    position: { 
                        function_role: 'hr', 
                        code: 'hr_manager', 
                        level: 1,
                        can_manage_subordinates: 1,
                        // Ensure permissions structure matches EXACTLY what usePermissions hook expects
                        permissions: { 
                            hr: { 
                                employee: ['view', 'create', 'update', 'delete'] 
                            }
                        }
                    }
                }
            }
        });
    });

    // Mock permissions check endpoint if exists
    await page.route('**/api/auth/current', async route => {
        await route.fulfill({
            json: {
                user: {
                    id: '1', name: 'Admin', email: 'admin@example.com', role: 'admin',
                    permissions: { 
                        hr: { 
                            employee: ['view', 'create', 'update', 'delete'] 
                        } 
                    },
                    position: { 
                        function_role: 'hr', 
                        code: 'hr_manager', 
                        level: 1,
                        can_manage_subordinates: 1,
                        permissions: { 
                            hr: { 
                                employee: ['view', 'create', 'update', 'delete'] 
                            }
                        }
                    }
                }
            }
        });
    });

    // Master Data Mocks
    await page.route('**/api/departments*', async route => {
        console.log('MOCK HIT: departments');
        await route.fulfill({ json: { results: [{ id: 'dept1', name: 'Sales Dept' }] } });
    });
    await page.route('**/api/org-departments*', async route => {
        console.log('MOCK HIT: org-departments');
        await route.fulfill({ json: { results: [{ id: 'org1', name: 'Sales Team A', project_id: 'dept1', active: 1 }] } });
    });
    await page.route('**/api/positions*', async route => {
        console.log('MOCK HIT: positions');
        await route.fulfill({ json: { results: [{ id: 'pos1', name: 'Sales Engineer', code: 'team_engineer', active: 1 }] } });
    });
    // For cascading positions query
    await page.route('**/api/positions/available*', async route => {
        await route.fulfill({ json: { results: [{ id: 'pos1', name: 'Sales Engineer', code: 'team_engineer', active: 1 }] } });
    });
    await page.route('**/api/currencies*', async route => {
        await route.fulfill({ json: { results: [{ code: 'CNY', name: 'RMB' }] } });
    });
    // Add other missing mocks that might block rendering
    await page.route('**/api/hr/employees/summary*', async route => {
        await route.fulfill({ json: { total: 0, active: 0, probation: 0, resigned: 0 } });
    });

    // Employee List Mock
    await page.route('**/api/employees*', async route => {
        const url = route.request().url();
        // Avoid intercepting unrelated calls if they share prefix (unlikely with this pattern but good practice)
        if (route.request().method() === 'POST') {
            console.log('MOCK HIT: Create Employee');
            createdPayload = route.request().postDataJSON();
            console.log('Payload:', createdPayload);
            await route.fulfill({ json: { id: 'emp_new', ...createdPayload } });
        } else {
            console.log('MOCK HIT: List Employees');
            await route.fulfill({ json: { results: [], total: 0 } });
        }
    });


    // 2. Login
    await page.goto('http://localhost:5173/login');
    await page.fill('input[id="email"]', 'admin@example.com');
    await page.fill('input[id="password"]', 'password');
    await page.click('button[type="submit"]');
    // Login might redirect to dashboard first or my/center depending on logic
    // Let's just wait for either
    await expect(page).toHaveURL(/.*(\/my\/center|\/dashboard)/); 

    // Wait for menu to appear
    await expect(page.locator('.ant-menu')).toBeVisible();

    // 3. Navigate to Employee Management
    // Direct navigation seems to fail to load content sometimes?
    // Let's use UI navigation if direct fails.
    // But since we are mocking APIs, direct should work if app handles it.
    
    // Check if we are on dashboard
    if (page.url().includes('dashboard') || page.url().includes('my/center')) {
       // Navigate via menu
       await page.goto('http://localhost:5173/hr/employees');
    }
    
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();

    // 4. Open Create Modal
    // If we can't find the button, let's verify if we are even on the right page
    console.log('Current URL:', page.url());
    
    // Maybe the page is not loading data because useEmployees query is stuck?
    // Let's reload
    // await page.reload();
    // await page.waitForLoadState('networkidle');

    // Try to find ANY button on the page to debug
    // Wait for at least one button to have text
    try {
        await page.waitForFunction(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            return btns.some(b => b.textContent && b.textContent.includes('新建'));
        }, { timeout: 5000 });
    } catch (e) {
        console.log('Timeout waiting for button text');
    }

    const buttons = await page.evaluate(() => Array.from(document.querySelectorAll('button')).map(b => ({ text: b.innerText, html: b.outerHTML })));
    console.log('Buttons on page:', buttons.map(b => b.text));

    // Snapshot
    // console.log('Body HTML:', await page.innerHTML('body'));

    // If '新建员工' is not in the list, then we have a rendering issue
    if (!buttons.some(b => b.text && b.text.includes('新建员工'))) {
         // Maybe it's not a button tag? Antd sometimes uses a tag for links that look like buttons.
         const links = await page.evaluate(() => Array.from(document.querySelectorAll('a')).map(b => b.innerText));
         console.log('Links on page:', links);
         
         if (links.some(t => t.includes('新建员工'))) {
             await page.click('a:has-text("新建员工")');
             return; // Proceed
         }
         
         // If still not found, check for specific class
         const toolbar = await page.locator('.ant-pro-table-list-toolbar-right');
         if (await toolbar.isVisible()) {
             console.log('Toolbar visible:', await toolbar.innerHTML());
         }

        throw new Error(`"新建员工" button missing from DOM.`);
    }

    await page.click('button:has-text("新建员工")');
    await expect(page.locator('div.ant-modal-title:has-text("新建员工")')).toBeVisible({ timeout: 5000 });

    await expect(page.locator('div.ant-modal-title:has-text("新建员工")')).toBeVisible();
    await expect(page.locator('div.ant-modal-title:has-text("新建员工")')).toBeVisible();

    // 5. Fill Form
    // Basic Info
    await page.fill('input#name', 'John Doe');
    await page.fill('input#join_date', '2023-01-01');
    await page.keyboard.press('Enter');
    await page.fill('input#birthday', '1990-01-01');
    await page.keyboard.press('Enter');

    // Select Project (Department)
    await page.waitForTimeout(1000);
    // Use getByLabel if possible or fallback to specific selector
    const projectSelector = page.locator('.ant-form-item:has-text("项目归属/总部") .ant-select-selector');
    await projectSelector.waitFor({ state: 'visible' });
    await projectSelector.click();
    
    // Wait for dropdown
    // AntD options usually have title attribute matching the label
    const salesOption = page.getByTitle('Sales Dept').locator('div'); // Option usually wraps content in div or span
    // Or just getByText inside dropdown
    const option = page.locator('.ant-select-dropdown').getByText('Sales Dept');
    await expect(option).toBeVisible();
    await option.click();

    // Select Org Department
    await page.waitForTimeout(500);
    // Use ID to find the wrapper Form Item, then click the selector
    // Alternatively, use fill on the input directly if it allows search
    // Trying robust selector strategy: Label -> Form Item -> Selector
    const orgDeptSelector = page.locator('.ant-form-item').filter({ has: page.locator('label[for="org_department_id"]') }).locator('.ant-select-selector');
    await orgDeptSelector.click({ force: true });
    
    await expect(page.locator('.ant-select-item-option-content:has-text("Sales Team A")')).toBeVisible();
    await page.locator('.ant-select-item-option-content:has-text("Sales Team A")').click();

    // Select Position
    await page.waitForTimeout(500);
    const posSelector = page.locator('.ant-form-item').filter({ has: page.locator('label[for="position_id"]') }).locator('.ant-select-selector');
    await posSelector.click({ force: true });
    
    await expect(page.locator('.ant-select-item-option-content:has-text("Sales Engineer")')).toBeVisible();
    await page.locator('.ant-select-item-option-content:has-text("Sales Engineer")').click();

    // Switch to Contact Tab to fill email
    // Note: 'email' is in '系统账号' tab (CreateEmployeeModal) AND '联系方式' tab (EmployeeForm).
    // Let's try filling it in '联系方式' tab first as it is cleaner.
    await page.click('div[role="tab"]:has-text("联系方式")');
    await expect(page.locator('input#email').first()).toBeVisible(); // Might be multiple if both tabs render?
    await page.locator('input#email').first().fill('john@example.com');

    // Switch to Salary Tab
    await page.click('div[role="tab"]:has-text("薪资与补贴")');
    
    // Fill Probation Salary
    // Click '添加币种底薪' for Probation (first one)
    const addSalaryBtns = page.locator('button:has-text("添加币种底薪")');
    await addSalaryBtns.first().click();
    
    // Select Currency (Probation)
    // The Select inside Form.List likely has an id like probation_salaries_0_currency_id
    // Use fill to search and select, which is often more robust
    const probationCurrency = page.locator('[id$="_currency_id"]').first();
    await probationCurrency.click();
    await page.waitForTimeout(200); // Wait for dropdown animation
    // Try clicking the option directly
    const cnyOption = page.locator('.ant-select-item-option-content').filter({ hasText: 'CNY' }).first();
    await cnyOption.waitFor();
    await cnyOption.click();
    
    // Fill Amount (Probation)
    await page.locator('[id$="_amount_cents"]').first().fill('5000');

    // Fill Regular Salary
    // Click '添加币种底薪' for Regular (second one)
    await addSalaryBtns.nth(1).click();
    
    // Select Currency (Regular)
    // Need to distinguish from the first one. 
    // The regular salaries block is separate.
    // We can scope by the label "转正多币种底薪" parent Form.Item
    const regularBlock = page.locator('.ant-form-item', { hasText: '转正多币种底薪' });
    const regularCurrency = regularBlock.locator('[id$="_currency_id"]');
    await regularCurrency.click();
    await page.waitForTimeout(200);
    // Re-locate the option to ensure we get the visible one
    const cnyOptionRegular = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option-content').filter({ hasText: 'CNY' }).first();
    await cnyOptionRegular.waitFor();
    await cnyOptionRegular.click();
    
    // Fill Amount (Regular)
    await regularBlock.locator('[id$="_amount_cents"]').fill('6000');



    // 6. Submit
    // Debug: Print all buttons
    const buttonsSubmit = await page.locator('button').allTextContents();
    console.log('Buttons before submit:', buttonsSubmit);

    // Close any open dropdowns by clicking somewhere safe
    await page.locator('.ant-modal-title').click();
    await page.waitForTimeout(500);
    
    // Try finding the button by class if text fails, or be more specific
    // Note: Button text might contain spaces like '创 建'
    const submitBtn = page.locator('button.ant-btn-primary').filter({ hasText: /创\s*建/ });
    if (await submitBtn.isVisible()) {
        await submitBtn.click({ force: true });
    } else {
        console.log('Submit button not found!');
        // Fallback: try "确 定" or "确定"
        await page.click('button:has-text(/确\\s*定/)', { force: true });
    }

    // 7. Verify Success
    await expect(page.locator('div.ant-modal-title:has-text("新建员工")')).toBeHidden();
    // Usually a refresh happens, or message success
    // In actual app, list refreshes. Since mock list returns empty, we rely on API interception.

    expect(createdPayload).toBeTruthy();
    expect(createdPayload.name).toBe('John Doe');
    expect(createdPayload.email).toBe('john@example.com');
    expect(createdPayload.probation_salaries[0].amount_cents).toBe(5000);
    expect(createdPayload.regular_salaries[0].amount_cents).toBe(6000);
});

