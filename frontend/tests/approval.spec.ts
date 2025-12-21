import { test, expect } from './fixtures';
import { setupCommonMocks } from './utils/mock-api';

test('approval flow - comprehensive workflow (leaves, reimbursements)', async ({ page }) => {
    // 1. Setup Common Mocks
    await setupCommonMocks(page);

    // 2. Mock Approval API - List Pending
    await page.route('**/api/v2/approvals/pending*', async route => {
        await route.fulfill({
            json: {
                leaves: [
                    {
                        id: 'leave-approve',
                        employeeName: 'John Doe',
                        departmentName: 'Sales',
                        leaveType: 'annual',
                        startDate: '2023-01-01',
                        endDate: '2023-01-02',
                        days: 2,
                        reason: 'Vacation',
                        createdAt: Date.now()
                    },
                    {
                        id: 'leave-reject',
                        employeeName: 'Jane Smith',
                        departmentName: 'HR',
                        leaveType: 'sick',
                        startDate: '2023-02-01',
                        endDate: '2023-02-02',
                        days: 1,
                        reason: 'Sick Leave',
                        createdAt: Date.now()
                    }
                ],
                reimbursements: [
                    {
                        id: 'reimb-approve',
                        employeeName: 'Bob Jones',
                        departmentName: 'Tech',
                        expenseType: 'travel',
                        amountCents: 10000, // 100.00
                        currency_symbol: '¥',
                        expenseDate: '2023-03-01',
                        description: 'Business Trip',
                        createdAt: Date.now()
                    },
                    {
                        id: 'reimb-reject',
                        employeeName: 'Alice Brown',
                        departmentName: 'Marketing',
                        expenseType: 'meal',
                        amountCents: 5000, // 50.00
                        currency_symbol: '¥',
                        expenseDate: '2023-03-02',
                        description: 'Client Dinner',
                        createdAt: Date.now()
                    }
                ],
                counts: {
                    leaves: 2,
                    reimbursements: 2
                }
            }
        });
    });

    // Mock Actions
    // Leaves
    await page.route('**/api/v2/approvals/leave/leave-approve/approve', async route => route.fulfill({ json: { success: true } }));
    await page.route('**/api/v2/approvals/leave/leave-reject/reject', async route => route.fulfill({ json: { success: true } }));

    // Reimbursements
    await page.route('**/api/v2/approvals/reimbursement/reimb-approve/approve', async route => route.fulfill({ json: { success: true } }));
    await page.route('**/api/v2/approvals/reimbursement/reimb-reject/reject', async route => route.fulfill({ json: { success: true } }));


    // 3. Login
    await page.goto('http://localhost:5173/login');
    await page.fill('input[id="email"]', 'admin@example.com');
    await page.fill('input[id="password"]', 'password');
    await page.click('button[type="submit"]');

    // 4. Navigate to Approvals
    await page.goto('http://localhost:5173/my/approvals');
    await expect(page.locator('h1').filter({ hasText: '我的审批' })).toBeVisible({ timeout: 10000 });

    // ==========================================
    // Test Scenario 1: Leave Approvals
    // ==========================================
    // Verify Tab is active
    await expect(page.getByRole('tab', { name: /请假/ })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('John Doe')).toBeVisible();
    await expect(page.getByText('Jane Smith')).toBeVisible();

    // Action 1: Approve John Doe
    // Locate row for John Doe, click Approve (通过)
    const johnRow = page.locator('tr', { hasText: 'John Doe' });
    await johnRow.locator('button').filter({ hasText: '通过' }).click();

    // Confirm Modal
    const approveModal = page.locator('.ant-modal-content:visible').filter({ hasText: '确认通过' });
    await expect(approveModal).toBeVisible();
    await approveModal.locator('.ant-modal-footer button.ant-btn-primary').click(); // Click OK
    await expect(page.getByText('审批通过').last()).toBeVisible();

    // Action 2: Reject Jane Smith
    // Locate row for Jane Smith, click Reject (驳回)
    const janeRow = page.locator('tr', { hasText: 'Jane Smith' });
    await janeRow.locator('button').filter({ hasText: '驳回' }).click();

    // Reject Modal
    const rejectModal = page.locator('.ant-modal-content:visible').filter({ hasText: '确认驳回' });
    await expect(rejectModal).toBeVisible();
    await rejectModal.locator('textarea').fill('Policy violation'); // Fill reason
    await rejectModal.locator('.ant-modal-footer button.ant-btn-dangerous').click();
    await expect(page.getByText('已驳回').last()).toBeVisible();


    // ==========================================
    // Test Scenario 2: Reimbursement Approvals
    // ==========================================
    // Switch Tab
    await page.getByRole('tab', { name: /报销/ }).click();
    await expect(page.getByText('Bob Jones')).toBeVisible();
    await expect(page.getByText('Alice Brown')).toBeVisible();

    // Action 1: Approve Bob Jones
    const bobRow = page.locator('tr', { hasText: 'Bob Jones' });
    await bobRow.locator('button').filter({ hasText: '通过' }).click();

    // Confirm Modal (Approve)
    const reimbApproveModal = page.locator('.ant-modal-content:visible').filter({ hasText: '确认通过' });
    await expect(reimbApproveModal).toBeVisible();
    await reimbApproveModal.locator('.ant-modal-footer button.ant-btn-primary').click();
    await expect(page.getByText('审批通过').last()).toBeVisible();

    // Action 2: Reject Alice Brown
    const aliceRow = page.locator('tr', { hasText: 'Alice Brown' });
    await aliceRow.locator('button').filter({ hasText: '驳回' }).click();

    const reimbRejectModal = page.locator('.ant-modal-content:visible').filter({ hasText: '确认驳回' });
    await expect(reimbRejectModal).toBeVisible();
    await reimbRejectModal.locator('textarea').fill('Too expensive');
    await reimbRejectModal.locator('.ant-modal-footer button.ant-btn-dangerous').click();
    await expect(page.getByText('已驳回').last()).toBeVisible();

});
