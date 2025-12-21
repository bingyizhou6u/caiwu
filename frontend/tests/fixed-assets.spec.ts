import { test, expect } from './fixtures';
import { setupCommonMocks } from './utils/mock-api';

test('fixed assets - create new asset', async ({ page }) => {
    // 1. Setup Common Mocks
    await setupCommonMocks(page);

    // 2. Mock Fixed Assets API
    let createdAssetPayload: any = null;
    await page.route('**/api/v2/fixed-assets*', async route => {
        const method = route.request().method();
        const url = route.request().url();

        // Create
        if (method === 'POST') {
            createdAssetPayload = route.request().postDataJSON();
            await route.fulfill({
                json: {
                    id: 'fa-1',
                    ...createdAssetPayload,
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
    await page.fill('input[id="email"]', 'admin@example.com');
    await page.fill('input[id="password"]', 'password');
    await page.click('button[type="submit"]');

    // 4. Navigate to Fixed Assets
    await page.goto('http://localhost:5173/assets/list');
    await expect(page.locator('h1').filter({ hasText: '资产管理' })).toBeVisible({ timeout: 10000 });

    // 5. Click "New Asset" (新建资产)
    await page.click('button:has-text("新建资产")');

    // 6. Fill Form
    const modal = page.locator('.ant-modal-content:visible').filter({ hasText: '新建资产' });
    await expect(modal).toBeVisible();

    // Asset Code
    await modal.locator('input#assetCode').fill('FA-2024-001');

    // Name
    await modal.locator('input#name').fill('MacBook Pro M3');

    // Purchase Price
    await modal.locator('input#purchasePriceCents').fill('15000');

    // Currency (Select)

    // Debug: Ensure dropdown opens and type to search
    await modal.locator('#currency').locator('xpath=./ancestor::div[contains(@class, "ant-select-selector")]').click();
    await modal.locator('#currency').fill('CNY');
    await page.keyboard.press('Enter');

    // Status (Select) - Default is in_use, checking just in case or leaving default.
    // The code sets default `status: 'in_use'`, so we strictly don't need to touch it unless we want to change it.

    // 7. Submit
    await page.locator('.ant-modal-footer .ant-btn-primary').click();

    // 8. Verify Success
    await expect(page.getByText('创建成功')).toBeVisible();

    // 9. Verify Payload
    await expect(async () => {
        expect(createdAssetPayload).toBeTruthy();
        expect(createdAssetPayload.assetCode).toBe('FA-2024-001');
        expect(createdAssetPayload.name).toBe('MacBook Pro M3');
        expect(createdAssetPayload.purchasePriceCents).toBe(15000); // 15000 input usually means 15000 if not parsed to cents? 
        // Wait, inputNumber is usually handled by form. If page treats it as unit, backend expects cents? 
        // Logic: `inputNumber` value is typically the unit value. Frontend `handleCreate` might multiply?
        // Let's check logic: `useCreateFixedAsset` sends values directly. 
        // Except typical `AmountInput` components convert. 
        // Here it uses `InputNumber`. So if I type 15000, it sends 15000. 
        // If the field name is `purchasePriceCents`, I should type raw cents? 
        // Or if it's meant to be user-friendly, usually people type Dollars. 
        // Inspection of `FixedAssetsManagementPage.tsx` shows:
        // `<InputNumber ... placeholder="请输入购买价格" />` (Form Item name="purchasePriceCents")
        // If the field name is `purchasePriceCents`, AntD Form collects it as that.
        // So typing 15000 means 15000 cents? (150 Yuan). Or 15000 Yuan?
        // There is no auto-conversion logic in `handleCreate`:
        // `await createAsset({ ...values })`
        // So users enter cents? That's unlikely for UX. 
        // But for E2E, I simulate user input. If I type 15000, payload gets 15000.
        // I will assert 15000.
    }).toPass();
});
