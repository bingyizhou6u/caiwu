import { Page } from '@playwright/test';
import fs from 'fs';

export async function setupCommonMocks(page: Page) {
    // Catch-all for API to prevent 401s from remote backend
    await page.route('**/api/**', async route => {
        const url = route.request().url();
        if (url.includes('/src/') || url.includes('node_modules') || url.includes('@fs')) {
            return route.continue();
        }

        // console.log('UNMOCKED API HIT:', url); // Optional: Enable for debugging
        try {
            // fs.appendFileSync('debug_urls.log', url + '\n');
        } catch (e) { }

        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results: [] }) });
    });

    await page.route('**/api/health', async route => route.fulfill({ json: { checks: { db: true }, status: 'healthy' } }));

    const authResponse = {
        json: {
            token: 'mock-token',
            user: {
                id: '1', name: 'Admin', email: 'admin@example.com', role: 'admin',
                permissions: [],
                position: {
                    functionRole: 'finance',
                    code: 'finance_manager',
                    permissions: {
                        finance: {
                            flow: ['view', 'create'],
                            transfer: ['view'],
                            ar: ['view'],
                            ap: ['view']
                        },
                        hr: {
                            employee: ['view', 'create', 'update', 'delete'],
                            position: ['view', 'create', 'update', 'delete'],
                            department: ['view', 'create', 'update', 'delete']
                        },
                        approval: {
                            task: ['view', 'approve', 'reject']
                        },
                        asset: {
                            fixed: ['view', 'create', 'update', 'delete']
                        }
                    }
                }
            }
        }
    };

    // Login Mock
    await page.route('**/api/v2/auth/login', async route => {
        await route.fulfill(authResponse);
    });

    // Me/Current Mock
    await page.route('**/api/v2/auth/me', async route => route.fulfill(authResponse));
    await page.route('**/api/v2/auth/current', async route => route.fulfill(authResponse));

    // Master Data Mocks
    await page.route('**/api/v2/accounts*', async route => {
        await route.fulfill({ json: { results: [{ id: 'acc1', name: 'Bank Account', type: 'bank', currency: 'CNY', active: 1 }] } });
    });
    await page.route('**/api/v2/categories*', async route => {
        await route.fulfill({ json: { results: [{ id: 'cat1', name: 'Sales Income', kind: 'income', active: 1 }, { id: 'cat2', name: 'Office Expense', kind: 'expense', active: 1 }] } });
    });
    await page.route('**/api/v2/departments*', async route => {
        await route.fulfill({ json: { results: [{ id: 'dept1', name: 'Sales Dept', active: 1 }] } });
    });
    await page.route('**/api/v2/currencies*', async route => {
        await route.fulfill({ json: { results: [{ id: 'curr1', code: 'CNY', name: 'Chinese Yuan', rate: 1, active: 1 }, { id: 'curr2', code: 'USD', name: 'US Dollar', rate: 7, active: 1 }] } });
    });
    await page.route('**/api/v2/sites*', async route => {
        await route.fulfill({ json: { results: [] } });
    });
    await page.route('**/api/v2/employees*', async route => {
        await route.fulfill({ json: { results: [] } });
    });
    await page.route('**/api/v2/fixed-assets*', async route => {
        await route.fulfill({ json: { results: [] } });
    });
    await page.route('**/api/v2/vendors*', async route => {
        await route.fulfill({ json: { results: [] } });
    });

    // Upload Mock - Return unified response format
    // uploadImageAsWebP expects result.url, and API client unwraps data, so return url directly in data
    await page.route('**/api/v2/upload/voucher', async route => {
        await page.waitForTimeout(500);
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                success: true,
                data: {
                    url: 'http://mock/file.png'
                }
            })
        });
    });

    // Positions Mock
    await page.route('**/api/v2/positions*', async route => {
        await route.fulfill({ json: { results: [{ id: 'pos1', name: 'Sales Engineer', code: 'team_engineer', active: 1 }] } });
    });

    // Org Departments Mock
    await page.route('**/api/v2/org-departments*', async route => {
        await route.fulfill({ json: { results: [{ id: 'org1', name: 'Sales Team A', project_id: 'dept1', active: 1 }] } });
    });

    // Headquarters Mock
    await page.route('**/api/v2/headquarters*', async route => {
        await route.fulfill({ json: { results: [{ id: 'hq1', name: 'Headquarters A' }] } });
    });

    // Account Transfers Mock
    await page.route('**/api/v2/transfers*', async route => {
        const method = route.request().method();
        if (method === 'POST') {
            const body = route.request().postDataJSON();
            await route.fulfill({ json: { id: 'transfer1', ...body, created_at: Date.now() } });
        } else {
            await route.fulfill({ json: { results: [], total: 0 } });
        }
    });

    // AR Mock
    await page.route('**/api/v2/ar*', async route => {
        await route.fulfill({ json: { results: [], total: 0 } });
    });

    // AP Mock
    await page.route('**/api/v2/ap*', async route => {
        await route.fulfill({ json: { results: [], total: 0 } });
    });

    // Leave Management Mock
    await page.route('**/api/v2/leaves*', async route => {
        const method = route.request().method();
        if (method === 'POST') {
            const body = route.request().postDataJSON();
            await route.fulfill({ json: { id: 'leave1', ...body, status: 'pending', created_at: Date.now() } });
        } else {
            await route.fulfill({ json: { results: [], total: 0 } });
        }
    });

    // Expense Reimbursements Mock
    await page.route('**/api/v2/reimbursements*', async route => {
        const method = route.request().method();
        if (method === 'POST') {
            const body = route.request().postDataJSON();
            await route.fulfill({ json: { id: 'reimb1', ...body, status: 'pending', created_at: Date.now() } });
        } else {
            await route.fulfill({ json: { results: [], total: 0 } });
        }
    });

    // Allowance Payments Mock
    await page.route('**/api/v2/allowance-payments*', async route => {
        const method = route.request().method();
        if (method === 'POST') {
            const body = route.request().postDataJSON();
            await route.fulfill({ json: { id: 'allow1', ...body, created_at: Date.now() } });
        } else {
            await route.fulfill({ json: { results: [], total: 0 } });
        }
    });

    // Salary Payments Mock
    await page.route('**/api/v2/salary/payments*', async route => {
        const method = route.request().method();
        if (method === 'POST') {
            const body = route.request().postDataJSON();
            await route.fulfill({ json: { id: 'salary1', ...body, status: 'draft', created_at: Date.now() } });
        } else {
            await route.fulfill({ json: { results: [], total: 0 } });
        }
    });

    // My Dashboard Mock
    await page.route('**/api/v2/my/dashboard*', async route => {
        await route.fulfill({
            json: {
                employee: {
                    id: '1',
                    name: 'Test User',
                    email: 'test@example.com',
                    position: 'Engineer',
                    department: 'Tech',
                    orgDepartment: 'Tech Team'
                },
                stats: {
                    salary: [{ totalCents: 1000000, currencyId: 'CNY' }],
                    annualLeave: { totalDays: 10, usedDays: 2, remainingDays: 8 },
                    pendingReimbursementCents: 50000
                },
                recentApplications: []
            }
        });
    });

    // My Profile Mock
    await page.route('**/api/v2/my/profile*', async route => {
        await route.fulfill({
            json: {
                id: '1',
                name: 'Test User',
                email: 'test@example.com',
                personalEmail: 'personal@example.com',
                phone: '13800138000',
                position: 'Engineer',
                department: 'Tech',
                orgDepartment: 'Tech Team',
                hireDate: '2024-01-01',
                status: 'active',
                probationSalaryCents: 800000,
                regularSalaryCents: 1000000,
                workSchedule: { days: [1, 2, 3, 4, 5], start: '09:00', end: '18:00' }
            }
        });
    });

    // Reports Mock
    await page.route('**/api/v2/reports/**', async route => {
        await route.fulfill({ json: { results: [], total: 0, summary: {} } });
    });

    // Dashboard Stats Mock
    await page.route('**/api/v2/reports/dashboard/stats*', async route => {
        await route.fulfill({
            json: {
                income: 1000000,
                expense: 500000,
                profit: 500000,
                monthly_trend: []
            }
        });
    });

    // Rental Properties Mock
    await page.route('**/api/v2/rental-properties*', async route => {
        const method = route.request().method();
        if (method === 'POST') {
            const body = route.request().postDataJSON();
            await route.fulfill({ json: { id: 'rental1', ...body, created_at: Date.now() } });
        } else {
            await route.fulfill({ json: { results: [], total: 0 } });
        }
    });

    // Dormitory Allocations Mock
    await page.route('**/api/v2/dormitory-allocations*', async route => {
        await route.fulfill({ json: { results: [], total: 0 } });
    });

    // Site Bills Mock
    await page.route('**/api/v2/site-bills*', async route => {
        const method = route.request().method();
        if (method === 'POST') {
            const body = route.request().postDataJSON();
            await route.fulfill({ json: { id: 'bill1', ...body, created_at: Date.now() } });
        } else {
            await route.fulfill({ json: { results: [], total: 0 } });
        }
    });

    // Audit Logs Mock
    await page.route('**/api/v2/audit-logs*', async route => {
        await route.fulfill({ json: { results: [], total: 0 } });
    });

    // Account Transactions Mock
    await page.route('**/api/v2/account-transactions*', async route => {
        await route.fulfill({ json: { results: [], total: 0 } });
    });
}

/**
 * 设置认证相关的 Mock
 */
export async function setupAuthMocks(page: Page, options?: {
    loginSuccess?: boolean
    needTotp?: boolean
    totpValid?: boolean
}) {
    const { loginSuccess = true, needTotp = false, totpValid = true } = options || {};

    await page.route('**/api/v2/auth/login', async route => {
        const body = route.request().postDataJSON();
        
        if (!loginSuccess) {
            await route.fulfill({ status: 401, json: { error: '用户名或密码错误' } });
            return;
        }

        if (needTotp && body.totp) {
            if (totpValid && body.totp === '123456') {
                await route.fulfill({
                    json: {
                        token: 'mock-token-2fa',
                        user: { id: '1', name: 'Admin', email: 'admin@example.com' }
                    }
                });
            } else {
                await route.fulfill({ status: 401, json: { error: 'Google验证码错误' } });
            }
            return;
        }

        if (needTotp) {
            await route.fulfill({
                json: {
                    needTotp: true,
                    msg: '需要二步验证'
                }
            });
            return;
        }

        await route.fulfill({
            json: {
                token: 'mock-token',
                user: { id: '1', name: 'Admin', email: 'admin@example.com' }
            }
        });
    });
}

/**
 * 设置激活账户相关的 Mock
 */
export async function setupActivationMocks(page: Page, options?: {
    tokenValid?: boolean
    activationSuccess?: boolean
}) {
    const { tokenValid = true, activationSuccess = true } = options || {};

    // 验证激活 token
    await page.route('**/api/v2/auth/activate/verify*', async route => {
        if (!tokenValid) {
            await route.fulfill({ status: 400, json: { error: { message: '激活链接无效或已过期' } } });
            return;
        }
        await route.fulfill({ json: { success: true, data: { valid: true, email: 'test@example.com' } } });
    });

    // 生成 TOTP 二维码
    await page.route('**/api/v2/auth/generate-totp-for-activation', async route => {
        await route.fulfill({
            json: {
                success: true,
                data: {
                    secret: 'JBSWY3DPEHPK3PXP',
                    qrCode: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
                }
            }
        });
    });

    // 激活账户
    await page.route('**/api/v2/auth/activate', async route => {
        if (!tokenValid) {
            await route.fulfill({ status: 400, json: { error: '无效的激活链接' } });
            return;
        }

        if (!activationSuccess) {
            await route.fulfill({ status: 400, json: { error: '激活失败' } });
            return;
        }

        await route.fulfill({ json: { success: true, message: '账户激活成功' } });
    });
}

/**
 * 设置密码重置相关的 Mock
 */
export async function setupPasswordResetMocks(page: Page, options?: {
    tokenValid?: boolean
    resetSuccess?: boolean
}) {
    const { tokenValid = true, resetSuccess = true } = options || {};

    // 验证重置 token
    await page.route('**/api/v2/auth/reset-password/verify*', async route => {
        if (!tokenValid) {
            await route.fulfill({ status: 400, json: { error: { message: '重置链接无效或已过期' } } });
            return;
        }
        await route.fulfill({ json: { success: true, data: { valid: true, email: 'test@example.com' } } });
    });

    // 请求重置密码
    await page.route('**/api/v2/auth/reset-password/request', async route => {
        await route.fulfill({ json: { success: true, message: '重置邮件已发送' } });
    });

    // 重置密码
    await page.route('**/api/v2/auth/reset-password', async route => {
        if (route.request().method() === 'POST') {
            if (!tokenValid) {
                await route.fulfill({ status: 400, json: { error: '无效的重置链接' } });
                return;
            }

            if (!resetSuccess) {
                await route.fulfill({ status: 400, json: { error: '密码重置失败' } });
                return;
            }

            await route.fulfill({ json: { success: true, message: '密码重置成功' } });
        }
    });
}

/**
 * 设置 TOTP 重置相关的 Mock
 */
export async function setupTotpResetMocks(page: Page, options?: {
    requestSuccess?: boolean
    confirmSuccess?: boolean
}) {
    const { requestSuccess = true, confirmSuccess = true } = options || {};

    await page.route('**/api/v2/auth/request-totp-reset', async route => {
        if (!requestSuccess) {
            await route.fulfill({ status: 400, json: { error: '请求失败' } });
            return;
        }
        await route.fulfill({ json: { success: true, message: '重置请求已发送' } });
    });

    await page.route('**/api/v2/auth/reset-totp', async route => {
        if (!confirmSuccess) {
            await route.fulfill({ status: 400, json: { error: '确认失败' } });
            return;
        }
        await route.fulfill({ json: { success: true, message: 'TOTP重置成功' } });
    });
}
